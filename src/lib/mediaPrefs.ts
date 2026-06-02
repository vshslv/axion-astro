/**
 * Shared media-loading preferences — Save-Data / slow-network / reduced-motion
 * detection. One source of truth for the contract in CLAUDE.md rule 20: ship
 * heavy media (the hero AVIF sequence, looping background videos) only when the
 * connection and motion preference allow it; otherwise the poster is the final
 * state.
 *
 * Read once at call time (connection + matchMedia are queried synchronously).
 * Used by Header, Features, and Footer.
 */

export type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

export type MediaPrefs = {
  /** Save-Data is on, or the effective connection is `slow-2g` / `2g`. */
  slowConnection: boolean;
  /** The user prefers reduced motion. */
  reduceMotion: boolean;
};

/** Snapshot the connection + reduced-motion preference at call time. */
export const detectMediaPrefs = (): MediaPrefs => {
  const connection = (navigator as Navigator & { connection?: ConnectionLike })
    .connection;
  const slowConnection =
    connection?.saveData === true ||
    ["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  return { slowConnection, reduceMotion };
};
