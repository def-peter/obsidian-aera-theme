import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateManifest, validateVersions } from "./theme-policy.mjs";

const modulePath = fileURLToPath(import.meta.url);

function throwValidationErrors(errors, context = "") {
  if (errors.length) {
    const prefix = context ? `${context}: ` : "";
    throw new Error(`${prefix}${errors.join("; ")}`);
  }
}

export function bumpMetadata(manifest, versions, targetVersion) {
  throwValidationErrors(validateManifest(manifest), "manifest.json");
  throwValidationErrors(validateVersions(manifest, versions), "versions.json");

  const targetErrors = validateManifest({ ...manifest, version: targetVersion });
  if (targetErrors.includes("manifest version must use x.y.z")) {
    throw new Error("target version must use x.y.z");
  }
  throwValidationErrors(targetErrors);

  const nextManifest = { ...manifest, version: targetVersion };
  const nextVersions = {
    ...versions,
    [targetVersion]: manifest.minAppVersion,
  };
  throwValidationErrors([
    ...validateManifest(nextManifest),
    ...validateVersions(nextManifest, nextVersions),
  ]);

  return { manifest: nextManifest, versions: nextVersions };
}

function jsonContents(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(path) {
  let contents;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`could not read ${path}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`could not parse ${path}: ${error.message}`);
  }
}

async function stageFile(path, contents, id) {
  const temporaryPath = join(dirname(path), `.${basename(path)}.aera-${id}.tmp`);
  let temporaryFile;
  let ownsTemporaryPath = false;

  try {
    temporaryFile = await open(temporaryPath, "wx");
    ownsTemporaryPath = true;
    await temporaryFile.writeFile(contents);
    await temporaryFile.close();
    temporaryFile = undefined;

    return {
      path: temporaryPath,
      release() {
        ownsTemporaryPath = false;
      },
      async cleanup() {
        await temporaryFile?.close().catch(() => {});
        if (ownsTemporaryPath) {
          await rm(temporaryPath, { force: true });
          ownsTemporaryPath = false;
        }
      },
    };
  } catch (error) {
    await temporaryFile?.close().catch(() => {});
    if (ownsTemporaryPath) await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function replaceTogether(replacements) {
  const transactionId = randomUUID();
  const staged = [];

  try {
    for (const { path, contents } of replacements) {
      staged.push({
        destination: path,
        backup: join(dirname(path), `.${basename(path)}.aera-${transactionId}.bak`),
        temporary: await stageFile(path, contents, transactionId),
        backupOwned: false,
        replacementInstalled: false,
      });
    }
  } catch (error) {
    await Promise.all(staged.map((file) => file.temporary.cleanup()));
    throw error;
  }

  try {
    for (const file of staged) {
      await rename(file.destination, file.backup);
      file.backupOwned = true;
    }
    for (const file of staged) {
      await rename(file.temporary.path, file.destination);
      file.temporary.release();
      file.replacementInstalled = true;
    }
  } catch (error) {
    for (const file of staged.toReversed()) {
      if (file.replacementInstalled) {
        await rm(file.destination, { force: true }).catch(() => {});
        file.replacementInstalled = false;
      }
      if (file.backupOwned) {
        try {
          await rename(file.backup, file.destination);
          file.backupOwned = false;
        } catch {}
      }
    }
    throw error;
  } finally {
    await Promise.all(staged.map((file) => file.temporary.cleanup()));
  }

  for (const file of staged) {
    await rm(file.backup);
    file.backupOwned = false;
  }
}

export async function syncVersion(directory = process.cwd()) {
  const packagePath = join(directory, "package.json");
  const manifestPath = join(directory, "manifest.json");
  const versionsPath = join(directory, "versions.json");
  const [packageJson, manifest, versions] = await Promise.all([
    readJson(packagePath),
    readJson(manifestPath),
    readJson(versionsPath),
  ]);
  const next = bumpMetadata(manifest, versions, packageJson?.version);

  await replaceTogether([
    { path: manifestPath, contents: jsonContents(next.manifest) },
    { path: versionsPath, contents: jsonContents(next.versions) },
  ]);
}

function singleLine(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function isDirectRun() {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(modulePath);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    await syncVersion();
    console.log("Theme metadata version synchronized");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${singleLine(message)}`);
    process.exitCode = 1;
  }
}
