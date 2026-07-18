export const RSVP_LAYOUT_KEYS = ["name", "notes", "yes", "no", "submit", "countdown"] as const;

export type RsvpLayoutKey = (typeof RSVP_LAYOUT_KEYS)[number];

export type RsvpLayoutBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  rotation: number;
  fill?: "yellow" | "transparent";
};

export type RsvpLayout = Record<RsvpLayoutKey, RsvpLayoutBox>;

export const DEFAULT_RSVP_LAYOUT: RsvpLayout = {
  name: { top: 74.8, left: 14, width: 40, height: 1.6, rotation: -15, fill: "yellow" },
  notes: { top: 77.55, left: 19, width: 61, height: 1.6, rotation: -15, fill: "yellow" },
  yes: { top: 73.6, left: 55.8, width: 6.7, height: 1.2, rotation: 0 },
  no: { top: 72.12, left: 77.5, width: 6.7, height: 1.2, rotation: 0 },
  submit: { top: 74.8, left: 83.5, width: 24, height: 1.8, rotation: -15, fill: "yellow" },
  countdown: { top: 80.5, left: 10, width: 80, height: 17, rotation: 0 },
};

const MINIMUM_SIZE: Record<RsvpLayoutKey, Pick<RsvpLayoutBox, "width" | "height">> = {
  name: { width: 8, height: 0.7 },
  notes: { width: 8, height: 0.7 },
  yes: { width: 3, height: 0.55 },
  no: { width: 3, height: 0.55 },
  submit: { width: 5, height: 0.7 },
  countdown: { width: 25, height: 4 },
};

const MAXIMUM_HEIGHT: Record<RsvpLayoutKey, number> = {
  name: 18,
  notes: 18,
  yes: 18,
  no: 18,
  submit: 18,
  countdown: 32,
};

function finiteNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function normalizeRsvpLayout(value: unknown): RsvpLayout {
  const input = value && typeof value === "object" ? value as Partial<Record<RsvpLayoutKey, Partial<RsvpLayoutBox>>> : {};
  const legacyTransparent = input.name?.fill === "transparent" && input.notes?.fill === "transparent";
  return Object.fromEntries(RSVP_LAYOUT_KEYS.map((key) => {
    const fallback = DEFAULT_RSVP_LAYOUT[key];
    const candidate = input[key] || {};
    const box: RsvpLayoutBox = {
      top: rounded(clamp(finiteNumber(candidate.top, fallback.top), 0, 98.5)),
      left: rounded(clamp(finiteNumber(candidate.left, fallback.left), -10, 105)),
      width: rounded(clamp(finiteNumber(candidate.width, fallback.width), MINIMUM_SIZE[key].width, 110)),
      height: rounded(clamp(finiteNumber(candidate.height, fallback.height), MINIMUM_SIZE[key].height, MAXIMUM_HEIGHT[key])),
      rotation: rounded(clamp(finiteNumber(candidate.rotation, fallback.rotation), -45, 45)),
    };
    if (key === "name" || key === "notes" || key === "submit") {
      box.fill = candidate.fill === "transparent" || (key === "submit" && candidate.fill === undefined && legacyTransparent)
        ? "transparent"
        : "yellow";
    }
    return [key, box];
  })) as RsvpLayout;
}

export function rsvpLayoutVariables(layout: RsvpLayout) {
  const variables: Record<string, string> = {};
  for (const key of RSVP_LAYOUT_KEYS) {
    const box = layout[key];
    variables[`--rsvp-${key}-top`] = `${box.top}%`;
    variables[`--rsvp-${key}-left`] = `${box.left}%`;
    variables[`--rsvp-${key}-width`] = `${box.width}%`;
    variables[`--rsvp-${key}-height`] = `${box.height}%`;
    variables[`--rsvp-${key}-rotation`] = `${box.rotation}deg`;
    if (key === "name" || key === "notes" || key === "submit") {
      const transparent = box.fill === "transparent";
      variables[`--rsvp-${key}-background`] = transparent ? "transparent" : "rgba(255, 212, 0, 0.58)";
      variables[`--rsvp-${key}-border`] = transparent ? "transparent" : "#ffd400";
      variables[`--rsvp-${key}-shadow`] = transparent ? "none" : "0 0 0 2px rgba(255, 255, 255, 0.72)";
      variables[`--rsvp-${key}-focus-background`] = transparent ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 226, 70, 0.76)";
      variables[`--rsvp-${key}-focus-border`] = transparent ? "rgba(36, 59, 49, 0.58)" : "#ffb000";
      variables[`--rsvp-${key}-focus-shadow`] = transparent ? "0 0 0 2px rgba(255, 255, 255, 0.65)" : "0 0 0 3px rgba(255, 176, 0, 0.32)";
    }
  }
  return variables;
}
