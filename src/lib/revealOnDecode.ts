/**
 * Reveal an `<img>` only once it's fully DECODED (not merely downloaded).
 * `img.decode()` avoids the visible top-to-bottom rendering of large images on
 * slow connections — the browser hands back a ready-to-paint frame, so the
 * reveal is all-or-nothing.
 *
 * `onReady` ALWAYS fires — on decode success, decode failure, or load error —
 * so the caller never gets stuck on a skeleton. Shared by Header / Features /
 * Footer (the LQIP → poster reveal step of the shared `.hero__bg` recipe).
 */
export const revealOnDecode = (
  img: HTMLImageElement,
  onReady: () => void,
): void => {
  const ready = (): void => onReady();
  if (img.complete && img.naturalWidth > 0) {
    img.decode().then(ready).catch(ready);
  } else {
    img.addEventListener("load", () => img.decode().then(ready).catch(ready), {
      once: true,
    });
    img.addEventListener("error", ready, { once: true });
  }
};
