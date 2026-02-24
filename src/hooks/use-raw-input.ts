import { useInput, useStdin, type Key } from "ink";
import { keyToNeovimInput } from "../neovim/input.js";
import { log } from "../logger.js";

/**
 * Hook that captures keyboard input via Ink's useInput
 * and forwards it to Neovim as input strings.
 */
export function useRawInput(
  sendInput: (keys: string) => void,
  active: boolean,
): void {
  const { isRawModeSupported } = useStdin();

  useInput(
    (input, key) => {
      log("input", `raw: input=${JSON.stringify(input)} key=${JSON.stringify(key)}`);
      const nvimKeys = keyToNeovimInput(input, key);
      log("input", `translated: ${JSON.stringify(nvimKeys)}`);
      if (nvimKeys) {
        sendInput(nvimKeys);
      }
    },
    { isActive: !!(active && isRawModeSupported) },
  );
}
