import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";

// A collection of small ASCII cats — each is an array of lines, same width.
const CATS = [
  [
    "  /\\_/\\  ",
    " ( o.o ) ",
    "  > ^ <  ",
  ],
  [
    " /\\_/\\  ",
    "( -.- ) ",
    " (\")(\") ",
  ],
  [
    "  ^  ^  ",
    " (o  o) ",
    "C(\")(\") ",
  ],
  [
    " |\\__/| ",
    " /o  o\\ ",
    "(  >w<  )",
  ],
  [
    "  /\\_/\\  ",
    " ( ^.^ ) ",
    " /|   |\\ ",
  ],
  [
    " A   A ",
    "(=^.^=)",
    " (\")(\") ",
  ],
];

const CAT_HEIGHT = 3;
// Fixed tile width — pad each cat line to this width
const TILE_WIDTH = 12;
// Vertical spacing between cat rows
const TILE_HEIGHT = CAT_HEIGHT + 1;

interface Props {
  width: number;
  height: number;
  /** Horizontal scroll offset, updated by parent timer */
  scrollOffset: number;
}

/**
 * Renders a tiled field of ASCII cats that scrolls horizontally.
 * Each "tile" is a cat padded into a fixed-width cell. The cats are
 * arranged in a grid with alternating row offsets for visual interest.
 */
export function CatBackground({ width, height, scrollOffset }: Props) {
  // Number of tiles needed to fill width, plus extras for scroll wrapping
  const tilesPerRow = Math.ceil(width / TILE_WIDTH) + 2;

  const lines: string[] = [];

  for (let screenRow = 0; screenRow < height; screenRow++) {
    // Which tile-row are we in, and which line within the cat?
    const tileRow = Math.floor(screenRow / TILE_HEIGHT);
    const lineInTile = screenRow % TILE_HEIGHT;

    if (lineInTile >= CAT_HEIGHT) {
      // Spacer row between cat rows
      lines.push(" ".repeat(width));
      continue;
    }

    // Offset even/odd rows for a staggered pattern
    const rowShift = (tileRow % 2) * Math.floor(TILE_WIDTH / 2);
    const effectiveOffset = scrollOffset + rowShift;

    let fullLine = "";
    for (let t = 0; t < tilesPerRow; t++) {
      // Pick a cat deterministically based on position
      const catIdx = ((tileRow * 7 + t * 3) % CATS.length + CATS.length) % CATS.length;
      const cat = CATS[catIdx]!;
      const catLine = cat[lineInTile] ?? "";
      fullLine += catLine.padEnd(TILE_WIDTH);
    }

    // Apply horizontal scroll by rotating the string
    const totalLen = fullLine.length;
    const shift = ((effectiveOffset % totalLen) + totalLen) % totalLen;
    const scrolled = fullLine.slice(shift) + fullLine.slice(0, shift);

    lines.push(scrolled.slice(0, width));
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color="#4a3a5c" dimColor>
          {line}
        </Text>
      ))}
    </Box>
  );
}
