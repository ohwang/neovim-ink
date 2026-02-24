import type { Key } from "ink";

/**
 * Translate an Ink useInput key event into a Neovim input string.
 * Neovim expects keys like <CR>, <Esc>, <C-a>, <A-x>, <S-Up>, etc.
 *
 * NOTE on backspace: On macOS (and most modern terminals), the physical
 * Backspace key sends 0x7F which Ink parses as key.delete (not key.backspace).
 * Ink's key.backspace fires on 0x08 which is Ctrl+H. The physical Delete/
 * forward-delete key sends \x1b[3~ which Ink also parses as key.delete.
 * Since we can't distinguish them via Ink's API, and Backspace is far more
 * common, we map key.delete -> <BS>. This matches user expectation.
 */
export function keyToNeovimInput(input: string, key: Key): string {
  // Special keys
  if (key.return) return "<CR>";
  if (key.escape) return "<Esc>";
  // Both key.backspace (0x08) and key.delete (0x7F) should send <BS>
  // since on macOS the physical Backspace key produces 0x7F.
  if (key.backspace || key.delete) return "<BS>";

  if (key.tab) {
    return key.shift ? "<S-Tab>" : "<Tab>";
  }

  if (key.upArrow) return modWrap("Up", key);
  if (key.downArrow) return modWrap("Down", key);
  if (key.leftArrow) return modWrap("Left", key);
  if (key.rightArrow) return modWrap("Right", key);
  if (key.pageUp) return modWrap("PageUp", key);
  if (key.pageDown) return modWrap("PageDown", key);
  if (key.home) return modWrap("Home", key);
  if (key.end) return modWrap("End", key);

  // Ctrl+letter (input will be the letter)
  if (key.ctrl && input.length === 1) {
    return `<C-${input}>`;
  }

  // Alt/Meta+key
  if (key.meta && input.length === 1) {
    return `<A-${input}>`;
  }

  // Handle special characters that Neovim needs escaped
  if (input === "<") return "<lt>";
  if (input === "\\") return "<Bslash>";
  if (input === "|") return "<Bar>";

  // Space needs special handling
  if (input === " ") return "<Space>";

  // Regular character input
  return input;
}

function modWrap(name: string, key: Key): string {
  let mods = "";
  if (key.shift) mods += "S-";
  if (key.ctrl) mods += "C-";
  if (key.meta) mods += "A-";
  return mods ? `<${mods}${name}>` : `<${name}>`;
}
