import { realpathSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readlink,
  realpath,
  symlink,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
  return String(value).replace(/\s+/g, " ").trim();
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
    await symlink(repo, linkPath, "dir");
  }

  await Promise.all(
    fixtureNames.map((name) =>
      copyFile(join(repo, "fixtures", name), join(vault, name)),
    ),
  );

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
