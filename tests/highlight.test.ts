import { describe, it, expect } from "vitest";
import { renderRow, renderRowWithCursor } from "../src/screen/highlight.js";
import type { Cell, DefaultColors, HlAttr } from "../src/screen/types.js";

const RESET = "\x1b[0m";

function fg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

const defaults: DefaultColors = { fg: 0xffffff, bg: 0x000000, sp: 0xff0000 };

function makeCells(chars: string, hlId = 0): Cell[] {
  return chars.split("").map((text) => ({ text, hlId }));
}

// Strip ANSI to get visible text
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[^m]*m/g, "");
}

describe("renderRow", () => {
  it("renders plain text with default colors", () => {
    const cells = makeCells("Hello");
    const hlAttrs = new Map<number, HlAttr>();
    const result = renderRow(cells, hlAttrs, defaults);

    // Should contain the text
    expect(stripAnsi(result)).toBe("Hello");

    // Should start with RESET + fg/bg for default colors
    expect(result).toContain(fg(255, 255, 255));
    expect(result).toContain(bg(0, 0, 0));

    // Should end with RESET
    expect(result.endsWith(RESET)).toBe(true);
  });

  it("emits new color sequences only when hlId changes", () => {
    const cells: Cell[] = [
      { text: "a", hlId: 0 },
      { text: "b", hlId: 0 },
      { text: "c", hlId: 1 },
      { text: "d", hlId: 1 },
    ];
    const hlAttrs = new Map<number, HlAttr>([
      [1, { foreground: 0xff0000 }],
    ]);
    const result = renderRow(cells, hlAttrs, defaults);

    // Count RESET occurrences — one before first cell, one when hlId changes to 1, one at end
    const resets = result.split(RESET).length - 1;
    expect(resets).toBe(3);
  });

  it("renders cells with custom foreground color", () => {
    const cells = makeCells("AB", 1);
    const hlAttrs = new Map<number, HlAttr>([
      [1, { foreground: 0xff0000 }],
    ]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain(fg(255, 0, 0));
    expect(stripAnsi(result)).toBe("AB");
  });

  it("renders cells with custom background color", () => {
    const cells = makeCells("X", 2);
    const hlAttrs = new Map<number, HlAttr>([
      [2, { background: 0x00ff00 }],
    ]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain(bg(0, 255, 0));
  });

  it("handles reverse attribute by swapping fg and bg", () => {
    const cells = makeCells("R", 3);
    const hlAttrs = new Map<number, HlAttr>([
      [3, { foreground: 0xaaaaaa, background: 0x333333, reverse: true }],
    ]);
    const result = renderRow(cells, hlAttrs, defaults);
    // fg should be the background color, bg should be the foreground color
    expect(result).toContain(fg(0x33, 0x33, 0x33));
    expect(result).toContain(bg(0xaa, 0xaa, 0xaa));
  });

  it("includes bold escape sequence", () => {
    const cells = makeCells("B", 4);
    const hlAttrs = new Map<number, HlAttr>([[4, { bold: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[1m");
  });

  it("includes dim/faint escape sequence", () => {
    const cells = makeCells("D", 10);
    const hlAttrs = new Map<number, HlAttr>([[10, { dim: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[2m");
    expect(stripAnsi(result)).toBe("D");
  });

  it("combines dim with other attributes", () => {
    const cells = makeCells("X", 11);
    const hlAttrs = new Map<number, HlAttr>([[11, { dim: true, italic: true, foreground: 0x888888 }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[2m"); // dim
    expect(result).toContain("\x1b[3m"); // italic
    expect(result).toContain(fg(0x88, 0x88, 0x88));
  });

  it("includes italic escape sequence", () => {
    const cells = makeCells("I", 5);
    const hlAttrs = new Map<number, HlAttr>([[5, { italic: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[3m");
  });

  it("includes underline escape sequence", () => {
    const cells = makeCells("U", 6);
    const hlAttrs = new Map<number, HlAttr>([[6, { underline: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[4m");
  });

  it("includes undercurl escape sequence", () => {
    const cells = makeCells("C", 7);
    const hlAttrs = new Map<number, HlAttr>([[7, { undercurl: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[4:3m");
  });

  it("includes strikethrough escape sequence", () => {
    const cells = makeCells("S", 8);
    const hlAttrs = new Map<number, HlAttr>([[8, { strikethrough: true }]]);
    const result = renderRow(cells, hlAttrs, defaults);
    expect(result).toContain("\x1b[9m");
  });

  it("includes special color for underline styles", () => {
    const cells = makeCells("X", 9);
    const hlAttrs = new Map<number, HlAttr>([
      [9, { undercurl: true, special: 0x00ff00 }],
    ]);
    const result = renderRow(cells, hlAttrs, defaults);
    // Should have underline color escape: \x1b[58;2;R;G;Bm
    expect(result).toContain("\x1b[58;2;0;255;0m");
  });

  it("renders empty text cells as spaces (wide char right half)", () => {
    const cells: Cell[] = [
      { text: "漢", hlId: 0 },
      { text: "", hlId: 0 }, // right half of wide char
      { text: "x", hlId: 0 },
    ];
    const hlAttrs = new Map<number, HlAttr>();
    const result = stripAnsi(renderRow(cells, hlAttrs, defaults));
    expect(result).toBe("漢 x");
  });
});

describe("renderRowWithCursor", () => {
  const hlAttrs = new Map<number, HlAttr>();

  it("renders block cursor by inverting fg/bg", () => {
    const cells = makeCells("abc");
    const result = renderRowWithCursor(cells, hlAttrs, defaults, 1, "block");

    // The cell at index 1 ('b') should have inverted colors:
    // default fg=0xffffff, bg=0x000000 → cursor fg=0x000000, bg=0xffffff
    expect(result).toContain(fg(0, 0, 0));
    expect(result).toContain(bg(255, 255, 255));
    expect(stripAnsi(result)).toBe("abc");
  });

  it("renders horizontal cursor with underline", () => {
    const cells = makeCells("abc");
    const result = renderRowWithCursor(
      cells,
      hlAttrs,
      defaults,
      1,
      "horizontal",
    );
    // Should contain underline escape at the cursor position
    expect(result).toContain("\x1b[4m");
    expect(stripAnsi(result)).toBe("abc");
  });

  it("renders vertical cursor with left-eighth-block bar", () => {
    const cells = makeCells("abc");
    const result = renderRowWithCursor(
      cells,
      hlAttrs,
      defaults,
      1,
      "vertical",
    );
    // Vertical cursor replaces the cell char with ▏ (left-eighth-block)
    expect(stripAnsi(result)).toBe("a\u258fc");
    // Should use cell fg for the bar color, cell bg for background
    expect(result).toContain(fg(255, 255, 255)); // default fg
    expect(result).toContain(bg(0, 0, 0));       // default bg
    // Should NOT use underline anymore
    expect(result).not.toContain("\x1b[4m");
  });

  it("renders block cursor with custom highlight colors inverted", () => {
    const cells: Cell[] = [
      { text: "a", hlId: 0 },
      { text: "b", hlId: 1 },
      { text: "c", hlId: 0 },
    ];
    const attrs = new Map<number, HlAttr>([
      [1, { foreground: 0xff0000, background: 0x0000ff }],
    ]);
    const result = renderRowWithCursor(cells, attrs, defaults, 1, "block");
    // Cell 1 has fg=0xff0000, bg=0x0000ff → inverted: fg=0x0000ff, bg=0xff0000
    expect(result).toContain(fg(0, 0, 255));
    expect(result).toContain(bg(255, 0, 0));
  });

  it("handles cursor at first column", () => {
    const cells = makeCells("xyz");
    const result = renderRowWithCursor(cells, hlAttrs, defaults, 0, "block");
    expect(stripAnsi(result)).toBe("xyz");
  });

  it("handles cursor at last column", () => {
    const cells = makeCells("xyz");
    const result = renderRowWithCursor(cells, hlAttrs, defaults, 2, "block");
    expect(stripAnsi(result)).toBe("xyz");
  });

  it("handles reverse highlight + block cursor (double invert)", () => {
    const cells: Cell[] = [{ text: "R", hlId: 1 }];
    const attrs = new Map<number, HlAttr>([
      [1, { foreground: 0xaa0000, background: 0x00aa00, reverse: true }],
    ]);
    // reverse swaps: fg becomes 0x00aa00, bg becomes 0xaa0000
    // then block cursor inverts again: fg=0xaa0000, bg=0x00aa00
    const result = renderRowWithCursor(cells, attrs, defaults, 0, "block");
    expect(result).toContain(fg(0xaa, 0, 0));
    expect(result).toContain(bg(0, 0xaa, 0));
  });

  it("block cursor uses cursorAttr fg/bg when provided", () => {
    const cells = makeCells("abc");
    const cursorAttr: HlAttr = { foreground: 0x111111, background: 0x222222 };
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "block", cursorAttr,
    );
    // cursorAttr provides explicit colors — should use them directly
    expect(result).toContain(fg(0x11, 0x11, 0x11));
    expect(result).toContain(bg(0x22, 0x22, 0x22));
    expect(stripAnsi(result)).toBe("abc");
  });

  it("block cursor uses cursorAttr bg only, falls back to cell bg for fg", () => {
    const cells = makeCells("abc");
    // Only background set — fg should fall back to inverted cell bg (0x000000)
    const cursorAttr: HlAttr = { background: 0x00ff00 };
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "block", cursorAttr,
    );
    expect(result).toContain(bg(0, 255, 0)); // cursorAttr bg
    expect(result).toContain(fg(0, 0, 0));   // cell bg as fallback fg
  });

  it("block cursor uses cursorAttr fg only, falls back to cell fg for bg", () => {
    const cells = makeCells("abc");
    const cursorAttr: HlAttr = { foreground: 0xff0000 };
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "block", cursorAttr,
    );
    expect(result).toContain(fg(255, 0, 0));   // cursorAttr fg
    expect(result).toContain(bg(255, 255, 255)); // cell fg as fallback bg
  });

  it("horizontal cursor uses cursorAttr colors when provided", () => {
    const cells = makeCells("abc");
    const cursorAttr: HlAttr = { foreground: 0xaabbcc, background: 0x112233 };
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "horizontal", cursorAttr,
    );
    expect(result).toContain(fg(0xaa, 0xbb, 0xcc));
    expect(result).toContain(bg(0x11, 0x22, 0x33));
    expect(result).toContain("\x1b[4m"); // underline still present
  });

  it("vertical cursor at first column renders bar", () => {
    const cells = makeCells("xyz");
    const result = renderRowWithCursor(cells, hlAttrs, defaults, 0, "vertical");
    expect(stripAnsi(result)).toBe("\u258fyz");
  });

  it("vertical cursor at last column renders bar", () => {
    const cells = makeCells("xyz");
    const result = renderRowWithCursor(cells, hlAttrs, defaults, 2, "vertical");
    expect(stripAnsi(result)).toBe("xy\u258f");
  });

  it("vertical cursor uses cursorAttr fg for bar color", () => {
    const cells = makeCells("abc");
    const cursorAttr: HlAttr = { foreground: 0x336699 };
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "vertical", cursorAttr,
    );
    // cursorAttr fg should be used for the bar character color
    expect(result).toContain(fg(0x33, 0x66, 0x99));
    expect(stripAnsi(result)).toBe("a\u258fc");
  });

  it("cursorAttr=undefined falls back to default inversion", () => {
    const cells = makeCells("abc");
    const result = renderRowWithCursor(
      cells, hlAttrs, defaults, 1, "block", undefined,
    );
    // Same as no cursorAttr: inverts default fg/bg
    expect(result).toContain(fg(0, 0, 0));       // default bg as cursor fg
    expect(result).toContain(bg(255, 255, 255));  // default fg as cursor bg
  });
});
