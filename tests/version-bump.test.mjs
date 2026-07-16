import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bumpMetadata, syncVersion } from "../scripts/version-bump.mjs";

const manifest = {
  name: "Aera",
  version: "0.1.0",
  minAppVersion: "1.12.7",
  author: "Peter",
  authorUrl: "https://example.com/peter",
};
const versions = { "0.1.0": "1.12.7" };
const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = join(repoRoot, "scripts/version-bump.mjs");

function createFixture(t, packageVersion) {
  const directory = mkdtempSync(join(tmpdir(), "aera-version-bump-"));
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify({ version: packageVersion }, null, 2)}\n`,
  );
  writeFileSync(
    join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    join(directory, "versions.json"),
    `${JSON.stringify(versions, null, 2)}\n`,
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(cwd, options = {}) {
  return spawnSync(process.execPath, [cliPath], {
    cwd,
    encoding: "utf8",
    ...options,
  });
}

function startCli(cwd, { env, preloadPath } = {}) {
  const args = preloadPath
    ? ["--import", pathToFileURL(preloadPath).href, cliPath]
    : [cliPath];
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
  });
  const result = new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr });
    });
  });
  return { child, result };
}

function runCliAsync(cwd) {
  return startCli(cwd).result;
}

async function waitForFile(path) {
  const deadline = Date.now() + 2_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await delay(5);
  }
}

function readLockMetadata(lockPath) {
  const ownerNames = readdirSync(lockPath).filter((name) => name.endsWith(".json"));
  assert.equal(ownerNames.length, 1, "lock should have exactly one owner record");
  return JSON.parse(readFileSync(join(lockPath, ownerNames[0]), "utf8"));
}

function findNestedFile(directory, pattern) {
  const relativePath = readdirSync(directory, { recursive: true }).find((path) =>
    pattern.test(basename(String(path))),
  );
  return relativePath ? join(directory, String(relativePath)) : undefined;
}

function startPausedCli(directory, name) {
  const preloadPath = join(directory, `${name}-pause.mjs`);
  const readyPath = join(directory, `${name}-ready`);
  const continuePath = join(directory, `${name}-continue`);
  writeFileSync(
    preloadPath,
    `import fs, { existsSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const realReadFile = fs.promises.readFile;
let paused = false;
fs.promises.readFile = async (path, ...args) => {
  if (!paused && basename(String(path)) === "package.json") {
    paused = true;
    writeFileSync(process.env.AERA_LOCK_READY, "ready\\n");
    while (!existsSync(process.env.AERA_LOCK_CONTINUE)) await delay(5);
  }
  return realReadFile(path, ...args);
};
syncBuiltinESMExports();
`,
  );
  return {
    ...startCli(directory, {
      env: {
        AERA_LOCK_CONTINUE: continuePath,
        AERA_LOCK_READY: readyPath,
      },
      preloadPath,
    }),
    continuePath,
    preloadPath,
    readyPath,
  };
}

test("bumpMetadata updates the manifest and appends the versions mapping", () => {
  assert.deepEqual(bumpMetadata(manifest, versions, "1.0.0"), {
    manifest: { ...manifest, version: "1.0.0" },
    versions: {
      "0.1.0": "1.12.7",
      "1.0.0": "1.12.7",
    },
  });
});

test("bumpMetadata does not mutate its inputs", () => {
  const manifestInput = structuredClone(manifest);
  const versionsInput = structuredClone(versions);
  const originalManifest = structuredClone(manifestInput);
  const originalVersions = structuredClone(versionsInput);

  const result = bumpMetadata(manifestInput, versionsInput, "1.0.0");

  assert.deepEqual(manifestInput, originalManifest);
  assert.deepEqual(versionsInput, originalVersions);
  assert.notStrictEqual(result.manifest, manifestInput);
  assert.notStrictEqual(result.versions, versionsInput);
});

test("bumpMetadata rejects invalid target versions", () => {
  for (const target of ["1.0", "01.0.0", "v1.0.0", "", null]) {
    assert.throws(
      () => bumpMetadata(manifest, versions, target),
      /target version must use x\.y\.z/,
    );
  }
});

test("bumpMetadata rejects invalid manifest and versions inputs", () => {
  for (const invalidManifest of [null, [], { ...manifest, name: "Other" }]) {
    assert.throws(
      () => bumpMetadata(invalidManifest, versions, "1.0.0"),
      /manifest\.json/,
    );
  }

  for (const invalidVersions of [null, [], { "0.1.0": "1.12" }]) {
    assert.throws(
      () => bumpMetadata(manifest, invalidVersions, "1.0.0"),
      /versions\.json/,
    );
  }
});

test("version bump CLI syncs metadata to package.json version", (t) => {
  const directory = createFixture(t, "1.0.0");

  const result = runCli(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "Theme metadata version synchronized\n");
  assert.equal(
    readFileSync(join(directory, "manifest.json"), "utf8"),
    `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(directory, "versions.json"), "utf8"),
    `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
  );
});

test("version bump CLI reports invalid metadata without modifying files", (t) => {
  const directory = createFixture(t, "1.0");
  const manifestPath = join(directory, "manifest.json");
  const versionsPath = join(directory, "versions.json");
  const originalManifest = readFileSync(manifestPath, "utf8");
  const originalVersions = readFileSync(versionsPath, "utf8");

  const result = runCli(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR: target version must use x\.y\.z\n$/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
  assert.equal(readFileSync(manifestPath, "utf8"), originalManifest);
  assert.equal(readFileSync(versionsPath, "utf8"), originalVersions);
});

test("syncVersion fixes a relative directory before its first await", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const otherDirectory = mkdtempSync(join(tmpdir(), "aera-version-bump-cwd-"));
  const originalCwd = process.cwd();
  t.after(() => rmSync(otherDirectory, { recursive: true, force: true }));

  process.chdir(dirname(directory));
  const synchronization = syncVersion(basename(directory));
  process.chdir(otherDirectory);
  try {
    await synchronization;
  } finally {
    process.chdir(originalCwd);
  }

  assert.equal(
    JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")).version,
    "1.0.0",
  );
});

test("version bump CLI takes over a stale lock after its owner is killed", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const lockPath = join(directory, ".aera-version-bump.lock");
  const paused = startPausedCli(directory, "killed-owner");
  await waitForFile(paused.readyPath);
  const metadata = readLockMetadata(lockPath);

  paused.child.kill("SIGKILL");
  await paused.result;
  rmSync(paused.preloadPath, { force: true });
  rmSync(paused.readyPath, { force: true });

  const recovered = await Promise.all(
    Array.from({ length: 12 }, () => runCliAsync(directory)),
  );

  for (const result of recovered) assert.equal(result.status, 0, result.stderr);
  assert.equal(metadata.pid, paused.child.pid);
  assert.equal(typeof metadata.token, "string");
  assert.equal(typeof metadata.createdAt, "number");
  assert.equal(existsSync(lockPath), false);
});

test("a previous lock owner fails without deleting a replacement lock", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const lockPath = join(directory, ".aera-version-bump.lock");
  const paused = startPausedCli(directory, "replaced-owner");
  await waitForFile(paused.readyPath);
  const replacement = {
    token: "replacement-owner-token",
    pid: process.pid,
    createdAt: Date.now(),
  };
  rmSync(lockPath, { recursive: true });
  mkdirSync(lockPath);
  writeFileSync(
    join(lockPath, `${replacement.token}.json`),
    `${JSON.stringify(replacement)}\n`,
    { flag: "wx" },
  );
  writeFileSync(paused.continuePath, "continue\n");

  const result = await paused.result;

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT|workspace/i);
  assert.deepEqual(readLockMetadata(lockPath), replacement);
});

test("releasing an owned lock never vacates the fixed lock path early", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const lockPath = join(directory, ".aera-version-bump.lock");
  const preloadPath = join(directory, "pause-lock-release.mjs");
  const readyPath = join(directory, "release-ready");
  const continuePath = join(directory, "release-continue");
  writeFileSync(
    preloadPath,
    `import fs, { existsSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const realRm = fs.promises.rm;
let paused = false;
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  const parent = basename(dirname(String(path)));
  const releasingLock = name.endsWith(".moved") ||
    (parent === ".aera-version-bump.lock" && name.endsWith(".json"));
  if (!paused && releasingLock) {
    paused = true;
    writeFileSync(process.env.AERA_RELEASE_READY, "ready\\n");
    while (!existsSync(process.env.AERA_RELEASE_CONTINUE)) await delay(5);
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
  );
  const running = startCli(directory, {
    env: {
      AERA_RELEASE_CONTINUE: continuePath,
      AERA_RELEASE_READY: readyPath,
    },
    preloadPath,
  });
  await waitForFile(readyPath);

  const fixedLockStillExists = existsSync(lockPath);
  writeFileSync(continuePath, "continue\n");
  const result = await running.result;

  assert.equal(fixedLockStillExists, true);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(lockPath), false);
});

