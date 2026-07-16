import { pathToFileURL } from "node:url";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CORE_CONTRAST_PAIRS = [
  ["light text", "#28302c", "#f7f8f6"],
  ["light muted", "#68756d", "#f7f8f6"],
  ["light accent", "#3f725b", "#f7f8f6"],
  ["dark text", "#dce4df", "#171c19"],
  ["dark muted", "#95a39b", "#171c19"],
  ["dark accent", "#76b795", "#171c19"],
];

function rgbChannels(hex) {
  if (typeof hex !== "string" || !HEX_COLOR.test(hex)) {
    throw new TypeError(`Invalid hex color: ${String(hex)}`);
  }

  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function linearize(channel) {
  const srgb = channel / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const [red, green, blue] = rgbChannels(hex).map(linearize);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function runContrastCli(
  pairs = CORE_CONTRAST_PAIRS,
  writeLine = (line) => console.log(line),
) {
  let failed = false;

  for (const [name, foreground, background] of pairs) {
    const ratio = contrastRatio(foreground, background);
    const status = ratio >= 4.5 ? "PASS" : "FAIL";
    writeLine(
      `${status} ${name}: ${ratio.toFixed(2)}:1 (${foreground} on ${background})`,
    );
    failed ||= ratio < 4.5;
  }

  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runContrastCli();
}
