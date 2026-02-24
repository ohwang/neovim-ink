/** Configuration for the NeovimEditor component. */
export interface NeovimInkConfig {
  /** File path to open in Neovim's initial buffer. */
  file?: string;

  /**
   * Fixed size for the editor grid. If omitted, fills the provided width/height.
   * Used by the CLI to center a fixed-size editor on screen.
   */
  size?: { width: number; height: number };

  /**
   * Extra args passed to `nvim --embed` (e.g. `["--clean"]`, `["-u", "NONE"]`).
   * Defaults to `["--clean"]`.
   */
  nvimArgs?: string[];

  /** Whether to show the bottom chrome/status bar. Defaults to true. */
  showChrome?: boolean;

  /** Custom chrome label (right side). Defaults to " neovim-ink ". */
  chromeLabel?: string;

  /** Called when the Neovim process exits. */
  onExit?: () => void;
}

export const DEFAULT_CONFIG = {
  nvimArgs: ["--clean"],
  showChrome: true,
  chromeLabel: " neovim-ink ",
} as const satisfies Partial<NeovimInkConfig>;