test("a slow owner publication cannot bypass a contender's recovery gate", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "slow-owner-publication.mjs");
  const slowReadyPath = join(directory, "slow-owner-ready");
  const slowContinuePath = join(directory, "slow-owner-continue");
  const slowEnteredPath = join(directory, "slow-owner-entered");
  writeFileSync(
    preloadPath,
    `import fs, { existsSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const realOpen = fs.promises.open;
const realReadFile = fs.promises.readFile;
let ownerWritePaused = false;
fs.promises.open = async (path, ...args) => {
  const handle = await realOpen(path, ...args);
  const name = basename(String(path));
  const parent = basename(dirname(String(path)));
  const ownerRecord =
    (parent === ".aera-version-bump.lock" && name.endsWith(".json")) ||
    name.startsWith(".aera-version-bump-owner-");
  if (!ownerWritePaused && ownerRecord) {
    ownerWritePaused = true;
    const realWriteFile = handle.writeFile.bind(handle);
    handle.writeFile = async (...writeArgs) => {
      writeFileSync(process.env.AERA_SLOW_READY, "ready\\n");
      while (!existsSync(process.env.AERA_SLOW_CONTINUE)) await delay(5);
      return realWriteFile(...writeArgs);
    };
  }
  return handle;
};
fs.promises.readFile = async (path, ...args) => {
  if (basename(String(path)) === "package.json") {
    writeFileSync(process.env.AERA_SLOW_ENTERED, "entered\\n");
  }
  return realReadFile(path, ...args);
};
syncBuiltinESMExports();
`,
  );
  const slowOwner = startCli(directory, {
    env: {
      AERA_SLOW_CONTINUE: slowContinuePath,
      AERA_SLOW_ENTERED: slowEnteredPath,
      AERA_SLOW_READY: slowReadyPath,
    },
    preloadPath,
  });
  await waitForFile(slowReadyPath);
  await delay(1_200);

  const contender = startPausedCli(directory, "publication-contender");
  await waitForFile(contender.readyPath);
  writeFileSync(slowContinuePath, "continue\n");
  await delay(200);
  const slowOwnerEnteredWhileContenderHeld = existsSync(slowEnteredPath);
  writeFileSync(contender.continuePath, "continue\n");

  const contenderResult = await contender.result;
  await waitForFile(slowEnteredPath);
  const slowOwnerResult = await slowOwner.result;

  assert.equal(slowOwnerEnteredWhileContenderHeld, false);
  assert.equal(contenderResult.status, 0, contenderResult.stderr);
  assert.equal(slowOwnerResult.status, 0, slowOwnerResult.stderr);
  assert.equal(
    readdirSync(directory).some((name) =>
      name.startsWith(".aera-version-bump-owner-"),
    ),
    false,
  );
});

