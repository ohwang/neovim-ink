import { spawn, type ChildProcess } from "node:child_process";
import { attach, type NeovimClient } from "neovim";

export interface NeovimProcess {
  client: NeovimClient;
  proc: ChildProcess;
}

export function startNeovim(args: string[] = []): NeovimProcess {
  const proc = spawn("nvim", ["--embed", ...args], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const client = attach({ proc: proc as unknown as NodeJS.Process });

  return { client, proc };
}
