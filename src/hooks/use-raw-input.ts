import { useInput, useStdin, type Key } from "ink";
import { keyToNeovimInput } from "../neovim/input.js";
import { log } from "../logger.js";

/**
 * Hook that captures keyboard input via Ink's useInput
 * and forwards it to Neovim as input strings.
 *
 * Ink calls the useInput callback once per keypress for normal typing,
 * but when the user pastes text, the entire string arrives in a single
 * callback with input.length > 1. We detect this and route pasted text
 * through the `onPaste` callback (which uses nvim_paste()) instead of
 * translating each character as a keypress.
 */
export function useRawInput(
  sendInput: (keys: string) => void,
  onPaste: (text: string) => void,
  active: boolean,
): void {
  const { isRawModeSupported } = useStdin();

  useInput(
    (input, key) => {
      log("input", `raw: input=${JSON.stringify(input)} key=${JSON.stringify(key)}`);

      // Paste detection: Ink delivers pasted text as a single input string
      // with length > 1 and no modifier keys set. Single characters with
      // modifiers (Ctrl, Meta, etc.) are normal keypresses, not pastes.
      const isModified = key.ctrl || key.meta || key.shift || key.return
        || key.escape || key.backspace || key.delete || key.tab
        || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow
        || key.pageUp || key.pageDown || key.home || key.end;

      if (input.length > 1 && !isModified) {
        log("input", `paste detected: ${input.length} chars`);
        onPaste(input);
        return;
      }

      const nvimKeys = keyToNeovimInput(input, key);
      log("input", `translated: ${JSON.stringify(nvimKeys)}`);
      if (nvimKeys) {
        sendInput(nvimKeys);
      }
    },
    { isActive: !!(active && isRawModeSupported) },
  );
}
