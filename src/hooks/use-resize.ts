import { useEffect } from "react";
import { useStdout } from "ink";

/**
 * Hook that watches for terminal resize events
 * and notifies the callback with new (full) terminal dimensions.
 */
export function useResize(
  onResize: (width: number, height: number) => void,
): void {
  const { stdout } = useStdout();

  useEffect(() => {
    const handler = () => {
      const cols = stdout.columns ?? 80;
      const rows = stdout.rows ?? 24;
      onResize(cols, rows);
    };

    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout, onResize]);
}
