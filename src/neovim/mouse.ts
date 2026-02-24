/**
 * Parse SGR-encoded mouse escape sequences from the terminal.
 *
 * SGR mouse mode (\x1b[?1006h) sends events in the format:
 *   \x1b[<Cb;Cx;CyM  (press/motion)
 *   \x1b[<Cb;Cx;Cym  (release)
 *
 * Where Cb encodes the button and modifiers:
 *   bits 0-1: button (0=left, 1=middle, 2=right)
 *   bit 5:    motion (drag) flag
 *   bits 6-7: 64=scroll up, 65=scroll down (button field = 64 or 65)
 *   bits 2-4: modifiers (4=shift, 8=meta/alt, 16=ctrl)
 */

export interface MouseEvent {
  button: "left" | "middle" | "right" | "wheel";
  action: "press" | "release" | "drag" | "scroll_up" | "scroll_down";
  modifier: string; // e.g. "" or "shift" or "ctrl" or "shift:ctrl"
  col: number; // 0-indexed
  row: number; // 0-indexed
}

// SGR mouse sequence: \x1b[<Cb;Cx;Cy[Mm]
// Also matches without the leading ESC (Ink strips it in useInput).
const SGR_MOUSE_RE = /^(?:\x1b)?\[<(\d+);(\d+);(\d+)([Mm])$/;

/**
 * Check if a string looks like a mouse escape sequence.
 * Fast check to avoid regex on every keypress.
 *
 * Handles both full sequences (\x1b[<...) and ESC-stripped sequences ([<...)
 * since Ink's useInput strips the leading \x1b from unknown CSI sequences.
 */
export function isMouseSequence(s: string): boolean {
  // Full sequence: \x1b[<...
  if (s.length >= 9 && s.charCodeAt(0) === 0x1b && s.charCodeAt(1) === 0x5b && s.charCodeAt(2) === 0x3c) {
    return true;
  }
  // ESC-stripped (Ink useInput): [<...
  if (s.length >= 8 && s.charCodeAt(0) === 0x5b && s.charCodeAt(1) === 0x3c) {
    return true;
  }
  return false;
}

/**
 * Parse a SGR mouse escape sequence into a structured MouseEvent.
 * Returns null if the string is not a valid mouse sequence.
 *
 * Accepts both \x1b[<Cb;Cx;CyM and [<Cb;Cx;CyM (ESC-stripped).
 */
export function parseMouseEvent(s: string): MouseEvent | null {
  const match = SGR_MOUSE_RE.exec(s);
  if (!match) return null;

  const cb = parseInt(match[1]!, 10);
  // SGR coordinates are 1-indexed; convert to 0-indexed
  const col = parseInt(match[2]!, 10) - 1;
  const row = parseInt(match[3]!, 10) - 1;
  const isRelease = match[4] === "m";

  // Extract modifiers from bits 2-4
  const mods: string[] = [];
  if (cb & 4) mods.push("shift");
  if (cb & 8) mods.push("alt");
  if (cb & 16) mods.push("ctrl");
  const modifier = mods.join(":");

  // Scroll wheel: bits 6-7 set (cb & 64)
  if (cb & 64) {
    const scrollButton = cb & 1; // 0 = up, 1 = down
    return {
      button: "wheel",
      action: scrollButton === 0 ? "scroll_up" : "scroll_down",
      modifier,
      col,
      row,
    };
  }

  // Motion/drag: bit 5 set (cb & 32)
  const isDrag = !!(cb & 32);

  // Button: bits 0-1
  const buttonBits = cb & 3;
  const button: MouseEvent["button"] =
    buttonBits === 0 ? "left"
      : buttonBits === 1 ? "middle"
        : "right";

  let action: MouseEvent["action"];
  if (isRelease) {
    action = "release";
  } else if (isDrag) {
    action = "drag";
  } else {
    action = "press";
  }

  return { button, action, modifier, col, row };
}
