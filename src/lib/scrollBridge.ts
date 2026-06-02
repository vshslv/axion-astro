/**
 * scrollBridge.ts — single source of truth for the Lenis ↔ ScrollTrigger
 * handshake. Components that use GSAP ScrollTrigger call ensureLenisBridge()
 * to subscribe ScrollTrigger.update to Lenis's per-frame scroll event. The
 * function is idempotent — first caller installs the listener, subsequent
 * callers are no-ops thanks to the __lenisScrollTriggerHooked flag on
 * window.
 *
 * Why polling: Lenis lives in BaseLayout's script, which is module-deferred
 * AFTER component-level scripts in DOM order, so window.__lenis may not
 * exist on the component script's first tick. We use setTimeout (not
 * requestAnimationFrame): when document.hidden the browser heavily throttles
 * or fully pauses RAF, which would leave the bridge un-installed on any
 * background tab.
 *
 * Usage:
 *   import gsap from "gsap";
 *   import { ScrollTrigger } from "gsap/ScrollTrigger";
 *   import { ensureLenisBridge } from "../lib/scrollBridge";
 *
 *   gsap.registerPlugin(ScrollTrigger);
 *   ensureLenisBridge(ScrollTrigger);
 */
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

type LenisWindow = Window & {
  __lenis?: Lenis;
  __lenisScrollTriggerHooked?: boolean;
};

export function ensureLenisBridge(ST: typeof ScrollTriggerType): void {
  const w = window as LenisWindow;

  const setup = (): boolean => {
    if (w.__lenis && !w.__lenisScrollTriggerHooked) {
      w.__lenisScrollTriggerHooked = true;
      w.__lenis.on("scroll", ST.update);
      /* Refresh any triggers that were created before the bridge so they
         re-evaluate against the now-bridged scroll position. */
      ST.refresh();
      return true;
    }
    return Boolean(w.__lenisScrollTriggerHooked);
  };

  if (setup()) return;
  const tick = (): void => {
    if (!setup()) window.setTimeout(tick, 16);
  };
  window.setTimeout(tick, 16);
}
