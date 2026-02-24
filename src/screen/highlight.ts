import type { Cell, DefaultColors, HlAttr } from "./types.js";

function rgbToAnsi(rgb: number): string {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  return `${r};${g};${b}`;
}

function fgSequence(rgb: number): string {
  return `\x1b[38;2;${rgbToAnsi(rgb)}m`;
}

function bgSequence(rgb: number): string {
  return `\x1b[48;2;${rgbToAnsi(rgb)}m`;
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const ITALIC = "\x1b[3m";
const UNDERLINE = "\x1b[4m";
const UNDERCURL = "\x1b[4:3m";
const UNDERDOUBLE = "\x1b[4:2m";
const UNDERDOTTED = "\x1b[4:4m";
const UNDERDASHED = "\x1b[4:5m";
const STRIKETHROUGH = "\x1b[9m";

function buildAttrSequence(
  hlAttr: HlAttr | undefined,
  defaultColors: DefaultColors,
): string {
  let fg = hlAttr?.foreground ?? defaultColors.fg;
  let bg = hlAttr?.background ?? defaultColors.bg;

  if (hlAttr?.reverse) {
    [fg, bg] = [bg, fg];
  }

  let seq = fgSequence(fg) + bgSequence(bg);

  if (hlAttr?.bold) seq += BOLD;
  if (hlAttr?.italic) seq += ITALIC;
  if (hlAttr?.undercurl) seq += UNDERCURL;
  else if (hlAttr?.underdouble) seq += UNDERDOUBLE;
  else if (hlAttr?.underdotted) seq += UNDERDOTTED;
  else if (hlAttr?.underdashed) seq += UNDERDASHED;
  else if (hlAttr?.underline) seq += UNDERLINE;
  if (hlAttr?.strikethrough) seq += STRIKETHROUGH;

  // Set underline color if special color is defined
  if (
    hlAttr?.special !== undefined &&
    (hlAttr.underline ||
      hlAttr.undercurl ||
      hlAttr.underdouble ||
      hlAttr.underdotted ||
      hlAttr.underdashed)
  ) {
    seq += `\x1b[58;2;${rgbToAnsi(hlAttr.special)}m`;
  }

  return seq;
}

/**
 * Render a row of cells as a single ANSI-escaped string.
 * Only emits new escape sequences when the highlight changes between cells.
 */
export function renderRow(
  cells: Cell[],
  hlAttrs: Map<number, HlAttr>,
  defaultColors: DefaultColors,
): string {
  let result = "";
  let prevHlId = -1;

  for (const cell of cells) {
    if (cell.hlId !== prevHlId) {
      result += RESET;
      result += buildAttrSequence(hlAttrs.get(cell.hlId), defaultColors);
      prevHlId = cell.hlId;
    }
    // Empty string means right half of a wide character — render as space
    // because the wide char already occupies the visual width
    result += cell.text || " ";
  }

  result += RESET;
  return result;
}

/**
 * Render a row with cursor overlay.
 *
 * - block: invert fg/bg at cursor position (or use cursorAttr colors if provided)
 * - vertical: render a left-edge bar using Unicode left-half-block + underline
 * - horizontal: render an underline at cursor position
 *
 * When `cursorAttr` is provided (from mode_info_set attr_id), its colors
 * override the default cursor inversion behaviour.
 */
export function renderRowWithCursor(
  cells: Cell[],
  hlAttrs: Map<number, HlAttr>,
  defaultColors: DefaultColors,
  cursorCol: number,
  cursorShape: "block" | "horizontal" | "vertical" | undefined,
  cursorAttr?: HlAttr,
): string {
  let result = "";
  let prevHlId = -1;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;

    if (i === cursorCol) {
      // Render cursor cell with special styling
      result += RESET;
      const hlAttr = hlAttrs.get(cell.hlId);
      let cellFg = hlAttr?.foreground ?? defaultColors.fg;
      let cellBg = hlAttr?.background ?? defaultColors.bg;
      if (hlAttr?.reverse) {
        [cellFg, cellBg] = [cellBg, cellFg];
      }

      // If cursorAttr has explicit colors, use them instead of inversion.
      const hasCursorFg = cursorAttr?.foreground !== undefined;
      const hasCursorBg = cursorAttr?.background !== undefined;

      switch (cursorShape) {
        case "block": {
          // With cursor attr: use its fg/bg directly (falling back to
          // inverted cell colors for any unset component).
          const cFg = hasCursorFg ? cursorAttr!.foreground! : cellBg;
          const cBg = hasCursorBg ? cursorAttr!.background! : cellFg;
          result += fgSequence(cFg) + bgSequence(cBg);
          result += cell.text || " ";
          break;
        }
        case "horizontal": {
          const cFg = hasCursorFg ? cursorAttr!.foreground! : cellFg;
          const cBg = hasCursorBg ? cursorAttr!.background! : cellBg;
          result += fgSequence(cFg) + bgSequence(cBg) + UNDERLINE;
          result += cell.text || " ";
          break;
        }
        case "vertical":
        default: {
          const cFg = hasCursorFg ? cursorAttr!.foreground! : cellFg;
          const cBg = hasCursorBg ? cursorAttr!.background! : cellBg;
          result += fgSequence(cFg) + bgSequence(cBg) + UNDERLINE;
          result += cell.text || " ";
          break;
        }
      }

      prevHlId = -1; // Force re-emit on next cell
    } else {
      if (cell.hlId !== prevHlId) {
        result += RESET;
        result += buildAttrSequence(hlAttrs.get(cell.hlId), defaultColors);
        prevHlId = cell.hlId;
      }
      result += cell.text || " ";
    }
  }

  result += RESET;
  return result;
}
