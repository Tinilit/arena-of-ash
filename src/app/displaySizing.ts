export const logicalSize = { width: 1280, height: 720 } as const;
// Cover native 5K and 1440p Retina without allocating an unbounded 8K+ canvas.
export const maximumDensity = 4;

/** Keep game coordinates fixed while sizing the backing buffer for physical pixels. */
export function displaySize(
  width: number,
  height: number,
  dpr: number,
  limit = maximumDensity,
) {
  const positive = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const fit = Math.min(
    positive(width, logicalSize.width) / logicalSize.width,
    positive(height, logicalSize.height) / logicalSize.height,
  );
  const cap = Math.max(
    1,
    Math.floor(Math.min(maximumDensity, positive(limit, maximumDensity)) * 8) /
      8,
  );
  // Small buckets avoid reallocating GPU buffers for every pixel while dragging a window.
  const density = Math.min(
    cap,
    Math.max(1, Math.ceil(fit * positive(dpr, 1) * 8) / 8),
  );
  return {
    density,
    width: logicalSize.width * density,
    height: logicalSize.height * density,
  };
}
