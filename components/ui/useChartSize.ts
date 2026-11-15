"use client";

import { useEffect, useState } from "react";

/**
 * Pixel size of a chart container, kept current with a ResizeObserver.
 * Recharts is rendered with this explicit width/height instead of <ResponsiveContainer>,
 * which had sizing issues (see CLAUDE.md).
 *
 * Usage: `const [chartRef, size] = useChartSize();` then `<div ref={chartRef}>` and
 * render the chart once `size.width > 0 && size.height > 0`.
 */
export function useChartSize() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) {
      return;
    }

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));

      setSize((previous) =>
        previous.width === nextWidth && previous.height === nextHeight
          ? previous
          : { width: nextWidth, height: nextHeight },
      );
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [element]);

  return [setElement, size] as const;
}
