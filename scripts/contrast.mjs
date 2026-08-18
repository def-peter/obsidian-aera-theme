import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CORE_CONTRAST_PAIRS = [
  ["light text", "#1f1f1f", "#f8fafc"],
  ["light muted", "#647184", "#f8fafc"],
  ["light text accent", "#005ee2", "#f8fafc"],
  ["dark text", "#dcdcdc", "#17191c"],
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

const CALLOUT_SURFACE_COLORS = {
  note: ["#f3ad61", "#c2410c", "#fb923c"],
  abstract: ["#00a6ed", "#046fa6", "#38bdf8"],
  todo: ["#785dc8", "#704bc6", "#a78bfa"],
  tip: ["#f9c23c", "#c24200", "#facc15"],
  success: ["#6dd534", "#197a35", "#86d94f"],
  question: ["#f8312f", "#c12730", "#ff7b72"],
  warning: ["#ffb02e", "#c24200", "#fbbf24"],
  error: ["#f8312f", "#c12730", "#ff7b72"],
  example: ["#7852ee", "#704bc6", "#a78bfa"],
  quote: ["#9b9b9b", "#5f6b78", "#b8c0cc"],
};

const CALLOUT_THEME_CONFIG = {
  light: {
    base: "#ffffff",
    normal: "#1f1f1f",
    backgroundTint: 0.16,
    bodyMixColor: "#ffffff",
    bodyColorWeight: 0.79,
    textIndex: 1,
  },
  dark: {
    base: "#20242a",
    normal: "#dcdcdc",
    backgroundTint: 0.12,
    bodyMixColor: "#20242a",
    bodyColorWeight: 0.68,
    textIndex: 2,
  },
};

export const CALLOUT_CONTRAST_PAIRS = Object.entries(CALLOUT_THEME_CONFIG)
  .flatMap(([theme, config]) => {
    return Object.entries(CALLOUT_SURFACE_COLORS).flatMap(([type, colors]) => {
      const [surface] = colors;
      const title = colors[config.textIndex];
      const background = mixHex(
        surface,
        config.base,
        config.backgroundTint,
      );

      return [
        [
          `${theme} callout ${type} title`,
          title,
          background,
        ],
        [
          `${theme} callout ${type} content`,
          mixHex(title, config.bodyMixColor, config.bodyColorWeight),
          background,
          3,
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

  for (const [name, foreground, background, minimumRatio = 4.5] of pairs) {
    const ratio = contrastRatio(foreground, background);
    const status = ratio >= minimumRatio ? "PASS" : "FAIL";
    writeLine(
      `${status} ${name}: ${ratio.toFixed(2)}:1 (${foreground} on ${background})`,
    );
    failed ||= ratio < minimumRatio;
  }

  if (failed) process.exitCode = 1;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (isDirectRun) {
  runContrastCli();
}