for (const installBoundary of [1, 2]) {
  test(`version bump CLI converges after SIGKILL at install replace ${installBoundary}`, async (t) => {
    const directory = createFixture(t, "1.0.0");
    const preloadPath = join(directory, `kill-install-${installBoundary}.mjs`);
    const readyPath = join(directory, `kill-install-${installBoundary}-ready`);
    writeFileSync(
      preloadPath,
      `import fs, { writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const realRename = fs.promises.rename;
let installRenames = 0;
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  const destinationName = basename(String(destination));
  const installRename = sourceName.endsWith(".tmp") &&
    (destinationName === "manifest.json" || destinationName === "versions.json");
  const result = await realRename(source, destination);
  if (installRename) {
    installRenames += 1;
    if (installRenames === Number(process.env.AERA_KILL_INSTALL)) {
      writeFileSync(process.env.AERA_KILL_READY, "ready\\n");
      while (true) await delay(1_000);
    }
  }
  return result;
};
syncBuiltinESMExports();
`,
    );
    const interrupted = startCli(directory, {
      env: {
        AERA_KILL_READY: readyPath,
        AERA_KILL_INSTALL: String(installBoundary),
      },
      preloadPath,
    });
    await waitForFile(readyPath);
    interrupted.child.kill("SIGKILL");
    await interrupted.result;
    rmSync(preloadPath, { force: true });
    rmSync(readyPath, { force: true });

    const recovered = await Promise.all(
      Array.from({ length: 8 }, () => runCliAsync(directory)),
    );

    for (const result of recovered) assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(directory, "manifest.json"), "utf8"),
      `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
    );
    assert.equal(
      readFileSync(join(directory, "versions.json"), "utf8"),
      `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
    );
    assert.deepEqual(readdirSync(directory).sort(), [
      "manifest.json",
      "package.json",
      "versions.json",
    ]);
  });
}

