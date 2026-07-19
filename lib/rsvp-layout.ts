export const RSVP_LAYOUT_KEYS = ["name", "adults", "kids", "notes", "yes", "no", "submit", "countdown"] as const;

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
  name: { top: 74.1, left: 11.5, width: 42, height: 1.65, rotation: -15, fill: "transparent" },
  adults: { top: 76.2, left: 38.6, width: 14, height: 1.15, rotation: -15, fill: "transparent" },
  kids: { top: 77.45, left: 40, width: 14, height: 1.15, rotation: -15, fill: "transparent" },
  notes: { top: 74, left: 57, width: 41, height: 2.8, rotation: -15, fill: "transparent" },
  yes: { top: 73.6, left: 55.8, width: 6.7, height: 1.2, rotation: 0 },
  no: { top: 72.12, left: 77.5, width: 6.7, height: 1.2, rotation: 0 },
  submit: { top: 75.15, left: 77, width: 20, height: 1.9, rotation: -15, fill: "transparent" },
  countdown: { top: 92, left: 5.97, width: 80, height: 8, rotation: 0 },
};

const MINIMUM_SIZE: Record<RsvpLayoutKey, Pick<RsvpLayoutBox, "width" | "height">> = {
  name: { width: 8, height: 0.7 },
  adults: { width: 5, height: 0.7 },
  kids: { width: 5, height: 0.7 },
  notes: { width: 8, height: 0.7 },
  yes: { width: 3, height: 0.55 },
  no: { width: 3, height: 0.55 },
  submit: { width: 5, height: 0.7 },
  countdown: { width: 25, height: 4 },
};

const MAXIMUM_HEIGHT: Record<RsvpLayoutKey, number> = {
  name: 18,
  adults: 18,
  kids: 18,
  notes: 18,
  yes: 18,
  no: 18,
  submit: 18,
  countdown: 14,
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
  const usesPreviousCardLayout = !input.adults && !input.kids;
  const legacyTransparent = input.name?.fill === "transparent" && input.notes?.fill === "transparent";
  return Object.fromEntries(RSVP_LAYOUT_KEYS.map((key) => {
    const fallback = DEFAULT_RSVP_LAYOUT[key];
    const candidate = usesPreviousCardLayout && key !== "countdown" ? {} : input[key] || {};
    const usesPreviousCountdownDefault = key === "countdown"
      && [83.614, 84.614, 89.5, 90.25, 91.25].includes(finiteNumber(candidate.top, Number.NaN))
      && (finiteNumber(candidate.left, Number.NaN) === 4.61 || finiteNumber(candidate.left, Number.NaN) === 10 || finiteNumber(candidate.left, Number.NaN) === 11.36)
      && finiteNumber(candidate.width, Number.NaN) === 80
      && finiteNumber(candidate.height, Number.NaN) === 8;
    const source = usesPreviousCountdownDefault ? {} : candidate;
    const rawHeight = finiteNumber(source.height, fallback.height);
    const height = key === "countdown" && rawHeight > MAXIMUM_HEIGHT[key]
      ? fallback.height
      : rawHeight;
    const box: RsvpLayoutBox = {
      top: rounded(clamp(finiteNumber(source.top, fallback.top), 0, 98.5)),
      left: rounded(clamp(finiteNumber(source.left, fallback.left), -10, 105)),
      width: rounded(clamp(finiteNumber(source.width, fallback.width), MINIMUM_SIZE[key].width, 110)),
      height: rounded(clamp(height, MINIMUM_SIZE[key].height, MAXIMUM_HEIGHT[key])),
      rotation: rounded(clamp(finiteNumber(source.rotation, fallback.rotation), -45, 45)),
    };
    if (key === "name" || key === "adults" || key === "kids" || key === "notes" || key === "submit") {
      box.fill = source.fill === "transparent"
        || (source.fill === undefined && fallback.fill === "transparent")
        || (key === "submit" && source.fill === undefined && legacyTransparent)
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
    if (key === "name" || key === "adults" || key === "kids" || key === "notes" || key === "submit") {
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
