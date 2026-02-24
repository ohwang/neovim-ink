# Supported Features

Feature inventory for neovim-ink. The primary use case is **prompt editing** —
a lightweight embedded Neovim for composing text, not a full daily-driver frontend.

Toggle legend: `[x]` = verified working, `[ ]` = not implemented, `[~]` = partial / untested.

---

## Input Handling

### Basic Keys
- [x] Letters, numbers, punctuation (passthrough)
- [x] Space (`<Space>`)
- [x] Return / Enter (`<CR>`)
- [x] Escape (`<Esc>`)
- [x] Backspace (`<BS>`, handles macOS 0x7F)
- [x] Tab (`<Tab>`)
- [x] Shift+Tab (`<S-Tab>`)

### Modifier Keys
- [x] Ctrl+letter (`<C-a>` through `<C-z>`)
- [x] Alt/Meta+letter (`<A-a>` through `<A-z>`)
- [ ] Ctrl+Alt+letter (`<C-A-x>`)
- [~] Ctrl+symbol (`<C-.>`, `<C-/>`, etc. — depends on terminal/Ink parsing)
- [~] Shift+letter (may arrive as uppercase char, not `<S-a>`)

### Navigation Keys
- [x] Arrow keys (Up, Down, Left, Right)
- [x] Shift+Arrow
- [x] Ctrl+Arrow
- [x] Alt+Arrow
- [x] Home / End
- [x] PageUp / PageDown

### Function Keys
- [ ] F1–F12
- [ ] Shift/Ctrl/Alt + function keys

### Special Input
- [x] Special char escaping (`<lt>`, `<Bslash>`, `<Bar>`)
- [x] Unicode / multibyte characters (CJK double-width, accented chars, symbols)
- [x] Paste detection (multi-char input routed to `nvim_paste()` API)
- [ ] Mouse click / drag / scroll
- [ ] Dead keys / compose sequences
- [ ] IME (Input Method Editor)

---

## Neovim UI Protocol (ext_linegrid)

### Grid Events
- [x] `grid_resize` — resize grid dimensions
- [x] `grid_line` — cell content updates (text, hlId, repeat)
- [x] `grid_cursor_goto` — cursor position
- [x] `grid_scroll` — region scrolling (up/down, partial regions)
- [x] `grid_clear` — clear entire grid

### Highlight / Color Events
- [x] `hl_attr_define` — define highlight attributes by ID
- [x] `default_colors_set` — default fg/bg/special colors
- [x] hlId carry (coalesce from previous cell when unspecified)

### Mode Events
- [x] `mode_info_set` — cursor shape definitions per mode
- [x] `mode_change` — active mode switch
- [x] `busy_start` / `busy_stop` — cursor visibility

### Frame Events
- [x] `flush` — frame complete, trigger re-render

### Option Events
- [~] `option_set` — logged but not acted on

### Intentionally Ignored Events
- [x] `mouse_on` / `mouse_off` (no mouse support)
- [x] `set_title` / `set_icon`
- [x] `chdir`
- [x] `hl_group_set`
- [x] `update_menu`
- [x] `win_viewport`

### Not Implemented
- [ ] Multi-grid (secondary grids silently ignored)
- [ ] Floating windows (`win_float_pos`, `win_external_pos`)
- [ ] Message/cmdline UI extensions (`ext_cmdline`, `ext_messages`, `ext_popupmenu`)
- [ ] Tabline extension (`ext_tabline`)
- [ ] Wildmenu extension (`ext_wildmenu`)

---

## Rendering

### Text Attributes
- [x] 24-bit RGB foreground
- [x] 24-bit RGB background
- [x] 24-bit RGB special/underline color
- [x] Bold
- [x] Italic
- [x] Strikethrough
- [x] Reverse (fg/bg swap)

### Underline Variants
- [x] Underline (plain)
- [x] Undercurl (`4:3m` — terminal support varies)
- [x] Underdouble (`4:2m` — terminal support varies)
- [x] Underdotted (`4:4m` — terminal support varies)
- [x] Underdashed (`4:5m` — terminal support varies)

