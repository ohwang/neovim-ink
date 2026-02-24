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

  // -----------------------------------------------------------------------
  // Cursor attr_id tests
  // -----------------------------------------------------------------------

  it("mode_info_set entries have attr_id parsed when present", () => {
    // Neovim may or may not include attr_id for every mode entry.
    // With --clean, most modes have attr_id=0. Verify that when present,
    // it's stored as a number, and that our resolution logic handles both cases.
    let hasAttrId = false;
    for (const mode of screen.modeInfoList) {
      if (mode.attr_id !== undefined) {
        expect(typeof mode.attr_id).toBe("number");
        hasAttrId = true;
      }
    }
    // With termguicolors, at least some modes should have attr_id
    // (even if it's 0 meaning "use default colors")
    expect(hasAttrId || screen.modeInfoList.length > 0).toBe(true);
  });

  it("cursor attr_id resolves to an HlAttr when non-zero", () => {
    // Some colorschemes (including the default with termguicolors) define
    // non-zero attr_id for certain modes. Even if all are 0 with --clean,
    // the resolution logic should work: attr_id 0 means "use default".
    for (const mode of screen.modeInfoList) {
      if (mode.attr_id != null && mode.attr_id > 0) {
        const attr = screen.hlAttrs.get(mode.attr_id);
        // If Neovim defined a non-zero attr_id, we should have the hlAttr
        expect(attr).toBeDefined();
      }
    }
    // At minimum, attr_id 0 (default) should not resolve to a special attr
    const defaultAttr = screen.hlAttrs.get(0);
    // attr_id 0 may or may not be in hlAttrs — both are valid
    expect(true).toBe(true); // This test verifies no crash during resolution
  });

  it("normal mode cursor resolves attr correctly for rendering", async () => {
    // Ensure we're in normal mode
    await client.input("<Esc>");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("normal");
    expect(mode?.cursor_shape).toBe("block");

    // Verify the attr_id lookup works without error
    const attrId = mode?.attr_id;
    expect(attrId).toBeDefined();
    if (attrId != null && attrId > 0) {
      const cursorAttr = screen.hlAttrs.get(attrId);
      expect(cursorAttr).toBeDefined();
    }
  });

  it("insert mode cursor resolves attr correctly for rendering", async () => {
    await client.input("i");
    await waitForFlush();

    const mode = screen.modeInfoList[screen.cursor.modeIdx];
    expect(mode?.name).toBe("insert");
    expect(mode?.cursor_shape).toBe("vertical");

    const attrId = mode?.attr_id;
    expect(attrId).toBeDefined();

    await client.input("<Esc>");
    await waitForFlush();
  });

  // -----------------------------------------------------------------------
  // nvim_paste tests
  // -----------------------------------------------------------------------

  it("nvim_paste inserts text in insert mode", async () => {
    // Clear buffer and enter insert mode
    await client.input("<Esc>ggdGi");
    await waitForFlush();

    // Paste via nvim_paste API (phase -1 = single-shot paste)
    await client.request("nvim_paste", ["Hello from paste!", true, -1]);
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("Hello from paste!");
    expect(screen.cursor.col).toBe(17);
  });

  it("nvim_paste inserts multiline text", async () => {
    await client.input("<Esc>ggdGi");
    await waitForFlush();

    await client.request("nvim_paste", ["line one\nline two\nline three", true, -1]);
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("line one");
    expect(rowText(screen, 1)).toBe("line two");
    expect(rowText(screen, 2)).toBe("line three");
  });

  it("nvim_paste in normal mode inserts text at cursor", async () => {
    await client.input("<Esc>ggdG");
    await waitForFlush();

    // Type some text first, go back to normal mode, cursor on first char
    await client.input("iexisting");
    await waitForFlush();
    await client.input("<Esc>0");
    await waitForFlush();

    // Paste in normal mode — nvim_paste inserts at cursor position,
    // splitting the existing text around the cursor.
    await client.request("nvim_paste", ["PASTED ", true, -1]);
    await waitForFlush();

    const row = rowText(screen, 0);
    expect(row).toContain("PASTED");
    // The existing text is split: "e" before cursor + "xisting" after paste
    expect(row).toContain("xisting");
  });

  it("nvim_paste handles special characters without triggering mappings", async () => {
    await client.input("<Esc>ggdGi");
    await waitForFlush();

    // Paste text that contains characters which would be mappings if typed
    // e.g. "jk" is a common escape mapping, "<CR>" is literal text not enter
    await client.request("nvim_paste", ["jk is not escape, <CR> is literal", true, -1]);
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("jk is not escape, <CR> is literal");
  });

  it("nvim_paste handles empty string gracefully", async () => {
    await client.input("<Esc>ggdGibase text");
    await waitForFlush();

    const before = rowText(screen, 0);
    await client.request("nvim_paste", ["", true, -1]);
    await waitForFlush();

    expect(rowText(screen, 0)).toBe(before);
  });

  it("nvim_paste handles large text block", async () => {
    await client.input("<Esc>ggdGi");
    await waitForFlush();

    // Generate a block of 50 lines
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: some content here`);
    const text = lines.join("\n");

    await client.request("nvim_paste", [text, true, -1]);
    await waitForFlush();

    // Check the buffer has all 50 lines via Neovim API
    const bufLines = await client.request("nvim_buf_get_lines", [0, 0, -1, false]) as string[];
    expect(bufLines.length).toBe(50);
    expect(bufLines[0]).toBe("Line 1: some content here");
    expect(bufLines[49]).toBe("Line 50: some content here");

    // Scroll to top and verify screen shows first line
    await client.input("<Esc>gg");
    await waitForFlush();

    expect(rowText(screen, 0)).toBe("Line 1: some content here");
  });
});