for (const failurePoint of ["write", "close"]) {
  test(`version bump CLI reports retained install temporary after ${failurePoint} failure`, (t) => {
    const directory = createFixture(t, "1.0.0");
    const preloadPath = join(directory, `fail-stage-${failurePoint}.mjs`);
    writeFileSync(
      preloadPath,
      `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";

const realOpen = fs.promises.open;
const realRm = fs.promises.rm;
fs.promises.open = async (path, ...args) => {
  const handle = await realOpen(path, ...args);
  const name = basename(String(path));
  if (name.startsWith(".manifest.json.aera-") && name.endsWith(".install.tmp")) {
    if (process.env.AERA_STAGE_FAILURE === "write") {
      handle.writeFile = async () => {
        throw new Error("injected temporary write failure");
      };
      handle.close = async () => {
        throw new Error("injected temporary cleanup close failure");
      };
    } else {
      const realClose = handle.close.bind(handle);
      let closeFailed = false;
      handle.close = async () => {
        if (!closeFailed) {
          closeFailed = true;
          throw new Error("injected temporary close failure");
        }
        return realClose();
      };
    }
  }
  return handle;
};
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  const parent = basename(dirname(String(path)));
  if (name.startsWith(".manifest.json.aera-") && name.endsWith(".install.tmp")) {
    throw new Error("injected staged temporary removal failure");
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
    );

    const result = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(preloadPath).href, cliPath],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, AERA_STAGE_FAILURE: failurePoint },
      },
    );
    const temporaryPath = findNestedFile(
      directory,
      /^\.manifest\.json\.aera-.+\.install\.tmp$/,
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`temporary ${failurePoint} failure`));
    if (failurePoint === "write") {
      assert.match(result.stderr, /temporary cleanup close failure/);
    }
    assert.match(result.stderr, /staged temporary removal failure/);
    assert.match(result.stderr, /workspace.*retained|ENOTEMPTY/i);
    assert.ok(temporaryPath, "failed cleanup should retain the install temporary");
    assert.match(
      result.stderr,
      new RegExp(basename(temporaryPath).replaceAll(".", "\\.")),
    );
  });
}

test("owner release does not erase a reported retained temporary", (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "retain-failed-temporary.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";

const realOpen = fs.promises.open;
const realRm = fs.promises.rm;
fs.promises.open = async (path, ...args) => {
  const handle = await realOpen(path, ...args);
  const name = basename(String(path));
  if (name.startsWith(".manifest.json.aera-") && name.endsWith(".install.tmp")) {
    handle.writeFile = async () => {
      throw new Error("injected retained temporary write failure");
    };
  }
  return handle;
};
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  if (name.startsWith(".manifest.json.aera-") && name.endsWith(".install.tmp")) {
    throw new Error("injected retained temporary removal failure");
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
  );

  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const temporaryPath = findNestedFile(
    directory,
    /^\.manifest\.json\.aera-.+\.install\.tmp$/,
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /temporary retained at/);
  assert.match(result.stderr, /workspace.*retained|ENOTEMPTY/i);
  assert.ok(temporaryPath, "the reported retained temporary must still exist");
});

test("failed atomic rollback preserves and retries the original contents", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "fail-rollback-only.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";

const realRename = fs.promises.rename;
let installFailed = false;
let rollbackFailed = false;
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  const destinationName = basename(String(destination));
  if (!installFailed && sourceName.startsWith(".manifest.json.aera-") && sourceName.endsWith(".install.tmp")) {
    installFailed = true;
    throw new Error("injected manifest-only install failure");
  }
  if (!rollbackFailed && sourceName.startsWith(".versions.json.aera-") && sourceName.endsWith(".rollback.ready") && destinationName === "versions.json") {
    rollbackFailed = true;
    throw new Error("injected versions-only rollback failure");
  }
  return realRename(source, destination);
};
syncBuiltinESMExports();
`,
  );

  const failed = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const rollbackPath = findNestedFile(
    directory,
    /^\.versions\.json\.aera-.+\.rollback\.ready$/,
  );

  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /injected manifest-only install failure/);
  assert.match(failed.stderr, /rollback.*injected versions-only rollback failure/i);
  assert.match(failed.stderr, /original (?:contents|copy) retained at/i);
  assert.match(failed.stderr, /workspace.*retained/i);
  assert.ok(rollbackPath, "the original serialized contents must remain on disk");
  assert.match(
    failed.stderr,
    new RegExp(basename(rollbackPath).replaceAll(".", "\\.")),
  );
  assert.equal(existsSync(join(directory, ".aera-version-bump.lock")), true);

  rmSync(preloadPath, { force: true });
  const recovered = await Promise.all(
    Array.from({ length: 16 }, () => runCliAsync(directory)),
  );

  for (const result of recovered) assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readFileSync(join(directory, "manifest.json"), "utf8"),
    `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(directory, "versions.json"), "utf8"),
    `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
  );
  assert.deepEqual(readdirSync(directory).sort(), [
    "manifest.json",
    "package.json",
    "versions.json",
  ]);
});

