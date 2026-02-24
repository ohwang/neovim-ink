import React, { useCallback, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { useNeovim } from "./hooks/use-neovim.js";
import { NeovimScreen } from "./components/neovim-screen.js";
import { DEFAULT_CONFIG, type NeovimInkConfig } from "./config.js";
import type { MouseEvent } from "./neovim/mouse.js";

export interface NeovimEditorProps {
  /** Width of the editor in columns. */
  width: number;
  /** Height of the editor in rows (including chrome bar if enabled). */
  height: number;
  /** Configuration for Neovim and the editor chrome. */
  config?: NeovimInkConfig;
}

export function NeovimEditor({ width, height, config = {} }: NeovimEditorProps) {
  const showChrome = config.showChrome ?? DEFAULT_CONFIG.showChrome;
  const chromeLabel = config.chromeLabel ?? DEFAULT_CONFIG.chromeLabel;
  const chromeRows = showChrome ? 1 : 0;
  const nvimRows = height - chromeRows;

  const { screen, sendInput, paste, sendMouse, resize, frameCount } = useNeovim(
    width,
    nvimRows,
    config,
  );

  // Translate parsed mouse events into Neovim's nvim_input_mouse calls.
  // Map scroll events to Neovim's "wheel" button + "up"/"down" action.
  const handleMouse = useCallback((event: MouseEvent) => {
    const { button, action, modifier, col, row } = event;

    if (action === "scroll_up") {
      sendMouse("wheel", "up", modifier, 0, row, col);
    } else if (action === "scroll_down") {
      sendMouse("wheel", "down", modifier, 0, row, col);
    } else {
      sendMouse(button, action, modifier, 0, row, col);
    }
  }, [sendMouse]);

  // Resize Neovim when the width/height props change after initial mount.
  const prevDims = useRef({ width, nvimRows });
  useEffect(() => {
    const prev = prevDims.current;
    if (prev.width !== width || prev.nvimRows !== nvimRows) {
      resize(width, nvimRows);
      prevDims.current = { width, nvimRows };
    }
  }, [width, nvimRows, resize]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={nvimRows}>
        <NeovimScreen
          screen={screen}
          sendInput={sendInput}
          paste={paste}
          onMouse={handleMouse}
          frameCount={frameCount}
        />
      </Box>
      {showChrome && (
        <Box height={1} width={width}>
          <Text backgroundColor="#61afef" color="#282c34" bold>
            {" powered by Ink " +
              "\u2500".repeat(
                Math.max(
                  0,
                  width - " powered by Ink ".length - chromeLabel.length,
                ),
              ) +
              chromeLabel}
          </Text>
        </Box>
      )}
    </Box>
  );
}
