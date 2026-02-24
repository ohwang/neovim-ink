// Public API
export { NeovimEditor } from "./neovim-editor.js";
export type { NeovimEditorProps } from "./neovim-editor.js";
export { useNeovim } from "./hooks/use-neovim.js";
export type { UseNeovimResult } from "./hooks/use-neovim.js";
export type { NeovimInkConfig } from "./config.js";
export { DEFAULT_CONFIG } from "./config.js";

// Screen types for advanced consumers
export { ScreenBuffer } from "./screen/screen-buffer.js";
export type { Cell, HlAttr, DefaultColors, ModeInfo, CursorState } from "./screen/types.js";

// Mouse event types
export { parseMouseEvent, isMouseSequence } from "./neovim/mouse.js";
export type { MouseEvent } from "./neovim/mouse.js";
