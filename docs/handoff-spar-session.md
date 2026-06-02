# Хэндофф для новой сессии — Axion / SPAR section

> Скопируй этот блок целиком в новую Claude-сессию. В конце есть пустая секция
> «What I want next» — туда впиши свои новые правки.

---

## Project

**Axion** — editorial marketing site for an agentic AI decision platform.

- Path: `/Users/Viacheslav/Desktop/Axion Astro/`
- Stack: Astro 6 + Tailwind v4 (`@theme` tokens, **no** `tailwind.config.js`) +
  GSAP + Lenis + TypeScript strict + pnpm + Biome
- Project conventions live in [`CLAUDE.md`](/Users/Viacheslav/Desktop/Axion%20Astro/CLAUDE.md)
  and [`docs/frontend-conventions.md`](/Users/Viacheslav/Desktop/Axion%20Astro/docs/frontend-conventions.md)
  — **read both before touching CSS or assets.**

## Hard rules you MUST follow

1. **Layout = grid or flex.** Never `position: absolute` for content placement.
   Decorative overlays / element-internal stacking are OK per the allowlist in
   `CLAUDE.md` rule #8 — **but** the process rule says: **ask the user before
   writing any new `position: absolute` or `position: fixed`** even if it
   clearly fits an allowlist. Wait for explicit "да / yes / ok".
2. **Logical properties only.** `inset-inline-start`, `block-size`, never
   `left` / `width`.
3. **Tokens, not magic numbers.** Tokens live in `src/styles/global.css` under
   `@theme`. Promote local component tokens up if they get reused.
4. **No fixed `px` for layout.** Spacing / typography via tokens, `clamp()`,
   `rem`, `%`. `px` allowed for borders/strokes only.
5. **Em-based breakpoints** (`@media (max-width: 48em)`, not `640px`).
6. **`:focus-visible` on everything interactive.** Global default in
   `global.css`.
7. **`prefers-reduced-motion: reduce`** wrap on any animation > 0.2s.
8. **No `!important` without a `/* why: ... */` comment.**
9. **English / Latin alphabet ONLY** in identifiers, classes, filenames. No
   transliterated Russian (`plashka`, `kartochka`). Russian stays in chat /
   commits / Figma comments.
10. **All media assets optimized for web with maximum quality preservation —**
    smallest file that's visually-lossless at **2× retina display size**. Raw
    editor exports never ship. ffmpeg / avifenc / cwebp recipes in
    `docs/frontend-conventions.md`. Rule #20 in `CLAUDE.md`.
