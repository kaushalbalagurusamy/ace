// The Pebble Beach Golf Links card (docs/research/reference-sources.md: SFGATE 2000 U.S. Open card, hole 2 played as a par 5).
export const CARD: readonly { par: number; yards: number }[] = [
  [4, 381], [5, 502], [4, 390], [4, 331], [3, 188], [5, 524], [3, 106], [4, 418], [4, 466],
  [4, 446], [4, 380], [3, 202], [4, 406], [5, 573], [4, 397], [4, 403], [3, 208], [5, 543],
].map(([par, yards]) => ({ par: par!, yards: yards! }));