test("partial rollback preparation is never applied to canonical JSON", (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "fail-rollback-preparing.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";

const realOpen = fs.promises.open;
const realRename = fs.promises.rename;
const realRm = fs.promises.rm;
let installFailed = false;
fs.promises.open = async (path, ...args) => {
  const handle = await realOpen(path, ...args);
  const name = basename(String(path));
  if (name.startsWith(".versions.json.aera-") && name.endsWith(".rollback.preparing")) {
    const realWriteFile = handle.writeFile.bind(handle);
    handle.writeFile = async () => {
      await realWriteFile('{"partial":');
      throw new Error("injected partial rollback write failure");
    };
  }
  return handle;
};
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  if (!installFailed && sourceName.startsWith(".manifest.json.aera-") && sourceName.endsWith(".install.tmp")) {
    installFailed = true;
    throw new Error("injected manifest install failure before partial rollback");
  }
  return realRename(source, destination);
};
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  if (name.startsWith(".versions.json.aera-") && name.endsWith(".rollback.preparing")) {
    throw new Error("injected partial rollback removal failure");
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
  );

  const failed = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const preparingPath = findNestedFile(
    directory,
    /^\.versions\.json\.aera-.+\.rollback\.preparing$/,
  );

  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /partial rollback write failure/);
  assert.match(failed.stderr, /partial rollback removal failure/);
  assert.ok(preparingPath, "the partial rollback preparation should be retained");

  rmSync(preloadPath, { force: true });
  const recovered = runCli(directory);

  assert.equal(recovered.status, 0, recovered.stderr);
  assert.doesNotThrow(() =>
    JSON.parse(readFileSync(join(directory, "versions.json"), "utf8")),
  );
  assert.deepEqual(readdirSync(directory).sort(), [
    "manifest.json",
    "package.json",
    "versions.json",
  ]);
});