11. **Text swaps use the hard-mask pattern** (rule #18 / `docs/frontend-conventions.md`).
    `overflow: hidden` mask = exactly one line-height, `translateY(±100%)`,
    `var(--dur-hover) var(--ease-out-soft)`. For multi-line: **one mask per
    line**, not a tall combined mask. SPAR's `.spar__headline-line-mask` is the
    canonical reference.
12. **Motion system** — use shared tokens, don't invent local curves:
    - `--ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1)` — hover micro
    - `--ease-morph: cubic-bezier(0.32, 0.72, 0, 1)` — large transitions
    - `--dur-hover: 0.5s` — every hover effect on a component shares this
    - `--dur-morph: 0.7s` / `--dur-morph-fast: 0.38s` — modal in/out

## How to run

Dev server: `pnpm dev --port 4322` (port 4322 because the user runs `vshslv.com`
on 4321 — **do not collide**). `.claude/launch.json` already configured for
this. URL: <http://localhost:4322/>.

```bash
cd "/Users/Viacheslav/Desktop/Axion Astro"
pnpm dev --port 4322
```

Vercel project is linked (`.vercel/project.json`, project `axion`, team
`77LwvsJnfxrGXxNaCH7yeoW2`) but **the CLI isn't authenticated in this env** —
deploys need `vercel login` first.

## Current state of SPAR (the focus of recent work)

[`src/components/SPAR.astro`](/Users/Viacheslav/Desktop/Axion%20Astro/src/components/SPAR.astro)
is a stories-style section with 4 slides (Sense, Predict, Act, React).

### Visual layout

```
┌────────────────────────────────────────────────────────────┐
│                      [SPAR Framework]              ← pill │
│                                                            │
│                                                            │
│                        Predict          ← label mask      │
│                                                            │
│             Spot the risk before        ← headline (2     │
│             the violation                    per-line     │
│                                              masks)        │
│                                                            │
│      [Risk Agent(s) predicts potential risks]  ← caption  │
│                                                  pill      │
│                                                            │
│       [████ Sense ] [████ Predict*] [Act] [React]         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

`*` = currently playing (faint border + SVG progress drawing white over 5s).

### Background

3 transition videos (`/spar/{1-2,2-3,3-4}{-hevc.mp4,.webm}`) for Sense→Predict,
Predict→Act, Act→React. Their seam frames match exactly so swapping which is
"active" reads as one continuous stream.

2 loop videos (`/spar/{1,4}loop{-hevc.mp4,.webm}`) for Sense and React — animated
rest frames for the bookend slides. Seam frame of 1loop == first frame of
transitions[0], so swap is invisible.

4 poster JPGs (`/spar/poster-{sense,predict,act,react}.jpg`, ~100-140KB lazy-loaded)
as **skeleton** behind videos. Video has `data-loaded="true"` set on `loadeddata`;
the CSS rule `.spar__bg-video[data-state="active"][data-loaded="true"]` reveals
the video over the poster.

All videos are dual-codec HEVC MP4 + WebM VP9, encoded to fit
`docs/frontend-conventions.md` budgets.

### State machine (sequential timing)

```js
enterStaticPhase(N) → 5s timer → enterMorphPhase(N) → video.ended → enterStaticPhase(N+1)
```

- **Static phase (5s):** loop or paused transition frame, progress bar fills,
  data-current on card N.
- **Morph phase (~5s):** transition[N] plays forward, data-current REMOVED
  (progress fades out), cumulative stays at N (next card NOT highlighted).
- **At morph end:** text masks swap to slide N+1, cumulative advances, new
  progress starts on card N+1.

Pause/resume on `axion:idle` / `axion:active` and tab `visibilitychange`.
Stop machine when SPAR overlap with viewport < 50%; restart from slide 0 on
re-entry.

### Hard preload gate

`startMachine()` blocks until all 5 videos hit `readyState >= 2`. While loading,
section has `data-loading="true"`; the poster is visible as skeleton. If user
clicks a step pill before ready, the click is remembered as the start target.

### Step pills (kart sind кнопкы)

Each `.spar__step` is now a real `<button type="button">` inside a `<li>`.
Click → `enterStaticPhase(idx)` (instant jump, no morph in either direction).
Keyboard accessible, `aria-label="Jump to {label}"`.

### Mask details (don't break these)

- **Hard-mask swap** on label, headline-line, caption-text.
- `overflow: hidden` on the mask cell, candidate at `translateY(100%)` (next)
  or `translateY(-100%)` (past) or `translateY(0)` (active).
- **Each state ALSO has `opacity` set** (`active: 1`, `past/next: 0`) — safety
  net for descender/ascender glyphs that protrude past the mask edge since
  `line-height: 0.89` is tighter than the em-box. Transition includes both
  `transform` and `opacity`.
- Headline uses **two stacked per-line masks**, not a combined mask. Each
  candidate has `white-space: nowrap`. React's 2nd line is empty string so
  layout doesn't shift.
- Caption mask: outer `.spar__caption` = glass chrome with padding; inner
  `.spar__caption-mask` owns `overflow: hidden` and the exact one-line cell.
  **Don't combine them** — combined chrome+mask has a cell taller than one
  line, so `translateY(100%)` leaks the candidate into the padding zone.

### Step card details

- Step card = `<button class="spar__step">` with internal grid stack of label
  + SVG progress overlay.
- `data-state` is cumulative ("active" = past or current; "inactive" = future)
  — drives the underlying solid-white-vs-faint border.
- `data-current` is set on exactly ONE step. Drives the SVG progress keyframe
  animation. The card's CSS rule `[data-current="true"] { border-color: faint }`
  intentionally makes the underlying border faint while the SVG strokes white
  on top — when data-current is removed, the SVG opacity transitions to 0 with
  the dashoffset locked at its current value via inline style (so the
  fade-out reads as "completed bar dissolving" not "snap empty then fade").

### MiniVideoPill hide

The floating CTA pill (`<MiniVideoPill />`, becomes visible after About
section) is hidden while SPAR owns ≥ 50% of the viewport. The check is a raw
`getBoundingClientRect` overlap calc on every `lenis.on('scroll')` + native
`scroll` + `resize` — IntersectionObserver and ScrollTrigger callbacks both
proved unreliable in some headless rendering pipelines, and pin coordinate
shifts confuse them. The attribute toggled is `data-hidden-by-spar="true"`
on the pill; the CSS rule lives in `MiniVideoPill.astro`.

### ScrollTrigger usage

Only `pin: true` with `pinSpacing: true` and `end: "+=${lastSlideIdx * 100}%"`.
**No** `scrub`, **no** `snap`, **no** `onUpdate`. State machine drives all
content changes independently. Pin just locks the section in viewport during
the pin range.

Native scrollbar is hidden site-wide in `global.css` (Lenis owns scroll feel;
without hiding, pinned sections' pin-spacers make the scrollbar handle imply
"a lot more content below" while the viewport shows pinned content).

## What you should NOT touch unless explicitly asked

- **Header.astro, About.astro, Features.astro, MiniVideoPill.astro, Navbar.astro**
  — they're stable. Changes to one of these affect the entire site rhythm
  (`--space-section-divider`, `--space-section-title-gap` tokens).
- **The `intro-loop-*` videos in `/public/bg/`** — used by Header.
- **`src/lib/scrollBridge.ts`** — single source of truth for Lenis ↔ ScrollTrigger
  handshake. Components import `ensureLenisBridge` from there.

## Recent session summary (what just landed)

In rough order:

1. Built SPAR section per Figma (4 slides, video bg, label, headline, caption,
   step pills).
2. Optimized 3 transition videos: 4K HEVC sources (~60 MB total) → dual-codec
   1080p (~16.6 MB HEVC + ~10.9 MB WebM total). `keyint=24` + default
   B-frames for scrub-friendly seek (though scrub is no longer used).
3. Added loop videos for Sense + React (1loop, 4loop) — ~800 KB to ~2 MB each.
4. Generated 4 poster JPGs for skeleton loading.
5. Codified rule #20 ("All media assets optimized for web with maximum quality
   preservation at 2× retina") in `CLAUDE.md` and `docs/frontend-conventions.md`.
6. Switched scroll model from scrub-driven → snap-play → sequential state
   machine. Removed scrub/snap/onUpdate from ScrollTrigger; pin only.
7. Per-line headline masks (line 1 + line 2, each one line-height tall) for
   variable-line-count headlines without multi-line clipping.
8. Step pills became real `<button>` elements with click handlers and keyboard
   support; cursor pointer, hover lift, focus ring.
9. Hard preload gate — state machine blocked until all 5 videos hit
   `readyState >= 2`. Click-before-ready remembered as start target.
10. Hidden native scrollbar site-wide (`scrollbar-width: none` + WebKit rule).
11. Caption pill moved from bottom-left to under the headline (in
    `.spar__center`).
12. Opacity 0 on past/next states across all text masks — kills descender/
    ascender artifacts from `line-height: 0.89` being tighter than em-box.
13. MiniVideoPill hide uses bounding-rect overlap check via `lenis.on('scroll')`
    + native scroll + resize, not ScrollTrigger callbacks (which were
    unreliable in this scenario).

## Debugging notes from the session

- **Preview tool quirks**: programmatic scrolls (`lenis.scrollTo` with
  `immediate: true`) sometimes don't fire ScrollTrigger `onEnter` / `onLeave`
  callbacks or `IntersectionObserver` callbacks. Native `scroll` event +
  `lenis.on('scroll')` + manual `getBoundingClientRect` overlap calc is the
  most reliable lowest-common-denominator.
- **Page idle**: when `data-idle` is set on `<html>` (8s no input), the global
  CSS pauses all `animation-play-state`. CSS *transitions* are not affected,
  but `setTimeout`-driven state advances continue. The state machine pauses
  itself on `axion:idle` / `axion:active` and `document.visibilitychange` to
  keep visuals in sync.
- **CSS animation restart** requires `removeAttribute → void el.offsetWidth →
  setAttribute`. Without the explicit reflow the browser may optimize and skip
  the restart, leaving the progress bar at its previous (often "completed")
  state.
- **Whitespace text nodes** inside JSX-style flex containers (e.g. between
  `<span class="spar__headline-line">…</span>` siblings) become flex items and
  add phantom line-heights. The fix on `.spar__headline`: `font-size: 0;
  line-height: 0;` on the flex container, with typography moved to the line
  spans themselves.

---

## What I want next

[Впиши сюда свои новые правки. Например:
 - «Хочу чтобы при клике на пилюлю текущий слайд не рестартовал, а продолжил»
 - «Сделай что Headline появлялся через slide-in справа налево а не снизу»
 - «Добавь Background blur при наведении на step-кнопки»
 - «Текст слайдов должен подсвечиваться gradient'ом проходящим по тексту»]

