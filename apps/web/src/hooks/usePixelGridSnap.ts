export function usePixelGridSnap(_pixelSize?: number) {
  // TODO: Implement pixel grid snapping logic
  return {
    snapToGrid: (value: number) => value,
    snapVector: (x: number, y: number, z: number): [number, number, number] => [x, y, z],
  };
}
