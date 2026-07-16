export const RSVP_LAYOUT_KEYS = ["name", "notes", "yes", "no", "submit"] as const;

export type RsvpLayoutKey = (typeof RSVP_LAYOUT_KEYS)[number];

export type RsvpLayoutBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type RsvpLayout = Record<RsvpLayoutKey, RsvpLayoutBox>;

export const DEFAULT_RSVP_LAYOUT: RsvpLayout = {
  name: { top: 74.8, left: 14, width: 40, height: 1.6 },
  notes: { top: 77.55, left: 19, width: 61, height: 1.6 },
  yes: { top: 73.6, left: 55.8, width: 6.7, height: 1.2 },
  no: { top: 72.12, left: 77.5, width: 6.7, height: 1.2 },
  submit: { top: 74.8, left: 83.5, width: 24, height: 1.8 },
};

const MINIMUM_SIZE: Record<RsvpLayoutKey, Pick<RsvpLayoutBox, "width" | "height">> = {
  name: { width: 8, height: 0.7 },
  notes: { width: 8, height: 0.7 },
  yes: { width: 3, height: 0.55 },
  no: { width: 3, height: 0.55 },
  submit: { width: 5, height: 0.7 },
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
  return Object.fromEntries(RSVP_LAYOUT_KEYS.map((key) => {
    const fallback = DEFAULT_RSVP_LAYOUT[key];
    const candidate = input[key] || {};
    return [key, {
      top: rounded(clamp(finiteNumber(candidate.top, fallback.top), 0, 98.5)),
      left: rounded(clamp(finiteNumber(candidate.left, fallback.left), -10, 105)),
      width: rounded(clamp(finiteNumber(candidate.width, fallback.width), MINIMUM_SIZE[key].width, 110)),
      height: rounded(clamp(finiteNumber(candidate.height, fallback.height), MINIMUM_SIZE[key].height, 18)),
    }];
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
  }
  return variables;
}
