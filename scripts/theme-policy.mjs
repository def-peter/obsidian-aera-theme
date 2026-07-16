const allowedKeys = new Set([
  "author",
  "authorUrl",
  "fundingUrl",
  "minAppVersion",
  "name",
  "version",
]);
const semver = /^\d+\.\d+\.\d+$/;

export function validateManifest(manifest) {
  const errors = [];

  for (const key of ["author", "minAppVersion", "name", "version"]) {
    if (typeof manifest[key] !== "string" || !manifest[key]) {
      errors.push(`manifest.json requires ${key}`);
    }
  }

  for (const key of Object.keys(manifest)) {
    if (!allowedKeys.has(key)) {
      errors.push(`manifest.json does not support ${key}`);
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
  return versions[manifest.version] === manifest.minAppVersion
    ? []
    : ["versions.json must map manifest version to minAppVersion"];
}

export function validateCss(css) {
  const checks = [
    [/!important\b/i, "theme.css must not contain !important"],
    [/:has\s*\(/i, "theme.css must not contain :has()"],
    [/url\(\s*["']?https?:/i, "theme.css must not load a remote URL"],
    [/--font-text-size\s*:/i, "theme.css must not assign --font-text-size"],
    [/--file-line-width\s*:/i, "theme.css must not assign --file-line-width"],
    [
      /--font-interface-theme\s*:/i,
      "theme.css must not assign --font-interface-theme",
    ],
    [/sourceMappingURL/i, "theme.css must not contain source map references"],
  ];

  return checks
    .filter(([pattern]) => pattern.test(css))
    .map(([, message]) => message);
}

export function validateReleaseTag(manifest, tag) {
  return !tag || tag === manifest.version
    ? []
    : [`release tag ${tag} must equal ${manifest.version}`];
}
