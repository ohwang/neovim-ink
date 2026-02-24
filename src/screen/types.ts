/** A single cell in the screen buffer */
export interface Cell {
  text: string; // UTF-8 character (empty string for right half of wide char)
  hlId: number; // Highlight attribute ID (0 = default)
}

/** Highlight attributes from hl_attr_define (rgb_attr) */
export interface HlAttr {
  foreground?: number; // 24-bit RGB
  background?: number; // 24-bit RGB
  special?: number; // 24-bit RGB for underlines
  reverse?: boolean;
  italic?: boolean;
  bold?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  undercurl?: boolean;
  underdouble?: boolean;
  underdotted?: boolean;
  underdashed?: boolean;
  blend?: number;
}

/** Mode information from mode_info_set */
export interface ModeInfo {
  cursor_shape?: "block" | "horizontal" | "vertical";
  cell_percentage?: number;
  attr_id?: number;
  name?: string;
  short_name?: string;
}

/** Current cursor state */
export interface CursorState {
  grid: number;
  row: number;
  col: number;
  modeIdx: number;
  visible: boolean;
}

/** Default colors from default_colors_set */
export interface DefaultColors {
  fg: number;
  bg: number;
  sp: number;
}
