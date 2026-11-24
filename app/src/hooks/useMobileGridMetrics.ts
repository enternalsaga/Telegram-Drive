import { useEffect, useState, type RefObject } from 'react';

const GRID_GAP = 10;

function metricsForWidth(width: number) {
  const columns = width < 360 ? 2 : 3;
  return {
    columns,
    estimatedRowHeight: (width - ((columns - 1) * GRID_GAP)) / columns,
  };
}

export function useMobileGridMetrics(ref: RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = useState(() => metricsForWidth(288));
  const [element, setElement] = useState<HTMLElement | null>(null);

  // The list is absent while a folder is loading (or empty). Track the actual
  // element after every commit so an observer is attached when streamed files
  // cause it to appear later.
  useEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });

  useEffect(() => {
    if (!element) return;

    const update = (width: number) => {
      if (width > 0) setMetrics(metricsForWidth(width));
    };
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(entries => update(entries[0]?.contentRect.width ?? element.clientWidth));

    update(element.clientWidth);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [element]);

  return metrics;
}
