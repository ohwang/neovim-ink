import { describe, it, expect } from "vitest";
import { keyToNeovimInput } from "../src/neovim/input.js";
import type { Key } from "ink";

// Helper to create a base Key object with all booleans false
function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...overrides,
  };
}

describe("keyToNeovimInput", () => {
  describe("regular characters", () => {
    it("passes through printable characters", () => {
      expect(keyToNeovimInput("a", makeKey())).toBe("a");
      expect(keyToNeovimInput("z", makeKey())).toBe("z");
      expect(keyToNeovimInput("A", makeKey())).toBe("A");
      expect(keyToNeovimInput("1", makeKey())).toBe("1");
      expect(keyToNeovimInput("/", makeKey())).toBe("/");
      expect(keyToNeovimInput(".", makeKey())).toBe(".");
    });

    it("escapes < as <lt>", () => {
      expect(keyToNeovimInput("<", makeKey())).toBe("<lt>");
    });

    it("escapes \\ as <Bslash>", () => {
      expect(keyToNeovimInput("\\", makeKey())).toBe("<Bslash>");
    });

    it("escapes | as <Bar>", () => {
      expect(keyToNeovimInput("|", makeKey())).toBe("<Bar>");
    });

    it("maps space to <Space>", () => {
      expect(keyToNeovimInput(" ", makeKey())).toBe("<Space>");
    });
  });

  describe("special keys", () => {
    it("maps return to <CR>", () => {
      expect(keyToNeovimInput("", makeKey({ return: true }))).toBe("<CR>");
    });

    it("maps escape to <Esc>", () => {
      expect(keyToNeovimInput("", makeKey({ escape: true }))).toBe("<Esc>");
    });

    it("maps backspace to <BS>", () => {
      expect(keyToNeovimInput("", makeKey({ backspace: true }))).toBe("<BS>");
    });

    it("maps delete to <BS> (macOS backspace sends 0x7F)", () => {
      expect(keyToNeovimInput("", makeKey({ delete: true }))).toBe("<BS>");
    });

    it("maps tab to <Tab>", () => {
      expect(keyToNeovimInput("", makeKey({ tab: true }))).toBe("<Tab>");
    });

    it("maps shift+tab to <S-Tab>", () => {
      expect(
        keyToNeovimInput("", makeKey({ tab: true, shift: true })),
      ).toBe("<S-Tab>");
    });
  });

  describe("arrow keys", () => {
    it("maps arrow keys", () => {
      expect(keyToNeovimInput("", makeKey({ upArrow: true }))).toBe("<Up>");
      expect(keyToNeovimInput("", makeKey({ downArrow: true }))).toBe("<Down>");
      expect(keyToNeovimInput("", makeKey({ leftArrow: true }))).toBe("<Left>");
      expect(keyToNeovimInput("", makeKey({ rightArrow: true }))).toBe("<Right>");
    });

    it("maps arrow keys with shift", () => {
      expect(
        keyToNeovimInput("", makeKey({ upArrow: true, shift: true })),
      ).toBe("<S-Up>");
      expect(
        keyToNeovimInput("", makeKey({ leftArrow: true, shift: true })),
      ).toBe("<S-Left>");
    });

    it("maps arrow keys with ctrl", () => {
      expect(
        keyToNeovimInput("", makeKey({ upArrow: true, ctrl: true })),
      ).toBe("<C-Up>");
    });

    it("maps arrow keys with meta (alt)", () => {
      expect(
        keyToNeovimInput("", makeKey({ downArrow: true, meta: true })),
      ).toBe("<A-Down>");
    });

    it("maps arrow keys with multiple modifiers", () => {
      expect(
        keyToNeovimInput(
          "",
          makeKey({ rightArrow: true, shift: true, ctrl: true }),
        ),
      ).toBe("<S-C-Right>");
    });
  });

  describe("navigation keys", () => {
    it("maps page up/down", () => {
      expect(keyToNeovimInput("", makeKey({ pageUp: true }))).toBe("<PageUp>");
      expect(keyToNeovimInput("", makeKey({ pageDown: true }))).toBe(
        "<PageDown>",
      );
    });

    it("maps home/end", () => {
      expect(keyToNeovimInput("", makeKey({ home: true }))).toBe("<Home>");
      expect(keyToNeovimInput("", makeKey({ end: true }))).toBe("<End>");
    });

    it("maps navigation keys with modifiers", () => {
      expect(
        keyToNeovimInput("", makeKey({ home: true, ctrl: true })),
      ).toBe("<C-Home>");
      expect(
        keyToNeovimInput("", makeKey({ end: true, shift: true })),
      ).toBe("<S-End>");
      expect(
        keyToNeovimInput("", makeKey({ pageUp: true, meta: true })),
      ).toBe("<A-PageUp>");
    });
  });

  describe("ctrl combinations", () => {
    it("maps ctrl+letter", () => {
      expect(keyToNeovimInput("a", makeKey({ ctrl: true }))).toBe("<C-a>");
      expect(keyToNeovimInput("c", makeKey({ ctrl: true }))).toBe("<C-c>");
      expect(keyToNeovimInput("z", makeKey({ ctrl: true }))).toBe("<C-z>");
      expect(keyToNeovimInput("w", makeKey({ ctrl: true }))).toBe("<C-w>");
    });
  });

  describe("meta (alt) combinations", () => {
    it("maps meta+letter", () => {
      expect(keyToNeovimInput("x", makeKey({ meta: true }))).toBe("<A-x>");
      expect(keyToNeovimInput("j", makeKey({ meta: true }))).toBe("<A-j>");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty input with no special keys", () => {
      expect(keyToNeovimInput("", makeKey())).toBe("");
    });

    it("handles unicode characters", () => {
      expect(keyToNeovimInput("ñ", makeKey())).toBe("ñ");
      expect(keyToNeovimInput("ü", makeKey())).toBe("ü");
    });
  });
});
