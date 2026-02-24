import type { Cell, CursorState, DefaultColors, HlAttr, ModeInfo } from "./types.js";
import { log } from "../logger.js";

function makeCell(): Cell {
  return { text: " ", hlId: 0 };
}

function makeRow(width: number): Cell[] {
  return Array.from({ length: width }, makeCell);
}

export class ScreenBuffer {
  width: number;
  height: number;
  cells: Cell[][];
  hlAttrs: Map<number, HlAttr> = new Map();
  defaultColors: DefaultColors = { fg: 0xffffff, bg: 0x000000, sp: 0xff0000 };
  cursor: CursorState = { grid: 1, row: 0, col: 0, modeIdx: 0, visible: true };
  modeInfoList: ModeInfo[] = [];

  // Per-row dirty flags for incremental rendering
  dirtyRows: Set<number> = new Set();
  // Incremented on each flush to trigger React re-renders
  generation = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => makeRow(width));
  }

  gridResize(_grid: number, width: number, height: number): void {
    const oldHeight = this.height;
    const oldWidth = this.width;
    this.width = width;
    this.height = height;

    // Grow or shrink rows
    if (height > oldHeight) {
      for (let r = oldHeight; r < height; r++) {
        this.cells.push(makeRow(width));
      }
    } else if (height < oldHeight) {
      this.cells.length = height;
    }

    // Adjust column widths for existing rows
    for (let r = 0; r < Math.min(height, oldHeight); r++) {
      if (width > oldWidth) {
        for (let c = oldWidth; c < width; c++) {
          this.cells[r]!.push(makeCell());
        }
      } else if (width < oldWidth) {
        this.cells[r]!.length = width;
      }
    }

    // Mark all rows dirty
    for (let r = 0; r < height; r++) {
      this.dirtyRows.add(r);
    }
  }

  gridLine(_grid: number, row: number, colStart: number, cells: unknown[]): void {
    let col = colStart;
    let lastHlId = 0;

    for (const cell of cells) {
      const arr = cell as unknown[];
      const text = arr[0] as string;
      const hlId = arr.length > 1 ? (arr[1] as number) : lastHlId;
      const repeat = arr.length > 2 ? (arr[2] as number) : 1;
      lastHlId = hlId;

      for (let i = 0; i < repeat; i++) {
        if (col < this.width && this.cells[row]) {
          this.cells[row]![col] = { text, hlId };
        }
        col++;
      }
    }

    this.dirtyRows.add(row);
  }

  gridCursorGoto(_grid: number, row: number, col: number): void {
    this.cursor.row = row;
    this.cursor.col = col;
  }

  gridScroll(
    _grid: number,
    top: number,
    bot: number,
    left: number,
    right: number,
    rows: number,
  ): void {
    if (rows > 0) {
      // Scroll up: copy rows [top+rows..bot) to [top..bot-rows)
      for (let r = top; r < bot - rows; r++) {
        for (let c = left; c < right; c++) {
          this.cells[r]![c] = { ...this.cells[r + rows]![c]! };
        }
        this.dirtyRows.add(r);
      }
      // Clear the vacated rows at the bottom
      for (let r = bot - rows; r < bot; r++) {
        for (let c = left; c < right; c++) {
          this.cells[r]![c] = makeCell();
        }
        this.dirtyRows.add(r);
      }
    } else if (rows < 0) {
      // Scroll down: copy rows [top..bot+rows) to [top-rows..bot)
      for (let r = bot - 1; r >= top - rows; r--) {
        for (let c = left; c < right; c++) {
          this.cells[r]![c] = { ...this.cells[r + rows]![c]! };
        }
        this.dirtyRows.add(r);
      }
      // Clear the vacated rows at the top
      for (let r = top; r < top - rows; r++) {
        for (let c = left; c < right; c++) {
          this.cells[r]![c] = makeCell();
        }
        this.dirtyRows.add(r);
      }
    }
  }

  gridClear(_grid: number): void {
    for (let r = 0; r < this.height; r++) {
      this.cells[r] = makeRow(this.width);
      this.dirtyRows.add(r);
    }
  }

  hlAttrDefine(id: number, rawAttr: Record<string, unknown> | Map<string, unknown>): void {
    const rgbAttr: Record<string, unknown> =
      rawAttr instanceof Map ? Object.fromEntries(rawAttr) : rawAttr;
    const attr: HlAttr = {};
    if (rgbAttr.foreground !== undefined) attr.foreground = rgbAttr.foreground as number;
    if (rgbAttr.background !== undefined) attr.background = rgbAttr.background as number;
    if (rgbAttr.special !== undefined) attr.special = rgbAttr.special as number;
    if (rgbAttr.reverse) attr.reverse = true;
    if (rgbAttr.italic) attr.italic = true;
    if (rgbAttr.bold) attr.bold = true;
    if (rgbAttr.strikethrough) attr.strikethrough = true;
    if (rgbAttr.underline) attr.underline = true;
    if (rgbAttr.undercurl) attr.undercurl = true;
    if (rgbAttr.underdouble) attr.underdouble = true;
    if (rgbAttr.underdotted) attr.underdotted = true;
    if (rgbAttr.underdashed) attr.underdashed = true;
    if (rgbAttr.blend !== undefined) attr.blend = rgbAttr.blend as number;
    this.hlAttrs.set(id, attr);
  }

  defaultColorsSet(fg: number, bg: number, sp: number): void {
    // Neovim sends -1 for "no change"
    if (fg !== -1) this.defaultColors.fg = fg;
    if (bg !== -1) this.defaultColors.bg = bg;
    if (sp !== -1) this.defaultColors.sp = sp;
    // Default color change makes all rows dirty
    for (let r = 0; r < this.height; r++) {
      this.dirtyRows.add(r);
    }
  }

  modeInfoSet(_cursorStyleEnabled: boolean, modeInfoList: unknown[]): void {
    this.modeInfoList = modeInfoList.map((info) => {
      // The neovim msgpack client may deliver maps as plain objects or Map instances
      let m: Record<string, unknown>;
      if (info instanceof Map) {
        m = Object.fromEntries(info);
      } else {
        m = info as Record<string, unknown>;
      }
      return {
        cursor_shape: m.cursor_shape as ModeInfo["cursor_shape"],
        cell_percentage: m.cell_percentage as number | undefined,
        attr_id: m.attr_id as number | undefined,
        name: m.name as string | undefined,
        short_name: m.short_name as string | undefined,
      };
    });
  }

  modeChange(_mode: string, modeIdx: number): void {
    this.cursor.modeIdx = modeIdx;
  }

  busyStart(): void {
    this.cursor.visible = false;
  }

  busyStop(): void {
    this.cursor.visible = true;
  }

  flush(): void {
    this.generation++;
    this.dirtyRows.clear();
  }
}
