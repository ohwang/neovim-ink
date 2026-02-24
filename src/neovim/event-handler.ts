import type { NeovimClient } from "neovim";
import type { ScreenBuffer } from "../screen/screen-buffer.js";
import { log } from "../logger.js";

const HANDLED_EVENTS = new Set([
  "grid_resize",
  "grid_line",
  "grid_cursor_goto",
  "grid_scroll",
  "grid_clear",
  "hl_attr_define",
  "default_colors_set",
  "mode_info_set",
  "mode_change",
  "busy_start",
  "busy_stop",
  "flush",
  // Known but intentionally ignored:
  "option_set",
  "mouse_on",
  "mouse_off",
  "set_title",
  "set_icon",
  "chdir",
  "hl_group_set",
  "update_menu",
  "win_viewport",
]);

/**
 * Set up a handler for Neovim's `redraw` notification events.
 * Parses batched UI events and updates the screen buffer.
 * Calls `onFlush` when a `flush` event is received (i.e., frame is complete).
 */
export function setupRedrawHandler(
  client: NeovimClient,
  screen: ScreenBuffer,
  onFlush: () => void,
): void {
  client.on("notification", (method: string, args: unknown[]) => {
    if (method !== "redraw") {
      log("event", `non-redraw notification: ${method}`, args);
      return;
    }

    for (const event of args) {
      const arr = event as unknown[];
      const eventName = arr[0] as string;

      if (!HANDLED_EVENTS.has(eventName)) {
        log("event", `UNHANDLED redraw event: ${eventName}`, arr.slice(1));
      }

      // Each event can contain multiple parameter sets (arr[1..])
      for (let i = 1; i < arr.length; i++) {
        const params = arr[i] as unknown[];

        switch (eventName) {
          case "grid_resize":
            log("event", `grid_resize grid=${params[0]} ${params[1]}x${params[2]}`);
            screen.gridResize(
              params[0] as number,
              params[1] as number,
              params[2] as number,
            );
            break;

          case "grid_line":
            screen.gridLine(
              params[0] as number,
              params[1] as number,
              params[2] as number,
              params[3] as unknown[],
            );
            break;

          case "grid_cursor_goto":
            log("event", `grid_cursor_goto grid=${params[0]} row=${params[1]} col=${params[2]}`);
            screen.gridCursorGoto(
              params[0] as number,
              params[1] as number,
              params[2] as number,
            );
            break;

          case "grid_scroll":
            log("event", `grid_scroll grid=${params[0]} top=${params[1]} bot=${params[2]} left=${params[3]} right=${params[4]} rows=${params[5]}`);
            screen.gridScroll(
              params[0] as number,
              params[1] as number,
              params[2] as number,
              params[3] as number,
              params[4] as number,
              params[5] as number,
            );
            break;

          case "grid_clear":
            log("event", `grid_clear grid=${params[0]}`);
            screen.gridClear(params[0] as number);
            break;

          case "hl_attr_define":
            log("event", `hl_attr_define id=${params[0]}`, params[1]);
            screen.hlAttrDefine(
              params[0] as number,
              params[1] as Record<string, unknown>,
            );
            break;

          case "default_colors_set":
            log("event", `default_colors_set fg=${params[0]} bg=${params[1]} sp=${params[2]}`);
            screen.defaultColorsSet(
              params[0] as number,
              params[1] as number,
              params[2] as number,
            );
            break;

          case "mode_info_set":
            log("event", `mode_info_set`, params[1]);
            screen.modeInfoSet(
              params[0] as boolean,
              params[1] as unknown[],
            );
            break;

          case "mode_change":
            log("event", `mode_change mode=${params[0]} idx=${params[1]}`);
            screen.modeChange(
              params[0] as string,
              params[1] as number,
            );
            break;

          case "busy_start":
            log("event", "busy_start");
            screen.busyStart();
            break;

          case "busy_stop":
            log("event", "busy_stop");
            screen.busyStop();
            break;

          case "flush":
            log("event", `flush (generation=${screen.generation + 1}, cursor=row${screen.cursor.row}:col${screen.cursor.col} visible=${screen.cursor.visible} modeIdx=${screen.cursor.modeIdx})`);
            screen.flush();
            onFlush();
            break;

          case "option_set":
            log("event", `option_set ${params[0]}=${JSON.stringify(params[1])}`);
            break;

          // Intentionally ignored
          case "mouse_on":
          case "mouse_off":
          case "set_title":
          case "set_icon":
          case "chdir":
          case "hl_group_set":
          case "update_menu":
          case "win_viewport":
            break;
        }
      }
    }
  });
}
