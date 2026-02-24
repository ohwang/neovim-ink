import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { attach, type NeovimClient } from "neovim";
import { ScreenBuffer } from "../src/screen/screen-buffer.js";
import { setupRedrawHandler } from "../src/neovim/event-handler.js";
import { initLogger } from "../src/logger.js";

// Helper to extract row text from screen buffer
function rowText(screen: ScreenBuffer, row: number): string {
  return screen.cells[row]!.map((c) => c.text).join("").trimEnd();
}

// Wait for Neovim to process input and flush screen updates
function waitForFlush(ms = 500): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("Neovim integration", () => {
  let proc: ChildProcess;
  let client: NeovimClient;
  let screen: ScreenBuffer;
  let flushCount: number;

  beforeAll(async () => {
    initLogger();

    proc = spawn("nvim", ["--embed", "--clean"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    client = attach({ proc: proc as unknown as NodeJS.Process });

    await client.channelId;
    await client.request("nvim_set_option_value", [
      "termguicolors",
      true,
      {},
    ]);

    screen = new ScreenBuffer(80, 24);
    flushCount = 0;

    await client.request("nvim_ui_attach", [
      80,
      24,
      { rgb: true, ext_linegrid: true },
    ]);

    setupRedrawHandler(client, screen, () => {
      flushCount++;
    });

    // Wait for initial render
    await waitForFlush(1000);
  });

  afterAll(() => {
    client?.request("nvim_ui_detach", []).catch(() => {});
    proc?.kill();
  });

  it("receives initial flush after UI attach", () => {
    expect(flushCount).toBeGreaterThan(0);
  });

  it("receives mode_info_set with mode definitions", () => {
    expect(screen.modeInfoList.length).toBeGreaterThan(0);

    const normal = screen.modeInfoList.find((m) => m.name === "normal");
    expect(normal).toBeDefined();
    expect(normal!.cursor_shape).toBe("block");

    const insert = screen.modeInfoList.find((m) => m.name === "insert");
    expect(insert).toBeDefined();
    expect(insert!.cursor_shape).toBe("vertical");
  });

  it("receives default_colors_set with valid colors", () => {
    // With termguicolors, default fg/bg should be non-zero
    expect(screen.defaultColors.fg).toBeGreaterThan(0);
  });

  it("receives hl_attr_define entries", () => {
    expect(screen.hlAttrs.size).toBeGreaterThan(0);
  });

  it("starts in normal mode at row 0, col 0", () => {
    expect(screen.cursor.row).toBe(0);
    expect(screen.cursor.col).toBe(0);
    expect(screen.cursor.modeIdx).toBe(0);
    expect(screen.modeInfoList[0]?.name).toBe("normal");
  });

  it("renders tilde rows for empty buffer", () => {
    // Neovim shows ~ on empty lines (row 1 onwards for a new buffer)
    const tildeRows = [];
    for (let r = 1; r < screen.height - 1; r++) {
      const text = rowText(screen, r);
      if (text.startsWith("~")) tildeRows.push(r);
    }
    expect(tildeRows.length).toBeGreaterThan(0);
  });

  it("enters insert mode with 'i'", async () => {
    await client.input("i");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("insert");
    expect(mode?.cursor_shape).toBe("vertical");
  });

  it("types text and updates screen buffer", async () => {
    await client.input("Hello, Neovim!");
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("Hello, Neovim!");
    expect(screen.cursor.row).toBe(0);
    expect(screen.cursor.col).toBe(14); // After the '!'
  });

  it("backspace deletes characters", async () => {
    await client.input("<BS><BS><BS><BS><BS><BS><BS>");
    await waitForFlush();

    // "Hello, Neovim!" minus 7 BS = "Hello, " — trimEnd strips trailing space
    expect(rowText(screen, 0)).toBe("Hello,");
    expect(screen.cursor.col).toBe(7);
  });

  it("types replacement text", async () => {
    await client.input("Ink!");
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("Hello, Ink!");
    expect(screen.cursor.col).toBe(11);
  });

  it("returns to normal mode with Esc", async () => {
    await client.input("<Esc>");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("normal");
    expect(mode?.cursor_shape).toBe("block");
    // In normal mode, cursor moves back one column
    expect(screen.cursor.col).toBe(10);
  });

  it("navigates with h/l in normal mode", async () => {
    const startCol = screen.cursor.col;

    await client.input("0"); // Go to start of line
    await waitForFlush();
    expect(screen.cursor.col).toBe(0);

    await client.input("$"); // Go to end of line
    await waitForFlush();
    expect(screen.cursor.col).toBe(10); // Last char of "Hello, Ink!"

    await client.input("hhh"); // Move left 3
    await waitForFlush();
    expect(screen.cursor.col).toBe(7);
  });

  it("opens a new line with 'o'", async () => {
    await client.input("o");
    await waitForFlush();

    // Should be in insert mode on a new line
    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("insert");
    expect(screen.cursor.row).toBe(1);
    expect(screen.cursor.col).toBe(0);

    await client.input("Second line");
    await waitForFlush();
    expect(rowText(screen, 1)).toBe("Second line");

    await client.input("<Esc>");
    await waitForFlush();
  });

  it("handles dd to delete a line", async () => {
    // We should be on row 1 ("Second line")
    expect(screen.cursor.row).toBe(1);

    await client.input("dd");
    await waitForFlush();

    // "Second line" should be gone, row 1 should now be a tilde or empty
    expect(rowText(screen, 0)).toBe("Hello, Ink!");
    const row1 = rowText(screen, 1);
    expect(row1 === "~" || row1 === "").toBe(true);
  });

  it("handles command-line mode", async () => {
    await client.input(":");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("cmdline_normal");

    await client.input("<Esc>");
    await waitForFlush();

    const normalMode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(normalMode?.name).toBe("normal");
  });

  it("handles undo with u", async () => {
    // We deleted "Second line" with dd. Undo should bring it back.
    await client.input("u");
    await waitForFlush();

    expect(rowText(screen, 1)).toBe("Second line");
  });

  it("handles redo with Ctrl-r", async () => {
    await client.input("<C-r>");
    await waitForFlush();

    // Redo the dd — "Second line" should be gone again
    const row1 = rowText(screen, 1);
    expect(row1 === "~" || row1 === "").toBe(true);
  });

  it("handles visual mode with v", async () => {
    await client.input("0v$");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("visual");

    await client.input("<Esc>");
    await waitForFlush();
  });

  it("handles search with /", async () => {
    await client.input("/Ink<CR>");
    await waitForFlush();

    // Cursor should be at the start of "Ink" in "Hello, Ink!"
    expect(screen.cursor.col).toBe(7);

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("normal");
  });

  it("screen buffer dimensions match ui_attach size", () => {
    expect(screen.width).toBe(80);
    expect(screen.height).toBe(24);
    expect(screen.cells.length).toBe(24);
    expect(screen.cells[0]!.length).toBe(80);
  });

  it("preserves line 1 content after resize (nvim_ui_try_resize only)", async () => {
    // Ensure we have text on line 1
    expect(rowText(screen, 0)).toContain("Hello");

    // Resize to a smaller height (like a terminal shrink), then back
    await client.request("nvim_ui_try_resize", [80, 20]);
    await waitForFlush();

    expect(screen.width).toBe(80);
    expect(screen.height).toBe(20);
    expect(rowText(screen, 0)).toContain("Hello");

    // Resize back to original
    await client.request("nvim_ui_try_resize", [80, 24]);
    await waitForFlush();

    expect(screen.width).toBe(80);
    expect(screen.height).toBe(24);
    expect(rowText(screen, 0)).toContain("Hello");
  });

  it("resize only via nvim_ui_try_resize lets Neovim own the grid_resize", async () => {
    // After the fix, useNeovim.resize() no longer calls screen.gridResize()
    // manually. Instead it only sends nvim_ui_try_resize, and Neovim sends
    // back grid_resize which the event handler uses to resize the buffer.
    // This test verifies the correct flow.
    expect(rowText(screen, 0)).toContain("Hello");

    // Only nvim_ui_try_resize — no manual screen.gridResize
    await client.request("nvim_ui_try_resize", [80, 20]);
    await waitForFlush();

    expect(screen.width).toBe(80);
    expect(screen.height).toBe(20);
    expect(rowText(screen, 0)).toContain("Hello");

    // Resize back
    await client.request("nvim_ui_try_resize", [80, 24]);
    await waitForFlush();

    expect(screen.width).toBe(80);
    expect(screen.height).toBe(24);
    expect(rowText(screen, 0)).toContain("Hello");
  });

  it("line 1 visible after resize with chrome-adjusted height", async () => {
    // Regression test for the bug where the resize handler passed full
    // terminal height to Neovim instead of (height - chromeRows).
    //
    // With INK_CHROME_ROWS = 1, terminal 80x20 → Neovim should get 80x19.
    // The fix: App.useResize subtracts chrome rows before calling resize().
    // useNeovim.resize() only calls nvim_ui_try_resize (no manual gridResize).

    // Fill buffer with many lines
    await client.input("<Esc>ggdG");
    await waitForFlush();

    await client.input("i");
    for (let i = 1; i <= 30; i++) {
      await client.input(`Line ${i}`);
      if (i < 30) await client.input("<CR>");
    }
    await client.input("<Esc>");
    await waitForFlush();

    // Go to line 1
    await client.input("gg");
    await waitForFlush();
    expect(rowText(screen, 0)).toContain("Line 1");

    // Correct resize: terminal 80x20 → Neovim gets 80x19 (minus 1 chrome row)
    const CHROME_ROWS = 1;
    const terminalHeight = 20;
    const nvimHeight = terminalHeight - CHROME_ROWS;

    await client.request("nvim_ui_try_resize", [80, nvimHeight]);
    await waitForFlush();

    expect(screen.height).toBe(nvimHeight);
    expect(rowText(screen, 0)).toContain("Line 1");

    // Shrink further
    await client.request("nvim_ui_try_resize", [80, 10]);
    await waitForFlush();

    expect(screen.height).toBe(10);
    expect(rowText(screen, 0)).toContain("Line 1");

    // Grow back
    await client.request("nvim_ui_try_resize", [80, 24]);
    await waitForFlush();

    expect(screen.height).toBe(24);
    expect(rowText(screen, 0)).toContain("Line 1");
  });
});
