/**
 * Idle CPU/GPU saver for looping background videos. The contract (shared by
 * Features and Footer, and mirroring the hero):
 *
 *   - `axion:idle`   → set `data-video-idle` on the bg element (the component's
 *                      CSS fades the video out), then pause `pauseDelay` ms
 *                      later so the last frame never freezes mid-transition.
 *                      The fade hides the pause moment. If the tab is hidden,
 *                      pause immediately — no fade buffer, nobody can see it.
 *   - `axion:active` → clear the idle state and resume, but only for pairs
 *                      currently in the viewport (off-screen ones stay paused;
 *                      that's `gateVideosByVisibility`'s job).
 *
 * Syncs once on setup in case the global idle tracker (BaseLayout) already
 * fired `axion:idle` before this subscribed — a tight race on slow connections
 * that would otherwise leave a video playing under idle. Returns a disposer.
 */

export type IdleVideoPair = {
  /** Element carrying the `data-video-idle` attribute the CSS fades on. */
  bg: HTMLElement;
  video: HTMLVideoElement;
};

export const setupIdleVideoPause = (
  pairs: IdleVideoPair[],
  { pauseDelay = 900 }: { pauseDelay?: number } = {},
): (() => void) => {
  if (pairs.length === 0) return () => {};
  const timers = new WeakMap<HTMLElement, number>();

  const onIdle = (): void => {
    for (const { bg, video } of pairs) {
      bg.setAttribute("data-video-idle", "true");
      const existing = timers.get(bg);
      if (existing !== undefined) window.clearTimeout(existing);
      if (document.hidden) {
        if (!video.paused) video.pause();
        continue;
      }
      const timer = window.setTimeout(() => {
        if (bg.hasAttribute("data-video-idle") && !video.paused) video.pause();
      }, pauseDelay);
      timers.set(bg, timer);
    }
  };

  const onActive = (): void => {
    for (const { bg, video } of pairs) {
      const existing = timers.get(bg);
      if (existing !== undefined) window.clearTimeout(existing);
      bg.removeAttribute("data-video-idle");
      /* Only resume pairs actually on screen — the visibility gate keeps the
         rest paused. */
      const rect = video.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        video.play().catch(() => {});
      }
    }
  };

  document.addEventListener("axion:idle", onIdle);
  document.addEventListener("axion:active", onActive);
  /* Sync once if the tracker already fired idle before we subscribed. */
  if (document.documentElement.hasAttribute("data-idle")) onIdle();

  return () => {
    document.removeEventListener("axion:idle", onIdle);
    document.removeEventListener("axion:active", onActive);
  };
};
