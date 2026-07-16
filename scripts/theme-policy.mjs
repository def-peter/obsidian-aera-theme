import postcss from "postcss";

const allowedKeys = new Set([
  "author",
  "authorUrl",
  "fundingUrl",
  "minAppVersion",
  "name",
  "version",
]);
const requiredKeys = ["author", "minAppVersion", "name", "version"];
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateManifest(manifest) {
  if (!isPlainObject(manifest)) {
    return ["manifest.json must be a plain object"];
  }

  const errors = [];

  for (const key of requiredKeys) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) {
      errors.push(`manifest.json requires ${key}`);
    }
  }

  for (const key of Object.keys(manifest)) {
    if (!allowedKeys.has(key)) {
      errors.push(`manifest.json does not support ${key}`);
    }
  }

  if (Object.hasOwn(manifest, "authorUrl") && typeof manifest.authorUrl !== "string") {
    errors.push("manifest.json authorUrl must be a string");
  }

  if (Object.hasOwn(manifest, "fundingUrl")) {
    const fundingUrlIsValid =
      typeof manifest.fundingUrl === "string" ||
      (isPlainObject(manifest.fundingUrl) &&
        Object.values(manifest.fundingUrl).every((value) => typeof value === "string"));
    if (!fundingUrlIsValid) {
      errors.push(
        "manifest.json fundingUrl must be a string or plain object with string values",
      );
    }
  }

  if (manifest.name !== "Aera") {
    errors.push("theme name must remain Aera");
  }
  if (!semver.test(manifest.version ?? "")) {
    errors.push("manifest version must use x.y.z");
  }
  if (!semver.test(manifest.minAppVersion ?? "")) {
    errors.push("minAppVersion must use x.y.z");
  }

  return errors;
}

export function validateVersions(manifest, versions) {
  if (!isPlainObject(versions)) {
    return ["versions.json must be a plain object"];
  }

  const errors = [];
  for (const [version, minAppVersion] of Object.entries(versions)) {
    if (!semver.test(version)) {
      errors.push(`versions.json version key ${version} must use x.y.z`);
    }
    if (typeof minAppVersion !== "string" || !semver.test(minAppVersion)) {
      errors.push(`versions.json minAppVersion for ${version} must use x.y.z`);
    }
  }

  const manifestVersion = manifest?.version;
  const manifestMinAppVersion = manifest?.minAppVersion;
  if (
    typeof manifestVersion !== "string" ||
    typeof manifestMinAppVersion !== "string" ||
    versions[manifestVersion] !== manifestMinAppVersion
  ) {
    errors.push("versions.json must map manifest version to minAppVersion");
  }

  return errors;
}

export function validateCss(css) {
  let root;
  try {
    root = postcss.parse(css, { from: "theme.css" });
  } catch (error) {
    return [`theme.css must contain valid CSS: ${error.reason ?? error.message}`];
  }

  const errors = new Set();
  const remoteUrl = /url\(\s*["']?\s*(?:https?:)?\/\//i;

  root.walkRules((rule) => {
    if (/:has\s*\(/i.test(rule.selector)) {
      errors.add("theme.css must not contain :has()");
    }
  });

  root.walkDecls((declaration) => {
    if (declaration.important) {
      errors.add("theme.css must not contain !important");
    }

    const property = declaration.prop;
    if (property === "--font-text-size") {
      errors.add("theme.css must not assign --font-text-size");
    }
    if (property === "--file-line-width") {
      errors.add("theme.css must not assign --file-line-width");
    }
    if (property === "--font-interface-theme") {
      errors.add("theme.css must not assign --font-interface-theme");
    }
    if (remoteUrl.test(declaration.value)) {
      errors.add("theme.css must not load a remote URL");
    }
  });

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() === "import") {
      errors.add("theme.css must not contain @import");
    }
  });

  root.walkComments((comment) => {
    if (/sourceMappingURL/i.test(comment.text)) {
      errors.add("theme.css must not contain source map references");
    }
  });

  return [...errors];
}

export function validateReleaseTag(manifest, tag) {
  return !tag || tag === manifest?.version
    ? []
    : [`release tag ${tag} must equal ${manifest?.version}`];
}
