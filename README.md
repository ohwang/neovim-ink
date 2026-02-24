# neovim-ink

An embeddable Neovim editor component for [Ink](https://github.com/vadimdemedes/ink) (React for the terminal). Use it as a standalone CLI or embed a full Neovim instance inside your own Ink-based TUI app.

> **Note:** The code in this repository was entirely written by AI (Claude).

## Features

- Full Neovim UI via `nvim --embed` and msgpack-rpc (`ext_linegrid` protocol)
- 24-bit RGB color, cursor shapes (block/vertical/horizontal), highlight attributes
- Embeddable `<NeovimEditor>` React component with configurable dimensions and chrome
- Standalone CLI with `--size WxH` windowed mode (blinking border, scrolling ASCII cats)
- Terminal resize handling
- TypeScript, fully typed

## Install

```bash
npm install neovim-ink
```

Requires `nvim` on your `PATH`.

## CLI usage

```bash
# Fullscreen
npx neovim-ink

# Open a file
npx neovim-ink README.md

# Fixed-size window, centered on screen
npx neovim-ink --size 80x24

# Both
npx neovim-ink --size 100x30 src/index.tsx
```

## Library usage

```tsx
import React from "react";
import { render, Box, Text } from "ink";
import { NeovimEditor } from "neovim-ink";

function App() {
  return (
    <Box flexDirection="column" width={80} height={24}>
      <Box height={1}>
        <Text bold>My TUI App</Text>
      </Box>
      <NeovimEditor
        width={80}
        height={22}
        config={{
          file: "README.md",
          showChrome: false,
          nvimArgs: ["--clean"],
        }}
      />
      <Box height={1}>
        <Text dimColor>:q to close editor</Text>
      </Box>
    </Box>
  );
}

render(<App />);
```

## API

### `<NeovimEditor>`

| Prop | Type | Description |
|------|------|-------------|
| `width` | `number` | Editor width in columns (required) |
| `height` | `number` | Editor height in rows, including chrome bar (required) |
| `config` | `NeovimInkConfig` | Configuration object (optional) |

### `NeovimInkConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `file` | `string` | — | File to open in the initial buffer |
| `size` | `{width, height}` | — | Fixed editor size (CLI uses this for centering) |
| `nvimArgs` | `string[]` | `["--clean"]` | Args passed to `nvim --embed` |
| `showChrome` | `boolean` | `true` | Show the bottom status bar |
| `chromeLabel` | `string` | `" neovim-ink "` | Right-side label in the chrome bar |
| `onExit` | `() => void` | — | Called when the Neovim process exits |

### `useNeovim(width, height, config?)`

Lower-level hook for direct access to the Neovim screen buffer and client. Returns `{ screen, client, sendInput, resize, frameCount }`.

## License

MIT
