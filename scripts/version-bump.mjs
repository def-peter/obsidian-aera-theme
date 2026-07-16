import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { validateManifest, validateVersions } from "./theme-policy.mjs";

const modulePath = fileURLToPath(import.meta.url);
const lockName = ".aera-version-bump.lock";
const lockTimeoutMs = 30_000;
const lockRetryMs = 10;
const malformedLockStaleMs = 1_000;
const retryLockCode = "AERA_LOCK_RETRY";

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
    return { contents, value: JSON.parse(contents) };
  } catch (error) {
    throw new Error(`could not parse ${path}: ${error.message}`);
  }
}

async function stageFile(path, contents, temporaryPath) {
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
    const cleanupFailures = [];
    try {
      await temporaryFile?.close();
    } catch (cleanupFailure) {
      cleanupFailures.push({ action: "close", error: cleanupFailure });
    }
    if (ownsTemporaryPath) {
      try {
        await rm(temporaryPath, { force: true });
        ownsTemporaryPath = false;
      } catch (cleanupFailure) {
        cleanupFailures.push({ action: "remove", error: cleanupFailure });
      }
    }
    if (cleanupFailures.length) {
      throw stageCleanupError(
        error,
        temporaryPath,
        cleanupFailures,
        ownsTemporaryPath,
      );
    }
    throw error;
  }
}

