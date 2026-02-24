import { describe, it, expect } from "vitest";
import { parseMouseEvent, isMouseSequence } from "../src/neovim/mouse.js";

describe("isMouseSequence", () => {
  it("returns true for full SGR mouse sequences", () => {
    expect(isMouseSequence("\x1b[<0;10;5M")).toBe(true);
    expect(isMouseSequence("\x1b[<0;10;5m")).toBe(true);
    expect(isMouseSequence("\x1b[<35;100;200M")).toBe(true);
  });

  it("returns true for ESC-stripped SGR sequences (Ink useInput format)", () => {
    expect(isMouseSequence("[<0;10;5M")).toBe(true);
    expect(isMouseSequence("[<0;10;5m")).toBe(true);
    expect(isMouseSequence("[<65;1;1M")).toBe(true);
  });

  it("returns false for keyboard sequences", () => {
    expect(isMouseSequence("\x1b[A")).toBe(false);      // up arrow
    expect(isMouseSequence("\x1b[1;5A")).toBe(false);   // ctrl+up
    expect(isMouseSequence("a")).toBe(false);            // letter
    expect(isMouseSequence("\x1b")).toBe(false);         // escape
    expect(isMouseSequence("")).toBe(false);             // empty
    expect(isMouseSequence("[A")).toBe(false);           // ESC-stripped arrow
  });

  it("returns false for too-short sequences", () => {
    expect(isMouseSequence("\x1b[<0;1")).toBe(false);
    expect(isMouseSequence("[<0;1")).toBe(false);
  });
});

describe("parseMouseEvent", () => {
  describe("button clicks", () => {
    it("parses left click", () => {
      const e = parseMouseEvent("\x1b[<0;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "",
        col: 9,  // 10 - 1 (1-indexed to 0-indexed)
        row: 4,  // 5 - 1
      });
    });

    it("parses middle click", () => {
      const e = parseMouseEvent("\x1b[<1;1;1M");
      expect(e).toEqual({
        button: "middle",
        action: "press",
        modifier: "",
        col: 0,
        row: 0,
      });
    });

    it("parses right click", () => {
      const e = parseMouseEvent("\x1b[<2;50;30M");
      expect(e).toEqual({
        button: "right",
        action: "press",
        modifier: "",
        col: 49,
        row: 29,
      });
    });
  });

  describe("button release", () => {
    it("parses left release (lowercase m)", () => {
      const e = parseMouseEvent("\x1b[<0;10;5m");
      expect(e).toEqual({
        button: "left",
        action: "release",
        modifier: "",
        col: 9,
        row: 4,
      });
    });

    it("parses right release", () => {
      const e = parseMouseEvent("\x1b[<2;20;10m");
      expect(e).toEqual({
        button: "right",
        action: "release",
        modifier: "",
        col: 19,
        row: 9,
      });
    });
  });

  describe("drag", () => {
    it("parses left drag (bit 5 = 32)", () => {
      // 32 + 0 (left) = 32
      const e = parseMouseEvent("\x1b[<32;15;8M");
      expect(e).toEqual({
        button: "left",
        action: "drag",
        modifier: "",
        col: 14,
        row: 7,
      });
    });

    it("parses right drag", () => {
      // 32 + 2 (right) = 34
      const e = parseMouseEvent("\x1b[<34;20;10M");
      expect(e).toEqual({
        button: "right",
        action: "drag",
        modifier: "",
        col: 19,
        row: 9,
      });
    });
  });

  describe("scroll wheel", () => {
    it("parses scroll up (cb=64)", () => {
      const e = parseMouseEvent("\x1b[<64;10;5M");
      expect(e).toEqual({
        button: "wheel",
        action: "scroll_up",
        modifier: "",
        col: 9,
        row: 4,
      });
    });

    it("parses scroll down (cb=65)", () => {
      const e = parseMouseEvent("\x1b[<65;10;5M");
      expect(e).toEqual({
        button: "wheel",
        action: "scroll_down",
        modifier: "",
        col: 9,
        row: 4,
      });
    });
  });

  describe("modifiers", () => {
    it("parses shift+left click (4 + 0 = 4)", () => {
      const e = parseMouseEvent("\x1b[<4;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "shift",
        col: 9,
        row: 4,
      });
    });

    it("parses alt+left click (8 + 0 = 8)", () => {
      const e = parseMouseEvent("\x1b[<8;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "alt",
        col: 9,
        row: 4,
      });
    });

    it("parses ctrl+left click (16 + 0 = 16)", () => {
      const e = parseMouseEvent("\x1b[<16;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "ctrl",
        col: 9,
        row: 4,
      });
    });

    it("parses shift+ctrl+left click (4 + 16 = 20)", () => {
      const e = parseMouseEvent("\x1b[<20;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "shift:ctrl",
        col: 9,
        row: 4,
      });
    });

    it("parses ctrl+scroll up (16 + 64 = 80)", () => {
      const e = parseMouseEvent("\x1b[<80;10;5M");
      expect(e).toEqual({
        button: "wheel",
        action: "scroll_up",
        modifier: "ctrl",
        col: 9,
        row: 4,
      });
    });
  });

  describe("edge cases", () => {
    it("handles large coordinates", () => {
      const e = parseMouseEvent("\x1b[<0;999;500M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "",
        col: 998,
        row: 499,
      });
    });

    it("handles coordinate 1,1 (top-left)", () => {
      const e = parseMouseEvent("\x1b[<0;1;1M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "",
        col: 0,
        row: 0,
      });
    });

    it("returns null for invalid sequences", () => {
      expect(parseMouseEvent("")).toBeNull();
      expect(parseMouseEvent("hello")).toBeNull();
      expect(parseMouseEvent("\x1b[A")).toBeNull();
      expect(parseMouseEvent("\x1b[<abcM")).toBeNull();
    });

    it("returns null for incomplete sequences", () => {
      expect(parseMouseEvent("\x1b[<0;10")).toBeNull();
      expect(parseMouseEvent("\x1b[<0;10;5")).toBeNull();
    });
  });

  describe("ESC-stripped sequences (Ink useInput format)", () => {
    it("parses left click without ESC prefix", () => {
      const e = parseMouseEvent("[<0;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "",
        col: 9,
        row: 4,
      });
    });

    it("parses scroll down without ESC prefix", () => {
      const e = parseMouseEvent("[<65;10;5M");
      expect(e).toEqual({
        button: "wheel",
        action: "scroll_down",
        modifier: "",
        col: 9,
        row: 4,
      });
    });

    it("parses release without ESC prefix", () => {
      const e = parseMouseEvent("[<0;10;5m");
      expect(e).toEqual({
        button: "left",
        action: "release",
        modifier: "",
        col: 9,
        row: 4,
      });
    });

    it("parses ctrl+click without ESC prefix", () => {
      const e = parseMouseEvent("[<16;10;5M");
      expect(e).toEqual({
        button: "left",
        action: "press",
        modifier: "ctrl",
        col: 9,
        row: 4,
      });
    });
  });
});