### Not Rendered
- [ ] Blend / transparency (parsed but unused)
- [x] Dim / faint
- [ ] Blink
- [ ] Overline

### Cursor
- [x] Block cursor (inverts fg/bg)
- [x] Horizontal cursor (underline)
- [x] Vertical cursor (left-eighth-block `▏` bar character)
- [ ] Cursor blinking (via ANSI, not timer)
- [x] Cursor `attr_id` highlight (mode-specific cursor color)
- [ ] Cursor `cell_percentage` (partial-height cursor)

### Wide Characters
- [x] Double-width chars (empty string in right cell)
- [~] Emoji rendering (depends on terminal)

---

## Screen Buffer

- [x] 2D cell grid (text + hlId per cell)
- [x] Grid resize (grow/shrink, preserves content)
- [x] Scroll regions (up/down, partial rows/columns)
- [x] Per-row dirty tracking
- [x] Generation counter for React memoization
- [ ] Multi-grid buffers
- [ ] Floating window layers

---

## Component / Architecture

### NeovimEditor Component
- [x] Configurable width/height via props
- [x] Resize when props change (calls `nvim_ui_try_resize`)
- [x] Optional chrome bar (bottom status line)
- [x] Configurable chrome label
- [x] `onExit` callback when Neovim process exits
- [x] Custom nvim args (`--clean`, `-u NONE`, etc.)
- [x] Open file on startup

### CLI
- [x] Positional file argument
- [x] `--size WxH` windowed mode with centering
- [x] `--help` flag
- [x] Alternate screen buffer management
- [x] Terminal resize handling
- [x] Exit screen ("press q to exit") when Neovim closes
- [x] Scrolling ASCII cat background (windowed mode)
- [x] Blinking pink border (windowed mode)

### Library Exports
- [x] `NeovimEditor` component
- [x] `useNeovim` hook
- [x] `NeovimInkConfig` type
- [x] `ScreenBuffer` class
- [x] Screen types (`Cell`, `HlAttr`, `ModeInfo`, `CursorState`, `DefaultColors`)

---

## Neovim Modes (via mode_change)

- [x] Normal mode
- [x] Insert mode
- [x] Visual mode
- [x] Command-line mode
- [x] Replace mode
- [x] Visual Block mode (`<C-v>`, block selection, cursor movement)
- [x] Visual Line mode (`V`, line selection)
- [~] Terminal mode (not tested)
- [x] Operator-pending mode (`d`, `c`, `y` + motion)

---

## Testing Coverage

### Unit Tests
- [x] ScreenBuffer: constructor, gridLine, gridScroll, gridResize, gridClear, hlAttrDefine, defaultColorsSet, modeInfoSet, modeChange, busyStart/Stop, flush (38 tests)
- [x] Input translation: all key types, modifiers, special chars, edge cases (23 tests)
- [x] Highlight rendering: renderRow, renderRowWithCursor, all attributes, cursor shapes, cursorAttr, dim (29 tests)

### Integration Tests (real Neovim process)
- [x] UI attach, initial flush, mode_info_set, default_colors, hl_attr_define
- [x] Insert mode, typing, backspace, replace text
- [x] Normal mode navigation (h, l, 0, $, gg)
- [x] Line operations (o, dd)
- [x] Command-line mode
- [x] Undo / redo
- [x] Visual mode, Visual Line mode, Visual Block mode
- [x] Operator-pending mode
- [x] Search (/)
- [x] Resize (nvim_ui_try_resize)
- [x] Resize with chrome row adjustment
- [x] Cursor attr_id resolution (normal mode, insert mode)
- [x] Paste via nvim_paste (insert mode, normal mode, multiline, special chars, empty, large block)
- [x] Unicode / wide characters (CJK double-width, mixed ASCII+CJK, accented chars, symbols)

### Not Tested
- [ ] Function keys
- [ ] Mouse input
- [ ] Large file performance
- [ ] Floating window events (not implemented)
- [ ] Concurrent resize + input
- [ ] Neovim crash recovery
- [ ] Multiple NeovimEditor instances
- [ ] Long-running session stability