async function inspectLockOwner(ownerPath) {
  try {
    const [contents, metadata] = await Promise.all([
      readFile(ownerPath, "utf8"),
      stat(ownerPath),
    ]);
    let owner;
    try {
      owner = JSON.parse(contents);
    } catch {
      owner = null;
    }
    const validOwner =
      owner &&
      typeof owner.token === "string" &&
      owner.token.length > 0 &&
      Number.isSafeInteger(owner.pid) &&
      owner.pid > 0 &&
      typeof owner.createdAt === "number";
    return {
      createdAt: validOwner ? owner.createdAt : null,
      identity: validOwner
        ? `token:${owner.token}`
        : `invalid:${metadata.dev}:${metadata.ino}:${metadata.mtimeMs}:${contents}`,
      mtimeMs: metadata.mtimeMs,
      pid: validOwner ? owner.pid : null,
      token: validOwner ? owner.token : null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function inspectLock(lockPath) {
  try {
    const [entries, metadata] = await Promise.all([
      readdir(lockPath, { withFileTypes: true }),
      stat(lockPath),
    ]);
    if (entries.length === 0) {
      return {
        mtimeMs: metadata.mtimeMs,
        owner: null,
        ownerPath: null,
        removable: true,
      };
    }
    const ownerEntries = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".json"),
    );
    if (ownerEntries.length === 1) {
      const ownerPath = join(lockPath, ownerEntries[0].name);
      const owner = await inspectLockOwner(ownerPath);
      const workspacePath = owner?.token ? join(lockPath, owner.token) : null;
      const validEntries = entries.every(
        (entry) =>
          entry.name === ownerEntries[0].name ||
          (workspacePath && entry.isDirectory() && entry.name === owner.token),
      );
      return {
        mtimeMs: owner?.mtimeMs ?? metadata.mtimeMs,
        owner,
        ownerPath,
        removable: validEntries,
        workspacePath,
      };
    }
    return {
      mtimeMs: metadata.mtimeMs,
      owner: null,
      ownerPath: null,
      removable: false,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function lockIsStale(lock) {
  if (!lock.removable) return false;
  if (lock.owner?.pid !== null && lock.owner?.pid !== undefined) {
    return !processIsRunning(lock.owner.pid);
  }
  return Date.now() - lock.mtimeMs >= malformedLockStaleMs;
}

async function removeLockDirectory(lockPath) {
  try {
    await rmdir(lockPath);
    return true;
  } catch (error) {
    if (
      error?.code === "ENOENT" ||
      error?.code === "ENOTEMPTY" ||
      error?.code === "EEXIST"
    ) {
      return false;
    }
    throw error;
  }
}

async function releaseDirectoryLock(lockPath, ownerPath, workspacePath, token) {
  const owner = await inspectLockOwner(ownerPath);
  if (owner?.token !== token) return;

  try {
    await rmdir(workspacePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(
        `version workspace retained at ${workspacePath}: ${error.message}`,
      );
    }
  }
  try {
    await rm(ownerPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  await removeLockDirectory(lockPath);
}

async function removeStaleLock(lockPath, observed) {
  if (observed.ownerPath) {
    const currentOwner = await inspectLockOwner(observed.ownerPath);
    if (currentOwner?.identity !== observed.owner?.identity) return false;
    if (observed.workspacePath) {
      await rm(observed.workspacePath, { recursive: true, force: true });
    }
    try {
      await rm(observed.ownerPath);
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }
  return removeLockDirectory(lockPath);
}

async function createDirectoryLock(lockPath) {
  const token = randomUUID();
  const ownerPath = join(lockPath, `${token}.json`);
  const preparedOwnerPath = join(
    dirname(lockPath),
    `.aera-version-bump-owner-${token}.tmp`,
  );
  let lockFile;
  try {
    lockFile = await open(preparedOwnerPath, "wx");
    await lockFile.writeFile(
      `${JSON.stringify({ token, pid: process.pid, createdAt: Date.now() })}\n`,
    );
    await lockFile.close();
  } catch (error) {
    await lockFile?.close().catch(() => {});
    await rm(preparedOwnerPath, { force: true }).catch(() => {});
    throw error;
  }

  try {
    await mkdir(lockPath);
  } catch (error) {
    try {
      await rm(preparedOwnerPath);
    } catch (cleanupFailure) {
      throw stageCleanupError(
        error,
        preparedOwnerPath,
        [{ action: "remove", error: cleanupFailure }],
        true,
      );
    }
    throw error;
  }

  let publicationError;
  try {
    await rename(preparedOwnerPath, ownerPath);
    const published = await inspectLock(lockPath);
    if (
      published?.owner?.token !== token ||
      published.ownerPath !== ownerPath
    ) {
      publicationError = new Error("version lock owner publication lost its gate");
    }
  } catch (error) {
    publicationError = error;
  }

  if (publicationError) {
    await rm(preparedOwnerPath, { force: true }).catch(() => {});
    await rm(ownerPath, { force: true }).catch(() => {});
    await removeLockDirectory(lockPath).catch(() => {});
    const retryError = new Error(
      `could not publish version lock owner ${ownerPath}: ${errorMessage(publicationError)}`,
    );
    retryError.code = retryLockCode;
    throw retryError;
  }

  const workspacePath = join(lockPath, token);
  try {
    await mkdir(workspacePath);
  } catch (error) {
    await rm(ownerPath, { force: true }).catch(() => {});
    await removeLockDirectory(lockPath).catch(() => {});
    throw error;
  }

  return {
    token,
    workspacePath,
    async release() {
      await releaseDirectoryLock(lockPath, ownerPath, workspacePath, token);
    },
  };
}

async function acquireDirectoryLock(directory) {
  const lockPath = join(directory, lockName);
  const deadline = performance.now() + lockTimeoutMs;

  while (true) {
    try {
      return await createDirectoryLock(lockPath);
    } catch (error) {
      if (error?.code === retryLockCode) {
        if (performance.now() >= deadline) throw error;
        await delay(lockRetryMs);
        continue;
      }
      if (error?.code !== "EEXIST") {
        throw new Error(`could not acquire version lock ${lockPath}: ${error.message}`);
      }

      const observed = await inspectLock(lockPath);
      if (observed && lockIsStale(observed)) {
        await removeStaleLock(lockPath, observed);
        continue;
      }
      if (performance.now() >= deadline) {
        throw new Error(`timed out waiting for version lock ${lockPath}`);
      }
      await delay(lockRetryMs);
    }
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function stageCleanupError(originalError, path, failures, retained) {
  const details = failures
    .map(({ action, error }) => `${action} ${path}: ${errorMessage(error)}`)
    .join("; ");
  const retainedDetails = retained ? `; temporary retained at ${path}` : "";
  return new AggregateError(
    [originalError, ...failures.map(({ error }) => error)],
    `${errorMessage(originalError)}; cleanup failed: ${details}${retainedDetails}`,
  );
}

function rollbackError(originalError, failures) {
  const details = failures
    .map(
      ({ action, error, path }) =>
        `${action} ${path}: ${errorMessage(error)}`,
    )
    .join("; ");
  return new AggregateError(
    [originalError, ...failures.map(({ error }) => error)],
    `${errorMessage(originalError)}; rollback failed: ${details}`,
  );
}

async function cleanupStagedFiles(staged) {
  const results = await Promise.all(
    staged.map(async (file) => {
      try {
        await file.temporary.cleanup();
        return null;
      } catch (error) {
        return { error, path: file.temporary.path };
      }
    }),
  );
  return results.filter(Boolean);
}

function cleanupError(originalError, failures) {
  const details = failures
    .map(
      ({ error, path }) =>
        `${path}: ${errorMessage(error)}; temporary retained at ${path}`,
    )
    .join("; ");
  return new AggregateError(
    [originalError, ...failures.map(({ error }) => error)],
    `${errorMessage(originalError)}; cleanup failed: ${details}`,
  );
}

async function replaceTogether(replacements, workspacePath) {
  const transactionId = randomUUID();
  const staged = [];

  try {
    for (const replacement of replacements) {
      const temporaryPath = join(
        workspacePath,
        `.${basename(replacement.path)}.aera-${transactionId}.install.tmp`,
      );
      staged.push({
        ...replacement,
        temporary: await stageFile(
          replacement.path,
          replacement.contents,
          temporaryPath,
        ),
      });
    }
  } catch (error) {
    const cleanupFailures = await cleanupStagedFiles(staged);
    if (cleanupFailures.length) throw cleanupError(error, cleanupFailures);
    throw error;
  }

  const installed = [];
  try {
    for (const file of staged) {
      await rename(file.temporary.path, file.path);
      file.temporary.release();
      installed.push(file);
    }
  } catch (error) {
    const rollbackFailures = [];
    const rollbackTemporaries = [];
    for (const file of installed.toReversed()) {
      const rollbackPath = join(
        workspacePath,
        `.${basename(file.path)}.aera-${transactionId}.rollback.tmp`,
      );
      try {
        const rollbackTemporary = await stageFile(
          file.path,
          file.rollbackContents,
          rollbackPath,
        );
        rollbackTemporaries.push({ temporary: rollbackTemporary });
        await rename(rollbackTemporary.path, file.path);
        rollbackTemporary.release();
      } catch (rollbackFailure) {
        rollbackFailures.push({
          action: "restore original",
          error: rollbackFailure,
          path: rollbackPath,
        });
      }
    }
    const replacementError = rollbackFailures.length
      ? rollbackError(error, rollbackFailures)
      : error;
    const cleanupFailures = await cleanupStagedFiles([
      ...staged,
      ...rollbackTemporaries,
    ]);
    if (cleanupFailures.length) {
      throw cleanupError(replacementError, cleanupFailures);
    }
    throw replacementError;
  }

  const cleanupFailures = await cleanupStagedFiles(staged);
  if (cleanupFailures.length) {
    throw cleanupError(new Error("install completed"), cleanupFailures);
  }
}

export async function syncVersion(directory = process.cwd()) {
  const absoluteDirectory = resolve(directory);
  const lock = await acquireDirectoryLock(absoluteDirectory);
  let operationError;
  try {
    const packagePath = join(absoluteDirectory, "package.json");
    const manifestPath = join(absoluteDirectory, "manifest.json");
    const versionsPath = join(absoluteDirectory, "versions.json");
    const [packageDocument, manifestDocument, versionsDocument] =
      await Promise.all([
        readJson(packagePath),
        readJson(manifestPath),
        readJson(versionsPath),
      ]);
    const next = bumpMetadata(
      manifestDocument.value,
      versionsDocument.value,
      packageDocument.value?.version,
    );

    await replaceTogether(
      [
        {
          path: versionsPath,
          contents: jsonContents(next.versions),
          rollbackContents: versionsDocument.contents,
        },
        {
          path: manifestPath,
          contents: jsonContents(next.manifest),
          rollbackContents: manifestDocument.contents,
        },
      ],
      lock.workspacePath,
    );
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      await lock.release();
    } catch (releaseError) {
      if (operationError) {
        throw new AggregateError(
          [operationError, releaseError],
          `${errorMessage(operationError)}; could not release version lock: ${errorMessage(releaseError)}`,
        );
      }
      throw releaseError;
    }
  }
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
