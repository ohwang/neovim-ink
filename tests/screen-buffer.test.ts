import { describe, it, expect, beforeEach } from "vitest";
import { ScreenBuffer } from "../src/screen/screen-buffer.js";

// Helper to extract row text
function rowText(screen: ScreenBuffer, row: number): string {
  return screen.cells[row]!.map((c) => c.text).join("").trimEnd();
}

describe("ScreenBuffer", () => {
  let screen: ScreenBuffer;

  beforeEach(() => {
    screen = new ScreenBuffer(10, 5);
  });

  describe("constructor", () => {
    it("creates a grid of the correct dimensions", () => {
      expect(screen.width).toBe(10);
      expect(screen.height).toBe(5);
      expect(screen.cells.length).toBe(5);
      expect(screen.cells[0]!.length).toBe(10);
    });

    it("initializes all cells as spaces with hlId 0", () => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 10; c++) {
          expect(screen.cells[r]![c]).toEqual({ text: " ", hlId: 0 });
        }
      }
    });

    it("initializes cursor at origin", () => {
      expect(screen.cursor).toEqual({
        grid: 1,
        row: 0,
        col: 0,
        modeIdx: 0,
        visible: true,
      });
    });

    it("initializes default colors", () => {
      expect(screen.defaultColors).toEqual({
        fg: 0xffffff,
        bg: 0x000000,
        sp: 0xff0000,
      });
    });
  });

  describe("gridLine", () => {
    it("writes simple text cells", () => {
      // Neovim sends: [text, hlId?, repeat?]
      screen.gridLine(1, 0, 0, [["H"], ["e"], ["l"], ["l"], ["o"]]);
      expect(rowText(screen, 0)).toBe("Hello");
    });

    it("uses last hlId when omitted", () => {
      screen.gridLine(1, 0, 0, [["a", 5], ["b"], ["c"]]);
      expect(screen.cells[0]![0]).toEqual({ text: "a", hlId: 5 });
      expect(screen.cells[0]![1]).toEqual({ text: "b", hlId: 5 });
      expect(screen.cells[0]![2]).toEqual({ text: "c", hlId: 5 });
    });

    it("handles repeat counts", () => {
      screen.gridLine(1, 0, 0, [["x", 0, 5]]);
      for (let i = 0; i < 5; i++) {
        expect(screen.cells[0]![i]).toEqual({ text: "x", hlId: 0 });
      }
      expect(screen.cells[0]![5]).toEqual({ text: " ", hlId: 0 });
    });

    it("writes at an offset column", () => {
      screen.gridLine(1, 0, 3, [["A"], ["B"]]);
      expect(screen.cells[0]![2]).toEqual({ text: " ", hlId: 0 });
      expect(screen.cells[0]![3]).toEqual({ text: "A", hlId: 0 });
      expect(screen.cells[0]![4]).toEqual({ text: "B", hlId: 0 });
    });

    it("does not overflow past grid width", () => {
      screen.gridLine(1, 0, 8, [["A"], ["B"], ["C"], ["D"]]);
      expect(screen.cells[0]![8]).toEqual({ text: "A", hlId: 0 });
      expect(screen.cells[0]![9]).toEqual({ text: "B", hlId: 0 });
      // C and D exceed width=10, should be silently dropped
    });

    it("fills repeated spaces (common for clearing line tails)", () => {
      screen.gridLine(1, 0, 0, [["H"], ["i"], [" ", 0, 8]]);
      expect(rowText(screen, 0)).toBe("Hi");
    });

    it("marks the row as dirty", () => {
      screen.dirtyRows.clear();
      screen.gridLine(1, 2, 0, [["x"]]);
      expect(screen.dirtyRows.has(2)).toBe(true);
      expect(screen.dirtyRows.has(0)).toBe(false);
    });
  });

  describe("gridCursorGoto", () => {
    it("updates cursor position", () => {
      screen.gridCursorGoto(1, 3, 7);
      expect(screen.cursor.row).toBe(3);
      expect(screen.cursor.col).toBe(7);
    });
  });

  describe("gridClear", () => {
    it("resets all cells to spaces", () => {
      screen.gridLine(1, 0, 0, [["H"], ["i"]]);
      screen.gridClear(1);
      for (let r = 0; r < screen.height; r++) {
        expect(rowText(screen, r)).toBe("");
      }
    });

    it("marks all rows dirty", () => {
      screen.dirtyRows.clear();
      screen.gridClear(1);
      for (let r = 0; r < screen.height; r++) {
        expect(screen.dirtyRows.has(r)).toBe(true);
      }
    });
  });

  describe("gridResize", () => {
    it("grows the grid", () => {
      screen.gridResize(1, 15, 8);
      expect(screen.width).toBe(15);
      expect(screen.height).toBe(8);
      expect(screen.cells.length).toBe(8);
      expect(screen.cells[0]!.length).toBe(15);
      expect(screen.cells[7]!.length).toBe(15);
    });

    it("shrinks the grid", () => {
      screen.gridResize(1, 5, 3);
      expect(screen.width).toBe(5);
      expect(screen.height).toBe(3);
      expect(screen.cells.length).toBe(3);
      expect(screen.cells[0]!.length).toBe(5);
    });

    it("preserves existing content when growing", () => {
      screen.gridLine(1, 0, 0, [["A"], ["B"]]);
      screen.gridResize(1, 15, 8);
      expect(screen.cells[0]![0]).toEqual({ text: "A", hlId: 0 });
      expect(screen.cells[0]![1]).toEqual({ text: "B", hlId: 0 });
    });

    it("marks all rows dirty on resize", () => {
      screen.dirtyRows.clear();
      screen.gridResize(1, 12, 6);
      for (let r = 0; r < 6; r++) {
        expect(screen.dirtyRows.has(r)).toBe(true);
      }
    });
  });

  describe("gridScroll", () => {
    beforeEach(() => {
      // Fill rows with identifiable content
      for (let r = 0; r < 5; r++) {
        screen.gridLine(1, r, 0, [[`${r}`, 0, 10]]);
      }
    });

    it("scrolls up by 1 row", () => {
      // Scroll up: rows=1 means row 1 moves to row 0, etc.
      screen.gridScroll(1, 0, 5, 0, 10, 1);
      expect(screen.cells[0]![0]!.text).toBe("1");
      expect(screen.cells[1]![0]!.text).toBe("2");
      expect(screen.cells[2]![0]!.text).toBe("3");
      expect(screen.cells[3]![0]!.text).toBe("4");
      // Bottom row is cleared
      expect(screen.cells[4]![0]!.text).toBe(" ");
    });

    it("scrolls up by 2 rows", () => {
      screen.gridScroll(1, 0, 5, 0, 10, 2);
      expect(screen.cells[0]![0]!.text).toBe("2");
      expect(screen.cells[1]![0]!.text).toBe("3");
      expect(screen.cells[2]![0]!.text).toBe("4");
      // Bottom 2 rows cleared
      expect(screen.cells[3]![0]!.text).toBe(" ");
      expect(screen.cells[4]![0]!.text).toBe(" ");
    });

    it("scrolls down by 1 row", () => {
      // Scroll down: rows=-1 means row 3 moves to row 4, etc.
      screen.gridScroll(1, 0, 5, 0, 10, -1);
      // Top row is cleared
      expect(screen.cells[0]![0]!.text).toBe(" ");
      expect(screen.cells[1]![0]!.text).toBe("0");
      expect(screen.cells[2]![0]!.text).toBe("1");
      expect(screen.cells[3]![0]!.text).toBe("2");
      expect(screen.cells[4]![0]!.text).toBe("3");
    });

    it("scrolls a partial region", () => {
      // Scroll only rows 1-3 up by 1
      screen.gridScroll(1, 1, 4, 0, 10, 1);
      expect(screen.cells[0]![0]!.text).toBe("0"); // untouched
      expect(screen.cells[1]![0]!.text).toBe("2"); // moved up
      expect(screen.cells[2]![0]!.text).toBe("3"); // moved up
      expect(screen.cells[3]![0]!.text).toBe(" "); // cleared
      expect(screen.cells[4]![0]!.text).toBe("4"); // untouched
    });

    it("scrolls a partial column range", () => {
      // Scroll only columns 2-7 of all rows up by 1
      screen.gridLine(1, 0, 0, [["A", 0, 10]]);
      screen.gridLine(1, 1, 0, [["B", 0, 10]]);
      screen.gridScroll(1, 0, 5, 2, 7, 1);
      // Columns 0-1 untouched on row 0
      expect(screen.cells[0]![0]!.text).toBe("A");
      expect(screen.cells[0]![1]!.text).toBe("A");
      // Columns 2-6 on row 0 should have row 1's content
      expect(screen.cells[0]![2]!.text).toBe("B");
      expect(screen.cells[0]![6]!.text).toBe("B");
      // Columns 7-9 untouched on row 0
      expect(screen.cells[0]![7]!.text).toBe("A");
    });

    it("marks scrolled rows as dirty", () => {
      screen.dirtyRows.clear();
      screen.gridScroll(1, 1, 4, 0, 10, 1);
      expect(screen.dirtyRows.has(0)).toBe(false); // outside region
      expect(screen.dirtyRows.has(1)).toBe(true);
      expect(screen.dirtyRows.has(2)).toBe(true);
      expect(screen.dirtyRows.has(3)).toBe(true); // cleared row
      expect(screen.dirtyRows.has(4)).toBe(false); // outside region
    });
  });

  describe("hlAttrDefine", () => {
    it("stores highlight attributes from a plain object", () => {
      screen.hlAttrDefine(1, { foreground: 0xff0000, bold: true });
      const attr = screen.hlAttrs.get(1);
      expect(attr).toEqual({ foreground: 0xff0000, bold: true });
    });

    it("stores highlight attributes from a Map", () => {
      const map = new Map<string, unknown>([
        ["foreground", 0x00ff00],
        ["italic", true],
        ["special", 0x0000ff],
        ["undercurl", true],
      ]);
      screen.hlAttrDefine(2, map as unknown as Record<string, unknown>);
      const attr = screen.hlAttrs.get(2);
      expect(attr).toEqual({
        foreground: 0x00ff00,
        italic: true,
        special: 0x0000ff,
        undercurl: true,
      });
    });

    it("overwrites previous attributes for the same id", () => {
      screen.hlAttrDefine(5, { bold: true });
      screen.hlAttrDefine(5, { italic: true });
      expect(screen.hlAttrs.get(5)).toEqual({ italic: true });
    });

    it("handles empty attribute object", () => {
      screen.hlAttrDefine(10, {});
      expect(screen.hlAttrs.get(10)).toEqual({});
    });

    it("stores all supported attributes", () => {
      screen.hlAttrDefine(3, {
        foreground: 1,
        background: 2,
        special: 3,
        reverse: true,
        italic: true,
        bold: true,
        strikethrough: true,
        dim: true,
        underline: true,
        undercurl: true,
        underdouble: true,
        underdotted: true,
        underdashed: true,
        blend: 50,
      });
      expect(screen.hlAttrs.get(3)).toEqual({
        foreground: 1,
        background: 2,
        special: 3,
        reverse: true,
        italic: true,
        bold: true,
        strikethrough: true,
        dim: true,
        underline: true,
        undercurl: true,
        underdouble: true,
        underdotted: true,
        underdashed: true,
        blend: 50,
      });
    });
  });

  describe("defaultColorsSet", () => {
    it("updates default colors", () => {
      screen.defaultColorsSet(0xaabbcc, 0x112233, 0x445566);
      expect(screen.defaultColors).toEqual({
        fg: 0xaabbcc,
        bg: 0x112233,
        sp: 0x445566,
      });
    });

    it("ignores -1 values (no change)", () => {
      screen.defaultColorsSet(0xaabbcc, 0x112233, 0x445566);
      screen.defaultColorsSet(-1, 0x000000, -1);
      expect(screen.defaultColors).toEqual({
        fg: 0xaabbcc,
        bg: 0x000000,
        sp: 0x445566,
      });
    });

    it("marks all rows dirty", () => {
      screen.dirtyRows.clear();
      screen.defaultColorsSet(0xffffff, 0x000000, 0xff0000);
      for (let r = 0; r < screen.height; r++) {
        expect(screen.dirtyRows.has(r)).toBe(true);
      }
    });
  });

  describe("modeInfoSet", () => {
    it("parses mode info from plain objects", () => {
      screen.modeInfoSet(true, [
        { name: "normal", cursor_shape: "block", cell_percentage: 0 },
        { name: "insert", cursor_shape: "vertical", cell_percentage: 25 },
      ]);
      expect(screen.modeInfoList).toHaveLength(2);
      expect(screen.modeInfoList[0]).toEqual({
        name: "normal",
        cursor_shape: "block",
        cell_percentage: 0,
        attr_id: undefined,
        short_name: undefined,
      });
      expect(screen.modeInfoList[1]!.cursor_shape).toBe("vertical");
    });

    it("parses mode info from Map instances", () => {
      const normalMap = new Map<string, unknown>([
        ["name", "normal"],
        ["cursor_shape", "block"],
        ["cell_percentage", 0],
        ["attr_id", 0],
        ["short_name", "n"],
      ]);
      screen.modeInfoSet(true, [normalMap]);
      expect(screen.modeInfoList[0]).toEqual({
        name: "normal",
        cursor_shape: "block",
        cell_percentage: 0,
        attr_id: 0,
        short_name: "n",
      });
    });
  });

  describe("modeChange", () => {
    it("updates cursor mode index", () => {
      screen.modeChange("insert", 2);
      expect(screen.cursor.modeIdx).toBe(2);
    });
  });

  describe("busyStart / busyStop", () => {
    it("hides and shows the cursor", () => {
      expect(screen.cursor.visible).toBe(true);
      screen.busyStart();
      expect(screen.cursor.visible).toBe(false);
      screen.busyStop();
      expect(screen.cursor.visible).toBe(true);
    });
  });

  describe("flush", () => {
    it("increments generation counter", () => {
      const gen = screen.generation;
      screen.flush();
      expect(screen.generation).toBe(gen + 1);
    });

    it("clears dirty rows", () => {
      screen.gridLine(1, 0, 0, [["x"]]);
      expect(screen.dirtyRows.size).toBeGreaterThan(0);
      screen.flush();
      expect(screen.dirtyRows.size).toBe(0);
    });
  });
});
