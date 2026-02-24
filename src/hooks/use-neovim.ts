import { useState, useEffect, useRef, useCallback } from "react";
import type { NeovimClient } from "neovim";
import type { ChildProcess } from "node:child_process";
import { startNeovim } from "../neovim/process.js";
import { setupRedrawHandler } from "../neovim/event-handler.js";
import { ScreenBuffer } from "../screen/screen-buffer.js";
import { log } from "../logger.js";
import { DEFAULT_CONFIG, type NeovimInkConfig } from "../config.js";

export interface UseNeovimResult {
  screen: ScreenBuffer;
  client: NeovimClient | null;
  sendInput: (keys: string) => void;
  resize: (w: number, h: number) => void;
  frameCount: number;
}

export function useNeovim(
  width: number,
  height: number,
  config: NeovimInkConfig = {},
): UseNeovimResult {
  const clientRef = useRef<NeovimClient | null>(null);
  const procRef = useRef<ChildProcess | null>(null);
  const screenRef = useRef(new ScreenBuffer(width, height));
  const [frameCount, setFrameCount] = useState(0);

  // Capture config values in a ref so the effect doesn't re-run on config changes.
  // These values are only used at startup (nvim spawn + ui_attach).
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const cfg = configRef.current;
    const nvimArgs = [...(cfg.nvimArgs ?? DEFAULT_CONFIG.nvimArgs)];
    if (cfg.file) {
      nvimArgs.push(cfg.file);
    }

    const { client, proc } = startNeovim(nvimArgs);
    clientRef.current = client;
    procRef.current = proc;

    // Handle nvim process exit
    proc.on("exit", () => {
      configRef.current.onExit?.();
    });

    const init = async () => {
      // Wait for API to be ready
      await client.channelId;

      // Enable 24-bit RGB colors before attaching UI
      await client.request("nvim_set_option_value", [
        "termguicolors",
        true,
        {},
      ]);

      // Attach UI with ext_linegrid for modern grid protocol
      await client.request("nvim_ui_attach", [
        width,
        height,
        { rgb: true, ext_linegrid: true },
      ]);

      // Set up redraw handler
      setupRedrawHandler(client, screenRef.current, () => {
        setFrameCount((c) => c + 1);
      });
    };

    init().catch((err) => {
      process.stderr.write(`Failed to initialize neovim: ${err}\n`);
    });

    return () => {
      client.request("nvim_ui_detach", []).catch(() => {});
      proc.kill();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendInput = useCallback((keys: string) => {
    clientRef.current?.input(keys);
  }, []);

  const resize = useCallback((w: number, h: number) => {
    log("resize", `useNeovim.resize(${w}, ${h})`);
    // Only tell Neovim the new size. Neovim will send a grid_resize event
    // back, which the event handler uses to resize the screen buffer.
    // Do NOT manually call screen.gridResize here — that would resize the
    // buffer with stale content before Neovim has redrawn.
    clientRef.current
      ?.request("nvim_ui_try_resize", [w, h])
      .catch(() => {});
  }, []);

  return {
    screen: screenRef.current,
    client: clientRef.current,
    sendInput,
    resize,
    frameCount,
  };
}
