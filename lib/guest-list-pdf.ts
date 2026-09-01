export type GuestListPdfEntry = {
  name: string;
  partySize: number;
  status: "attending" | "declined";
  additionalInformation: string;
};

export type GuestListPdfOptions = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  viewLabel: string;
  generatedAt?: Date;
  guests: GuestListPdfEntry[];
};

type PreparedEntry = GuestListPdfEntry & { number: number; nameLines: string[]; noteLines: string[]; height: number };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const TOP_OF_LIST = 580;
const BOTTOM_OF_LIST = 92;

function plainText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

function pdfString(value: string) {
  return plainText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(value: string, maxCharacters: number) {
  const words = plainText(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxCharacters) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > maxCharacters ? `${word.slice(0, maxCharacters - 3)}...` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function textWidth(value: string, size: number, style: "regular" | "italic" | "bold" = "regular") {
  const factor = style === "italic" ? 0.47 : style === "bold" ? 0.52 : 0.49;
  return plainText(value).length * size * factor;
}

function textCommand(value: string, x: number, y: number, size: number, font: string, color: string) {
  return `BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfString(value)}) Tj ET`;
}

function centeredText(value: string, y: number, size: number, font: string, color: string, style: "regular" | "italic" | "bold" = "regular") {
  const x = Math.max(42, (PAGE_WIDTH - textWidth(value, size, style)) / 2);
  return textCommand(value, x, y, size, font, color);
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  const k = 0.5522848;
  return `${(cx + rx).toFixed(2)} ${cy.toFixed(2)} m `
    + `${(cx + rx).toFixed(2)} ${(cy + k * ry).toFixed(2)} ${(cx + k * rx).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c `
    + `${(cx - k * rx).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy + k * ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c `
    + `${(cx - rx).toFixed(2)} ${(cy - k * ry).toFixed(2)} ${(cx - k * rx).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c `
    + `${(cx + k * rx).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy - k * ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c h`;
}

function flower(cx: number, cy: number, scale = 1) {
  const petals = [[0, 10], [9, 3], [6, -8], [-6, -8], [-9, 3]];
  const commands = ["q", "0.93 0.68 0.73 rg"];
  for (const [dx, dy] of petals) commands.push(`${ellipsePath(cx + dx * scale, cy + dy * scale, 6.3 * scale, 8.5 * scale)} f`);
  commands.push("0.78 0.61 0.31 rg", `${ellipsePath(cx, cy, 4.4 * scale, 4.4 * scale)} f`, "Q");
  return commands.join("\n");
}

function botanicalSprig(cx: number, cy: number, direction = 1) {
  return [
    "0.47 0.56 0.40 RG 1 w",
    `${cx} ${cy} m ${cx + 20 * direction} ${cy + 9} ${cx + 34 * direction} ${cy + 25} ${cx + 43 * direction} ${cy + 43} c S`,
    "0.58 0.65 0.49 rg",
    `${ellipsePath(cx + 13 * direction, cy + 8, 3.2, 7)} f`,
    `${ellipsePath(cx + 25 * direction, cy + 19, 3.4, 7.5)} f`,
    `${ellipsePath(cx + 35 * direction, cy + 31, 3.2, 7)} f`,
    "0.91 0.70 0.74 rg",
    `${ellipsePath(cx + 44 * direction, cy + 45, 3.2, 3.2)} f`,
  ].join("\n");
}

function pageDecoration(pageNumber: number, pageCount: number) {
  return [
    "1 0.985 0.94 rg 0 0 612 792 re f",
    "0.50 0.58 0.43 RG 2.2 w 27 25 558 742 re S",
    "0.88 0.62 0.68 RG 1.1 w 35 33 542 726 re S",
    "0.81 0.71 0.49 RG 0.7 w 41 39 530 714 re S",
    "0.50 0.58 0.43 RG 1.15 w 48 673 m 184 673 l S",
    "0.50 0.58 0.43 RG 1.15 w 428 673 m 564 673 l S",
    "0.88 0.62 0.68 RG 1.2 w 184 673 m 206 673 213 686 228 686 c 243 686 250 673 265 673 c S",
    "0.88 0.62 0.68 RG 1.2 w 428 673 m 406 673 399 686 384 686 c 369 686 362 673 347 673 c S",
    flower(52, 735, 0.9),
    flower(560, 57, 0.82),
    botanicalSprig(50, 50, 1),
    botanicalSprig(562, 726, -1),
    "0.50 0.58 0.43 RG 1.1 w 58 719 m 71 706 81 697 92 690 c S",
    "0.50 0.58 0.43 rg",
    `${ellipsePath(74, 706, 3.4, 7)} f`,
    `${ellipsePath(86, 696, 3.2, 6.5)} f`,
    centeredText(`Page ${pageNumber} of ${pageCount}`, 48, 8, "F5", "0.38 0.42 0.35"),
  ].join("\n");
}

function preparePages(guests: GuestListPdfEntry[]) {
  const prepared = guests.map((guest, index): PreparedEntry => {
    const nameLines = wrapText(guest.name || "Guest", 36).slice(0, 2);
    const noteLines = wrapText(guest.additionalInformation, 82).slice(0, 2);
    const height = 44 + Math.max(0, nameLines.length - 1) * 14 + Math.max(0, noteLines.length - 1) * 11;
    return { ...guest, number: index + 1, nameLines, noteLines, height };
  });
  const pages: PreparedEntry[][] = [[]];
  let y = TOP_OF_LIST;
  for (const guest of prepared) {
    if (pages.at(-1)!.length && y - guest.height < BOTTOM_OF_LIST) {
      pages.push([]);
      y = TOP_OF_LIST;
    }
    pages.at(-1)!.push(guest);
    y -= guest.height;
  }
  return pages;
}

function renderPage(options: GuestListPdfOptions, entries: PreparedEntry[], pageNumber: number, pageCount: number) {
  const attendingCount = options.guests.filter((guest) => guest.status === "attending").length;
  const totalPeople = options.guests.filter((guest) => guest.status === "attending").reduce((sum, guest) => sum + guest.partySize, 0);
  const eventLine = [options.eventDate, options.eventTime, options.venue].filter(Boolean).join("  -  ");
  const summary = `${options.guests.length} responses  -  ${attendingCount} attending  -  ${totalPeople} total guests`;
  const commands = [
    pageDecoration(pageNumber, pageCount),
    centeredText(options.eventName, 744, 16, "F3", "0.20 0.32 0.25", "bold"),
    centeredText("Guest List", 708, 28, "F2", "0.24 0.29 0.21", "italic"),
    centeredText("A royal roll of guests", 687, 11, "F2", "0.62 0.38 0.42", "italic"),
    centeredText(eventLine, 649, 8.5, "F1", "0.40 0.43 0.36"),
    centeredText(`${options.viewLabel}  -  ${summary}`, 632, 8, "F5", "0.47 0.45 0.40"),
    textCommand("GUEST NAME", 84, 606, 7, "F4", "0.42 0.43 0.36"),
    textCommand("RSVP", 411, 606, 7, "F4", "0.42 0.43 0.36"),
    textCommand("PARTY", 510, 606, 7, "F4", "0.42 0.43 0.36"),
    "0.65 0.55 0.39 RG 0.8 w 55 596 m 557 596 l S",
  ];

  if (!entries.length) {
    commands.push(centeredText("No guest responses in this view yet.", 405, 15, "F2", "0.42 0.45 0.39", "italic"));
    return commands.join("\n");
  }

  let y = TOP_OF_LIST;
  entries.forEach((guest) => {
    const status = guest.status === "attending" ? "ATTENDING" : "NOT GOING";
    const statusWidth = textWidth(status, 7.5, "bold");
    const statusX = 390 + (76 - statusWidth) / 2;
    const noteY = y - 19 - Math.max(0, guest.nameLines.length - 1) * 14;
    commands.push(
      guest.number % 2 === 0 ? "0.99 0.97 0.92 rg" : "1 0.99 0.96 rg",
      `54 ${(y - guest.height + 8).toFixed(2)} 504 ${(guest.height - 2).toFixed(2)} re f`,
      "0.87 0.80 0.65 rg",
      `${ellipsePath(64, y - 3, 12, 12)} f`,
      textCommand(String(guest.number), 60.5, y - 6, 8, "F5", "0.34 0.38 0.31"),
      guest.status === "attending" ? "0.92 0.96 0.91 rg" : "0.98 0.91 0.92 rg",
      `390 ${(y - 9).toFixed(2)} 76 22 re f`,
      textCommand(status, statusX, y - 1, 7.5, "F4", guest.status === "attending" ? "0.31 0.49 0.36" : "0.65 0.37 0.42"),
      textCommand(String(guest.partySize), 520, y, 10, "F4", "0.33 0.39 0.31"),
    );
    guest.nameLines.forEach((line, lineIndex) => {
      commands.push(textCommand(line, 84, y - lineIndex * 14, 12.5, "F4", "0.18 0.28 0.23"));
    });
    guest.noteLines.forEach((line, lineIndex) => {
      commands.push(textCommand(line, 84, noteY - lineIndex * 11, 8.5, "F1", "0.43 0.42 0.37"));
    });
    commands.push(`0.87 0.81 0.70 RG 0.55 w 84 ${(y - guest.height + 8).toFixed(2)} m 546 ${(y - guest.height + 8).toFixed(2)} l S`);
    y -= guest.height;
  });
  return commands.join("\n");
}

function pdfDate(date: Date) {
  const digits = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0"));
  return `D:${digits.join("")}Z`;
}

export function createGuestListPdf(options: GuestListPdfOptions) {
  const pages = preparePages(options.guests);
  const objects: string[] = [""];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>";
  objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[7] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  const pageObjects: number[] = [];
  pages.forEach((entries, index) => {
    const pageObject = 8 + index * 2;
    const contentObject = pageObject + 1;
    pageObjects.push(pageObject);
    const content = renderPage(options, entries, index + 1, pages.length);
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R /F5 7 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  const infoObject = objects.length;
  const createdAt = options.generatedAt || new Date();
  objects[infoObject] = `<< /Title (${pdfString(`${options.eventName} Guest List`)}) /Author (Argentum Studio) /Subject (Printable RSVP guest list) /Creator (Invitez) /CreationDate (${pdfDate(createdAt)}) >>`;

  let output = "%PDF-1.4\n%Invitez Guest Scroll\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = output.length;
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = output.length;
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}
