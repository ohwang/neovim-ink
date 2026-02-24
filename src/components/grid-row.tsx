import React, { useMemo } from "react";
import { Text } from "ink";
import { renderRow, renderRowWithCursor } from "../screen/highlight.js";
import type { Cell, DefaultColors, HlAttr, ModeInfo } from "../screen/types.js";

interface Props {
  cells: Cell[];
  hlAttrs: Map<number, HlAttr>;
  defaultColors: DefaultColors;
  /** If this row contains the cursor, the column index. Otherwise -1. */
  cursorCol: number;
  /** Current cursor shape from mode info */
  cursorShape: ModeInfo["cursor_shape"];
  /** Highlight attributes for the cursor from mode_info_set attr_id */
  cursorAttr: HlAttr | undefined;
  /** Screen buffer generation counter — changes on each flush to bust memoization */
  generation: number;
}

export function GridRow({
  cells,
  hlAttrs,
  defaultColors,
  cursorCol,
  cursorShape,
  cursorAttr,
  generation,
}: Props) {
  const rendered = useMemo(() => {
    if (cursorCol >= 0) {
      return renderRowWithCursor(
        cells,
        hlAttrs,
        defaultColors,
        cursorCol,
        cursorShape,
        cursorAttr,
      );
    }
    return renderRow(cells, hlAttrs, defaultColors);
    // generation is included to force recomputation when the screen buffer flushes,
    // since cells are mutated in-place and their array reference doesn't change.
  }, [cells, hlAttrs, defaultColors, cursorCol, cursorShape, cursorAttr, generation]);

  return <Text>{rendered}</Text>;
}