test("stale recovery rejects an invalid ready rollback copy", (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "corrupt-ready-rollback.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";

const realRename = fs.promises.rename;
let installFailed = false;
let rollbackFailed = false;
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  const destinationName = basename(String(destination));
  if (!installFailed && sourceName.startsWith(".manifest.json.aera-") && sourceName.endsWith(".install.tmp")) {
    installFailed = true;
    throw new Error("injected manifest install failure for corrupt ready rollback");
  }
  if (!rollbackFailed && sourceName.startsWith(".versions.json.aera-") && sourceName.endsWith(".rollback.ready") && destinationName === "versions.json") {
    rollbackFailed = true;
    throw new Error("injected versions rollback failure before corruption");
  }
  return realRename(source, destination);
};
syncBuiltinESMExports();
`,
  );

  const failed = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const readyPath = findNestedFile(
    directory,
    /^\.versions\.json\.aera-.+\.rollback\.ready$/,
  );
  assert.equal(failed.status, 1);
  assert.ok(readyPath, "rollback failure should retain a ready original copy");
  writeFileSync(readyPath, '{"invalid":true}\n');
  rmSync(preloadPath, { force: true });

  const rejected = runCli(directory);

  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /invalid retained rollback|could not validate/i);
  assert.doesNotThrow(() =>
    JSON.parse(readFileSync(join(directory, "versions.json"), "utf8")),
  );
  assert.equal(existsSync(readyPath), true);
});

test("version bump CLI aggregates atomic install rollback and cleanup failures", (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "fail-renames.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname } from "node:path";

const realRename = fs.promises.rename;
const realRm = fs.promises.rm;
let installFailed = false;
let rollbackFailed = false;
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  const destinationName = basename(String(destination));
  if (!installFailed && sourceName.startsWith(".manifest.json.aera-") && sourceName.endsWith(".install.tmp")) {
    installFailed = true;
    throw new Error("injected manifest install failure");
  }
  if (!rollbackFailed && sourceName.startsWith(".versions.json.aera-") && sourceName.endsWith(".rollback.ready") && destinationName === "versions.json") {
    rollbackFailed = true;
    throw new Error("injected versions rollback failure");
  }
  return realRename(source, destination);
};
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  const parent = basename(dirname(String(path)));
  if (name.startsWith(".manifest.json.aera-") && name.endsWith(".install.tmp")) {
    throw new Error("injected install temporary cleanup failure");
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
  );

  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const temporaryPath = findNestedFile(
    directory,
    /^\.versions\.json\.aera-.+\.rollback\.ready$/,
  );
  const installTemporaryPath = findNestedFile(
    directory,
    /^\.manifest\.json\.aera-.+\.install\.tmp$/,
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /injected manifest install failure/);
  assert.match(result.stderr, /rollback.*injected versions rollback failure/i);
  assert.match(result.stderr, /install temporary cleanup failure/i);
  assert.match(result.stderr, /original contents retained at/i);
  assert.match(result.stderr, /workspace.*retained|ENOTEMPTY/i);
  assert.ok(temporaryPath, "failed cleanup should preserve the rollback temporary");
  assert.ok(
    installTemporaryPath,
    "failed cleanup should preserve the install temporary",
  );
  assert.match(
    result.stderr,
    new RegExp(basename(temporaryPath).replaceAll(".", "\\.")),
  );
  assert.equal(existsSync(join(directory, "manifest.json")), true);
  assert.equal(existsSync(join(directory, "versions.json")), true);
});

test("version bump CLI serializes concurrent calls in the same directory", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const results = await Promise.all(
    Array.from({ length: 24 }, () => runCliAsync(directory)),
  );

  for (const result of results) {
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Theme metadata version synchronized\n");
  }
  assert.equal(
    readFileSync(join(directory, "manifest.json"), "utf8"),
    `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(directory, "versions.json"), "utf8"),
    `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
  );
  assert.deepEqual(readdirSync(directory).sort(), [
    "manifest.json",
    "package.json",
    "versions.json",
  ]);
});
