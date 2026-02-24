import React from "react";
import { Box } from "ink";
import { GridRow } from "./grid-row.js";
import { useRawInput } from "../hooks/use-raw-input.js";
import type { ScreenBuffer } from "../screen/screen-buffer.js";
import type { ModeInfo } from "../screen/types.js";

interface Props {
  screen: ScreenBuffer;
  sendInput: (keys: string) => void;
  paste: (text: string) => void;
  frameCount: number;
}

export function NeovimScreen({
  screen,
  sendInput,
  paste,
  frameCount,
}: Props) {
  useRawInput(sendInput, paste, true);

  // Determine current cursor shape and attr from mode info
  const modeInfo: ModeInfo | undefined =
    screen.modeInfoList[screen.cursor.modeIdx];
  const cursorShape = modeInfo?.cursor_shape ?? "block";
  const cursorAttr =
    modeInfo?.attr_id != null && modeInfo.attr_id > 0
      ? screen.hlAttrs.get(modeInfo.attr_id)
      : undefined;

  // Use screen.generation (updated on each flush) to bust memoization.
  // The ScreenBuffer mutates cell arrays in-place, so React's reference
  // checks on the `cells` array won't detect changes. We pass generation
  // to each GridRow to force re-evaluation when the screen updates.
  const generation = screen.generation;

  // Force usage of frameCount to ensure re-renders
  void frameCount;

  return (
    <Box flexDirection="column">
      {screen.cells.map((rowCells, rowIdx) => (
        <GridRow
          key={rowIdx}
          cells={rowCells}
          hlAttrs={screen.hlAttrs}
          defaultColors={screen.defaultColors}
          cursorCol={
            screen.cursor.visible && screen.cursor.row === rowIdx
              ? screen.cursor.col
              : -1
          }
          cursorShape={cursorShape}
          cursorAttr={cursorAttr}
          generation={generation}
        />
      ))}
    </Box>
  );
}
