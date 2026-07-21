import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CORE_CONTRAST_PAIRS = [
  ["light text", "#202936", "#f8fafc"],
  ["light muted", "#647184", "#f8fafc"],
  ["light text accent", "#005ee2", "#f8fafc"],
  ["dark text", "#e7ebf0", "#17191c"],
  ["dark muted", "#9aa5b4", "#17191c"],
  ["dark text accent", "#4096ff", "#17191c"],
  ["light inline code", "#5d697b", "#e5e9ee"],
  ["dark inline code", "#c1c7d0", "#30363e"],
  ["monokai normal", "#f8f8f2", "#272822"],
  ["monokai comment", "#929388", "#272822"],
  ["monokai keyword", "#ff4b8b", "#272822"],
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

function mixHex(foreground, background, foregroundWeight) {
  const channels = rgbChannels(foreground).map((channel, index) =>
    Math.round(
      channel * foregroundWeight +
        rgbChannels(background)[index] * (1 - foregroundWeight),
    ),
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const CALLOUT_TYPE_COLORS = {
  light: {
    note: "#086ddd",
    warning: "#ec7500",
    error: "#e93147",
    example: "#7852ee",
    quote: "#9e9e9e",
    tip: "#00bfbc",
    success: "#08b94e",
  },
  dark: {
    note: "#027aff",
    warning: "#e9973f",
    error: "#fb464c",
    example: "#a882ff",
    quote: "#9e9e9e",
    tip: "#53dfdd",
    success: "#44cf6e",
  },
};

const CALLOUT_THEME_CONFIG = {
  light: {
    base: "#f8fafc",
    normal: "#202936",
    backgroundOpacity: 0.08,
    titleWeight: 0.54,
    bodyWeight: 0.54,
    typeWeights: {
      note: 0.64,
      warning: 0.6,
      error: 0.64,
      example: 0.64,
      quote: 0.58,
      tip: 0.54,
      success: 0.58,
    },
  },
  dark: {
    base: "#17191c",
    normal: "#e7ebf0",
    backgroundOpacity: 0.12,
    titleWeight: 0.76,
    bodyWeight: 0.66,
  },
};

export const CALLOUT_CONTRAST_PAIRS = Object.entries(CALLOUT_TYPE_COLORS)
  .flatMap(([theme, types]) => {
    const config = CALLOUT_THEME_CONFIG[theme];

    return Object.entries(types).flatMap(([type, semantic]) => {
      const typeWeight = config.typeWeights?.[type];
      const background = mixHex(
        semantic,
        config.base,
        config.backgroundOpacity,
      );

      return [
        [
          `${theme} callout ${type} title`,
          mixHex(semantic, config.normal, typeWeight ?? config.titleWeight),
          background,
        ],
        [
          `${theme} callout ${type} content`,
          mixHex(semantic, config.normal, typeWeight ?? config.bodyWeight),
          background,
        ],
      ];
    });
  });

export const ALL_CONTRAST_PAIRS = [
  ...CORE_CONTRAST_PAIRS,
  ...CALLOUT_CONTRAST_PAIRS,
];

export function runContrastCli(
  pairs = ALL_CONTRAST_PAIRS,
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

const isDirectRun =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isDirectRun) {
  runContrastCli();
}
