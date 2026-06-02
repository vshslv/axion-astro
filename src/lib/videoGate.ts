/**
 * Decode-gate looping background videos by viewport visibility: a video only
 * runs a decoder while it's on (or near) screen, so N autoplay loops on one
 * page don't all decode at once. Plays on intersect, pauses when it leaves.
 *
 * `rootMargin` defaults to 200px so playback starts just before the element
 * scrolls into view. Returns a disposer that disconnects the observer.
 *
 * Shared by Features (4 cards) and Footer (1 background loop). Header's hero
 * background is a scroll-driven AVIF canvas, not a looping video, so it doesn't
 * use this.
 */
export const gateVideosByVisibility = (
  videos: HTMLVideoElement[],
  {
    rootMargin = "200px 0px",
    threshold = 0.01,
  }: { rootMargin?: string; threshold?: number } = {},
): (() => void) => {
  if (videos.length === 0) return () => {};
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const v = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      }
    },
    { rootMargin, threshold },
  );
  for (const v of videos) io.observe(v);
  return () => io.disconnect();
};
