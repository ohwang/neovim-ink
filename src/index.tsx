#!/usr/bin/env node
import React, { useState, useCallback, useEffect } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import { NeovimEditor } from "./neovim-editor.js";
import { CatBackground } from "./components/cat-background.js";
import { useResize } from "./hooks/use-resize.js";
import { initLogger, closeLogger, log } from "./logger.js";
import type { NeovimInkConfig } from "./config.js";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { file?: string; size?: { width: number; height: number } } {
  const args = process.argv.slice(2);
  let file: string | undefined;
  let size: { width: number; height: number } | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--size" && args[i + 1]) {
      const match = args[i + 1]!.match(/^(\d+)x(\d+)$/);
      if (!match) {
        process.stderr.write(
          `Invalid --size format: ${args[i + 1]}. Expected WxH (e.g. 80x24)\n`,
        );
        process.exit(1);
      }
      size = { width: parseInt(match[1]!, 10), height: parseInt(match[2]!, 10) };
      i++; // skip the value
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        `Usage: neovim-ink [options] [file]\n\n` +
          `Options:\n` +
          `  --size WxH   Fixed editor size, centered on screen (e.g. 80x24)\n` +
          `  -h, --help   Show this help message\n`,
      );
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      file = arg;
    } else {
      process.stderr.write(`Unknown option: ${arg}\n`);
      process.exit(1);
    }
  }

  return { file, size };
}

// ---------------------------------------------------------------------------
// Exit screen — shown when Neovim exits, waiting for 'q' to quit
// ---------------------------------------------------------------------------

function ExitScreen({ width, height }: { width: number; height: number }) {
  const { exit } = useApp();

  useInput((input) => {
    if (input === "q") {
      exit();
    }
  });

  return (
    <Box
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
    >
      <Text color="#888888">No vim running</Text>
      <Text color="#555555">
        press <Text color="#ff69b4" bold>q</Text> to exit
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Blinking border + cat background for windowed mode
// ---------------------------------------------------------------------------

const BORDER_PINK = "#ff69b4";
const BORDER_DIM = "#5c2d4a";
const BLINK_INTERVAL_MS = 800;
const CAT_SCROLL_INTERVAL_MS = 200;

function WindowedCliApp({
  config,
  termSize,
  nvimRunning,
  onNvimExit,
}: {
  config: NeovimInkConfig;
  termSize: { columns: number; rows: number };
  nvimRunning: boolean;
  onNvimExit: () => void;
}) {
  const [borderBright, setBorderBright] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const blinkTimer = setInterval(() => {
      setBorderBright((b) => !b);
    }, BLINK_INTERVAL_MS);
    const scrollTimer = setInterval(() => {
      setScrollOffset((s) => s + 1);
    }, CAT_SCROLL_INTERVAL_MS);
    return () => {
      clearInterval(blinkTimer);
      clearInterval(scrollTimer);
    };
  }, []);

  // The border adds 2 cols and 2 rows. Clamp the editor so border + editor fits.
  const borderOverhead = 2;
  const editorWidth = Math.min(config.size!.width, termSize.columns - borderOverhead);
  const editorHeight = Math.min(config.size!.height, termSize.rows - borderOverhead);
  const outerWidth = editorWidth + borderOverhead;
  const outerHeight = editorHeight + borderOverhead;

  const padTop = Math.max(0, Math.floor((termSize.rows - outerHeight) / 2));
  const padLeft = Math.max(0, Math.floor((termSize.columns - outerWidth) / 2));

  const borderColor = nvimRunning
    ? (borderBright ? BORDER_PINK : BORDER_DIM)
    : "#555555";

  return (
    <Box width={termSize.columns} height={termSize.rows} flexDirection="column">
      {/* Background layer: cats fill the entire terminal */}
      <Box position="absolute" width={termSize.columns} height={termSize.rows}>
        <CatBackground
          width={termSize.columns}
          height={termSize.rows}
          scrollOffset={scrollOffset}
        />
      </Box>
      {/* Foreground layer: centered editor with blinking border */}
      <Box height={padTop} />
      <Box>
        <Box width={padLeft} />
        <Box
          borderStyle="round"
          borderColor={borderColor}
          flexDirection="column"
          width={outerWidth}
          height={outerHeight}
        >
          {nvimRunning ? (
            <NeovimEditor
              width={editorWidth}
              height={editorHeight}
              config={{ ...config, onExit: onNvimExit }}
            />
          ) : (
            <ExitScreen width={editorWidth} height={editorHeight} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// CLI wrapper component
// ---------------------------------------------------------------------------

function CliApp({ config }: { config: NeovimInkConfig }) {
  const [termSize, setTermSize] = useState({
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  });
  const [nvimRunning, setNvimRunning] = useState(true);

  useResize(
    useCallback((w: number, h: number) => {
      log("cli", `terminal resize: ${w}x${h}`);
      setTermSize({ columns: w, rows: h });
    }, []),
  );

  const handleNvimExit = useCallback(() => {
    log("cli", "neovim exited, showing exit screen");
    setNvimRunning(false);
  }, []);

  if (config.size) {
    return (
      <WindowedCliApp
        config={config}
        termSize={termSize}
        nvimRunning={nvimRunning}
        onNvimExit={handleNvimExit}
      />
    );
  }

  // Fullscreen mode
  if (!nvimRunning) {
    return (
      <ExitScreen width={termSize.columns} height={termSize.rows} />
    );
  }

  return (
    <NeovimEditor
      width={termSize.columns}
      height={termSize.rows}
      config={{ ...config, onExit: handleNvimExit }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { file, size } = parseArgs();

const config: NeovimInkConfig = {
  file,
  size,
};

initLogger();
log("init", `args: file=${file ?? "(none)"} size=${size ? `${size.width}x${size.height}` : "(fullscreen)"}`);

// Enter alternate screen buffer for a fullscreen experience
process.stdout.write("\x1b[?1049h");
// Hide cursor initially
process.stdout.write("\x1b[?25l");
// Enable SGR mouse mode (button events + SGR extended coordinates)
process.stdout.write("\x1b[?1000h\x1b[?1006h");

const instance = render(<CliApp config={config} />, {
  exitOnCtrlC: false, // Let Neovim handle Ctrl+C
  patchConsole: false, // Don't intercept console; we're fullscreen
  maxFps: 60,
  incrementalRendering: true,
});

instance.waitUntilExit().then(() => {
  log("init", "exiting");
  closeLogger();
  // Disable SGR mouse mode
  process.stdout.write("\x1b[?1006l\x1b[?1000l");
  // Show cursor again
  process.stdout.write("\x1b[?25h");
  // Leave alternate screen buffer
  process.stdout.write("\x1b[?1049l");
  process.exit(0);
});
