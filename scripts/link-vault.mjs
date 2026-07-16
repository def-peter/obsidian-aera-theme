import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const defaultRepoPath = dirname(dirname(modulePath));
const fixtureNames = ["Theme Playground.md", "Embedded Note.md"];

async function existingPathType(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function pointsToRepository(linkPath, repoPath) {
  const target = await readlink(linkPath);
  try {
    return (await realpath(resolve(dirname(linkPath), target))) === repoPath;
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Refusing to replace broken Aera symlink at ${linkPath}`);
    }
    throw error;
  }
}

function singleLine(value) {
  return String(value).replace(/[\u0000-\u001f\u007f]+/g, " ");
}

async function assertSafeFixtureTarget(path) {
  const existing = await existingPathType(path);
  if (!existing || existing.isFile()) return;

  const type = existing.isSymbolicLink()
    ? "symlink"
    : existing.isDirectory()
      ? "directory"
      : "non-file path";
  throw new Error(`Refusing to replace fixture ${type} at ${path}`);
}

export async function copyFixtureSafely(
  sourcePath,
  destinationPath,
  { createTemporaryId = randomUUID, renameFile = rename } = {},
) {
  await assertSafeFixtureTarget(destinationPath);
  const contents = await readFile(sourcePath);
  const temporaryPath = join(
    dirname(destinationPath),
    `.${basename(destinationPath)}.aera-${createTemporaryId()}.tmp`,
  );
  let temporaryFile;
  let ownsTemporaryPath = false;

  try {
    temporaryFile = await open(temporaryPath, "wx");
    ownsTemporaryPath = true;
    await temporaryFile.writeFile(contents);
    await temporaryFile.close();
    temporaryFile = undefined;
    await renameFile(temporaryPath, destinationPath);
    ownsTemporaryPath = false;
  } finally {
    await temporaryFile?.close().catch(() => {});
    if (ownsTemporaryPath) {
      await rm(temporaryPath, { force: true });
    }
  }
}

export function linkTypeForPlatform(platform) {
  return platform === "win32" ? "junction" : "dir";
}

export async function verifyThemeLink(linkPath, repoPath) {
  let finalTarget;
  try {
    finalTarget = await realpath(linkPath);
  } catch (error) {
    throw new Error(
      `Aera theme link verification failed at ${linkPath}: ${error.message}`,
    );
  }

  if (finalTarget !== repoPath) {
    throw new Error(
      `Aera theme link verification failed: ${linkPath} does not point to the repository`,
    );
  }
}

export async function linkVault(vaultPath, repoPath = defaultRepoPath) {
  if (typeof vaultPath !== "string" || !vaultPath.trim()) {
    throw new Error("AERA_TEST_VAULT is required");
  }

  const [vault, repo] = await Promise.all([
    realpath(vaultPath),
    realpath(repoPath),
  ]);
  const themesDirectory = join(vault, ".obsidian", "themes");
  const linkPath = join(themesDirectory, "Aera");
  await mkdir(themesDirectory, { recursive: true });

  const existing = await existingPathType(linkPath);
  if (existing) {
    if (!existing.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace existing Aera path at ${linkPath}; expected a symlink`,
      );
    }
    if (!(await pointsToRepository(linkPath, repo))) {
      throw new Error(
        `Refusing to replace Aera symlink at ${linkPath}; it points elsewhere`,
      );
    }
  } else {
    await symlink(repo, linkPath, linkTypeForPlatform(process.platform));
  }

  const fixtures = fixtureNames.map((name) => ({
    destination: join(vault, name),
    source: join(repo, "fixtures", name),
  }));
  for (const { destination } of fixtures) {
    await assertSafeFixtureTarget(destination);
  }
  for (const { destination, source } of fixtures) {
    await copyFixtureSafely(source, destination);
  }
  await verifyThemeLink(linkPath, repo);

  return vault;
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
    const vault = await linkVault(process.env.AERA_TEST_VAULT);
    console.log(`Aera linked into ${singleLine(vault)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${singleLine(message)}`);
    process.exitCode = 1;
  }
}
