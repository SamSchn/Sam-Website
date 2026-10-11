// Garden plots are a logical grid (cols x rows) laid out as beds with a
// one-tile walkway between them. This maps a plot to its map tile.
export function farmCell(farm, c, r) {
  return {
    tx: farm.x + c + Math.floor(c / farm.bedW),
    ty: farm.y + r + Math.floor(r / farm.bedH),
  };
}

/** Size of the bed area in tiles. */
export function farmSize(farm) {
  return {
    w: farm.cols + Math.floor((farm.cols - 1) / farm.bedW),
    h: farm.rows + Math.floor((farm.rows - 1) / farm.bedH),
  };
}
