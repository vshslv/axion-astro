# Frontend Conventions

Project-wide CSS / HTML / responsive rules. These apply on top of the stack
choices in `CLAUDE.md`. When the stack-specific rules in `CLAUDE.md` conflict
with a general rule here, the stack rules win for this project (e.g. Tailwind
v4 is authorized here, even though these conventions discourage CSS frameworks
in general).

## Stack & approach

- Vanilla HTML/CSS/JS by default (Webflow-compatible code) — Astro is OK because
  it emits plain HTML/CSS/JS with no runtime.
- Modern CSS: nesting, `:has()`, `:is()`, `:where()`, container queries,
  logical properties.
- No CSS frameworks like Bootstrap. Tailwind only if explicitly asked
  (this project explicitly uses Tailwind v4 — see `CLAUDE.md`).
- Mobile-first via fluid scaling, not via breakpoints.

## Design tokens

Everything goes through CSS custom properties in `:root` (Tailwind v4 `@theme`
block in this project). No magic numbers in component styles.

```css
:root {
  /* Spacing scale — fluid via clamp(min, base + Xvw, max) */
  --space-3xs: clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem);
  --space-2xs: clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem);
  --space-xs:  clamp(0.75rem, 0.6rem + 0.75vw, 1rem);
  --space-sm:  clamp(1rem, 0.8rem + 1vw, 1.5rem);
  --space-md:  clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem);
  --space-lg:  clamp(2rem, 1.6rem + 2vw, 3rem);
  --space-xl:  clamp(3rem, 2.4rem + 3vw, 4.5rem);
  --space-2xl: clamp(4rem, 3.2rem + 4vw, 6rem);
  --space-3xl: clamp(6rem, 4.8rem + 6vw, 9rem);

  /* Global page padding — single horizontal gutter for the site */
  --page-padding: clamp(1rem, 4vw, 2.5rem);
  --content-max: 1440px;
  --content-narrow: 768px;

  /* Type scale — fluid */
  --text-xs:   clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.825rem + 0.25vw, 1rem);
  --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --text-lg:   clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
  --text-xl:   clamp(1.5rem, 1.3rem + 1vw, 2rem);
  --text-2xl:  clamp(2rem, 1.6rem + 2vw, 3rem);
  --text-3xl:  clamp(3rem, 2.4rem + 3vw, 4.5rem);
  --text-display: clamp(3.5rem, 2.5rem + 5vw, 7rem);

  /* Line heights, radii */
  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}
```

**Project override:** Axion uses a larger display headline (max 11.25rem / 180px
to match Figma). The brand-specific `--text-display` in `global.css` takes
precedence over the generic value above.

## Layout

- Global padding always through `--page-padding`, never a hardcoded value.
- Use logical properties: `padding-inline`, `margin-block`, `inset`,
  `inline-size`, `block-size`.
- Container pattern:

  ```css
  .container {
    inline-size: 100%;
    max-inline-size: var(--content-max);
    margin-inline: auto;
    padding-inline: var(--page-padding);
  }
  ```

- Grid and Flexbox for everything. No floats, no fixed px widths in components
  except for asset borders/strokes.
- Sections use `padding-block: var(--space-2xl)` etc.

### When `position: absolute` / `position: fixed` are OK

The "grid/flex for everything" rule applies to **page reading flow** — headings,
paragraphs, sections, buttons, cards laid out as part of the document.

`position: absolute` is the right tool when an element is:

- A **decorative overlay** layered on or inside another element — background
  images / videos, vignettes, gradients, particle canvases, SVG filter wrappers
  (hidden `<svg width="0" height="0">` defs), liquid-glass internals
  (`liquid__filter`, `liquid__overlay`, `liquid__specular`), rim SVGs, blur layers.
- A **custom interactive surface stacked inside its parent** — a play button
  overlaid on a video thumbnail, a play/pause icon over media, a badge pinned
  to a card corner, a tooltip arrow.
- **Element-internal stacking** of layers that visually compose one component
  — the foreignObject blur inside Intelligence text, layered glass effects.

`position: fixed` is the right tool for **viewport-anchored UI**:

- Modals / dialogs / popovers (use the native `<dialog>` element — its
  `::backdrop` pseudo-element handles the overlay, and `showModal()` gives
  built-in focus trap + Escape close).
- Custom cursors, drag previews.
- Sticky toasts, scroll-progress bars.
- Fixed top nav, floating action buttons.

**Rule of thumb:** if the element is part of the page's reading flow, use grid/flex.
If it floats above, inside, or beside that flow as decoration / overlay / chrome,
`absolute` or `fixed` is fine.

## Responsive

- Liquid-first: `clamp()` for typography, spacing, sizes.
- Container queries (`@container`) for components.
- `@media` only when layout structure changes (1 → 2 → 3 columns).
- No more than 2–3 breakpoints per component.
- Breakpoints in `em` / `rem`, not `px`.

## Naming

- BEM-like: `.card`, `.card__title`, `.card--featured`.
- Or semantic state via data-attributes: `[data-state="active"]`.
- Utilities in kebab-case, tokens too.
- No `div1`, `wrapper-2`, `mt-23px`.

## Anti-patterns — do not do these

- ❌ Fixed `px` values for spacing or font sizes in components.
- ❌ `width: 100vw` (causes horizontal scroll because of scrollbar).
- ❌ Inline `style="..."` except for critical runtime values.
- ❌ `!important` without a comment explaining why.
- ❌ Non-semantic `<div>` wrappers when `<section>`, `<article>`, `<nav>`,
  `<figure>`, `<header>`, `<footer>` apply.
- ❌ Pixel-based media queries without a reason — use `em`/`rem`.

## Accessibility

- Semantic HTML by default.
- `:focus-visible` styles mandatory for every interactive element.
- `@media (prefers-reduced-motion: reduce)` for all animations.
- AA contrast minimum.

## Loading states (skeletons)

All loading placeholders across the site follow the same rules:

1. **B&W only.** Skeletons read as "this element is loading" — they must not
   compete visually with brand color. Apply `filter: grayscale(1)` if the
   placeholder source has color (e.g. LQIPs).
2. **Shimmer or pulse, not spinners.** Skeletons take the shape of the eventual
   content so layout never shifts on load.
3. **Reusable `.skeleton` utility** lives in `src/styles/global.css`. Apply to
   any block-level element that holds the eventual content's bounding box:

   ```html
   <div class="skeleton" style="block-size: 12rem; border-radius: var(--radius-lg);">
     <!-- real content fades in over this via JS -->
   </div>
   ```

   It paints a grayscale shimmer (`background-position` animated through a
   semi-transparent gradient). Respects `prefers-reduced-motion: reduce`.

### Progressive image loading

For images that need a "feels-instant" experience (hero backgrounds, big
photos), use the three-stage pattern:

1. **LQIP (Low Quality Image Placeholder)** — generate a ~20-32px wide JPG with
   `ffmpeg` or `sharp`, base64-encode it (~300-500 bytes), embed inline in CSS
   as `background-image: url("data:image/jpeg;base64,...")`. Zero network spend,
   visible the moment HTML parses. Add `filter: grayscale(1) blur(20-28px)` +
   `transform: scale(1.05-1.1)` (to hide blur edges).
2. **Full image** — load eagerly (`loading="eager"` + `fetchpriority="high"`),
   start at `opacity: 0`, fade in once `img.decode()` resolves. Decoding before
   reveal is the difference between "instant" and "top-to-bottom rendering" on
   slow connections.
3. **Video** (if applicable) — preload `metadata`, fade in on `canplaythrough`.

### Connection-aware behavior

Always check `navigator.connection.saveData`, `effectiveType`, and
`prefers-reduced-motion` before loading large media. On Save-Data /
2g / reduced-motion, drop video entirely and keep the static poster as
the final state. Reference implementation lives in `Header.astro`.

### Pattern: decode-then-reveal

```ts
const revealOnDecode = (img: HTMLImageElement, onReady: () => void) => {
  const ready = () => onReady();
  if (img.complete && img.naturalWidth > 0) {
    img.decode().then(ready).catch(ready);
  } else {
    img.addEventListener("load", () => img.decode().then(ready).catch(ready), { once: true });
    img.addEventListener("error", ready, { once: true });
  }
};
```

This wraps `img.decode()` so the image only reveals once the browser has a
fully-decoded frame in hand — no visible progressive rendering on slow links.

## Image assets

Every image on the site is web-optimized — raw camera / Figma exports never
ship. The rule (`CLAUDE.md` #20) is shared with video: **ship the smallest
file that still looks visually-lossless at 2× retina display size.** Every
image goes through a compression pass before commit.

### Budgets

| Surface | Max resolution (px wide) | Format | File size |
|---|---|---|---|
| Hero / full-bleed photo | ~1920 | AVIF + JPEG | ≤250 KB |
| Card background | ~1500 | AVIF + JPEG | ≤150 KB |
| Product screenshot | ~1500 | AVIF + PNG | ≤300 KB |
| Thumbnail / poster | ~720 | AVIF + JPEG | ≤80 KB |
| Icon (raster fallback) | ~256 | PNG via pngquant | ≤20 KB |

Resolution cap is **2× the largest dimension the image is rendered at** —
e.g. a card image that reads at 600px wide on the largest desktop layout
sources at ~1200px. Anything bigger gets downscaled on retina and is
wasted bandwidth.

### Format — modern + fallback

`<picture>` lets the browser pick the best decode it supports:

```html
<picture>
  <source srcset="/img/hero.avif" type="image/avif" />
  <source srcset="/img/hero.webp" type="image/webp" />
  <img
    src="/img/hero.jpg"
    alt="..."
    width="1920" height="1080"
    loading="lazy"
    decoding="async"
  />
</picture>
```

- **AVIF** — best compression (30-50% smaller than JPEG at same quality).
  Supported by Chrome / Firefox / Safari 16.4+. Use for photos.
- **WebP** — broader support than AVIF, still ~25% smaller than JPEG.
  Optional middle tier; you can skip it if AVIF is already the primary.
- **JPEG** — universal fallback for photos.
- **PNG** — only when transparency or sharp UI graphics are required.
  Always pass through `pngquant`.
- **SVG** — preferred for icons / logos. Inline when small, `<img>` when
  reusable across pages.

Always include `width` and `height` on `<img>` so the layout doesn't shift
when the bitmap lands.

### Compression recipes

Visually-lossless targets — the user shouldn't see a difference vs the
source unless they zoom in:

```bash
# AVIF — photos. -q 75 ≈ JPEG 90 quality, ~40% smaller.
avifenc -q 75 --speed 4 -y 420 source.png hero.avif

# WebP — photos (use if AVIF is overkill or you want broader fallback).
cwebp -q 80 -m 6 -metadata none source.png -o hero.webp

# JPEG (mozjpeg) — fallback photos.
cjpeg -quality 84 -progressive -optimize -outfile hero.jpg source.png

# Quick JPEG re-compress with ffmpeg (no mozjpeg dependency).
ffmpeg -i source.jpg -q:v 3 -map_metadata -1 hero.jpg

# PNG — only for transparency / UI. pngquant lossy strip.
pngquant --quality=70-90 --strip --speed 1 --force --output icon.png source.png

# Resize before compressing — use ImageMagick or ffmpeg.
ffmpeg -i source.png -vf "scale=1920:-2" resized.png
magick source.png -resize 1920x -strip resized.png
```

Strip metadata (`--strip`, `-map_metadata -1`, `cwebp -metadata none`).
EXIF / color profiles often add 30-100 KB for no visual benefit on web.

### LQIP — for hero / big images

A ~24px-wide JPEG, base64-encoded, inlined as `background-image` — visible
the moment HTML parses (zero network round-trip). Recipe:

```bash
# 24px wide LQIP, ~300-500 bytes
magick source.jpg -resize 24x -strip -quality 50 lqip.jpg
base64 -i lqip.jpg | tr -d '\n'   # paste into CSS as data:image/jpeg;base64,...
```

Apply with `filter: grayscale(1) blur(20-28px)` and `transform: scale(1.08)`
so the blur doesn't show jagged edges. The full image then fades in over
the LQIP once `img.decode()` resolves (see `revealOnDecode` helper above,
and `Header.astro` / `Features.astro` for the reference implementations).

### When NOT to optimize

- **SVG** — already optimal; just run through `svgo` once to strip cruft.
- **Below the fold thumbnails** that the user will likely never see — let
  `loading="lazy"` carry them, don't over-engineer the format split.
- **Assets that only show in one place at one size** — single-format is fine.
  The `<picture>` overhead pays off when there's a real size difference.

## Video assets

Every `<video>` on the site is web-optimized — raw editor exports never ship.
The rule (`CLAUDE.md` #20) is operational: every asset goes through an ffmpeg
pass before commit. Detailed budgets and recipes here.

### Budgets

| Surface | Max resolution | Bitrate | File size (per codec) |
|---|---|---|---|
| Hero loop / full-bleed | 1920×1080 | ≤4 Mbps | ≤10 MB |
| Card background loop | ~1440×900 | ≤2 Mbps | ≤5 MB |
| Scrub-driven transition | 1920×1080 | ≤9 Mbps* | ≤6 MB |
| Thumbnail / pip | 720p | ≤1.5 Mbps | ≤2 MB |

Resolution cap is **2× the largest display size** — anything beyond is wasted
bandwidth on a retina downscale. The Header's full-screen intro video targets
1920×1080 because that's the largest desktop, not because the source was 4K.

\*Scrub-driven content (where JS sets `currentTime` from scroll) keeps
default B-frames AND short keyframe interval, which lifts bitrate vs
a static loop. SPAR's transitions ship at ~9 Mbps HEVC, ~6 Mbps WebM —
the budget reflects this trade-off, not a regression.

### Codec — dual-ship

The reference pair lives in `public/bg/`:

- `intro-loop-hevc.mp4` (57 KB) — HEVC for Safari / iOS (smaller at the same
  quality, Safari can decode in hardware).
- `intro-loop.webm` (134 KB) — VP9 / AV1 WebM for Firefox + Chromium (those
  don't ship HEVC by default on most installs).

Markup picks per browser:

```html
<video muted loop playsinline preload="metadata">
  <source src="/bg/intro-loop-hevc.mp4" type="video/mp4; codecs=hvc1" />
  <source src="/bg/intro-loop.webm"     type="video/webm" />
</video>
```

The `type` attribute is important — without `codecs=hvc1`, Chrome will try
the HEVC MP4 first, fail, and only then fall back to WebM, adding a
round-trip of wasted decode work.

### ffmpeg recipe — background loop

Strip audio, normalize, dual-encode. Adjust `-crf` (quality) and `-b:v`
(bitrate) if the output exceeds budget — lower CRF = higher quality + larger
file.

```bash
# Input: source.mp4 (any codec, any resolution)
# Output: bg.mp4 (HEVC) + bg.webm (VP9)

# HEVC MP4 — Safari/iOS path
ffmpeg -i source.mp4 \
  -an \                                        # strip audio
  -vf "scale='min(1920,iw)':-2,fps=30" \       # cap width 1920, keep aspect, 30fps
  -c:v libx265 -tag:v hvc1 \                   # HEVC + Apple-friendly tag
  -crf 28 -preset slow \                       # quality 28 ≈ visually-lossless at 1080p
  -movflags +faststart \                       # MOOV atom at front for streaming
  bg-hevc.mp4

# WebM VP9 — Firefox/Chromium path
ffmpeg -i source.mp4 \
  -an \
  -vf "scale='min(1920,iw)':-2,fps=30" \
  -c:v libvpx-vp9 \
  -b:v 2M -crf 32 \                            # bitrate cap + quality target
  -row-mt 1 -tile-columns 2 \                  # parallel encode
  bg.webm
```

For card / thumbnail surfaces, drop the scale cap to `1440` or `1280` and
shave another 30-40% off the file.

### ffmpeg recipe — scrub-driven transition

For videos where `currentTime` is set by scroll (e.g. SPAR transitions),
the encoder needs to be tuned for **fast seek** without sacrificing too
much compression:

```bash
# HEVC MP4 — Safari/iOS, scrub-friendly
ffmpeg -i source.mp4 \
  -an \
  -vf "scale='min(1920,iw)':-2" \              # keep source fps; don't re-time
  -c:v libx265 -tag:v hvc1 \
  -preset slow -crf 28 \
  -x265-params "keyint=24:min-keyint=24:no-scenecut=1" \  # 1s keyframe interval
  -movflags +faststart \
  transition-hevc.mp4

# WebM VP9 — Chromium/Firefox, scrub-friendly
ffmpeg -i source.mp4 \
  -an \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libvpx-vp9 \
  -b:v 4M -crf 28 -maxrate 6M -bufsize 12M \  # bounded VBR + quality target
  -g 24 -keyint_min 24 \                      # 1s keyframe interval
  -deadline good -cpu-used 2 \
  -row-mt 1 -tile-columns 2 \
  transition.webm
```

Key differences vs the loop recipe:

- **Short keyframe interval** (`keyint=24` = 1s at 24fps). Each seek
  decodes at most 1s of forward video. Without this, the default ~10s
  interval makes a seek to `t=4s` decode 4 full seconds — visible lag.
- **Default B-frames kept.** It's tempting to disable them (`bframes=0`)
  to make seeks instant, but it nearly halves HEVC compression efficiency.
  Modern decoders handle short B-frame runs well; the trade-off lands on
  the side of file size.
- **No `fps=30` filter.** Re-timing the source confuses scroll-to-time
  mapping. Keep source fps (the SPAR sources are 24fps and stay 24fps).
- **Higher bitrate cap on WebM** (4 Mbps bounded VBR) — keeps quality on
  fast-motion transitions where the default `-b:v 2M` would show
  visible compression.

Reference pair: `public/spar/1-2-hevc.mp4` (5.3 MB) + `public/spar/1-2.webm`
(3.7 MB). Driven by JS in `src/components/SPAR.astro`.

### Looped seams

A loop has to be **frame-perfect**: the last frame must match the first.
Trim with `-t` to an integer-second duration, or use a video editor to
verify the seam before exporting. A visible jump at the loop point is the
fastest way to make a slick design look amateur.

### Decode gating

Multiple background videos on one page each get their own decode pipeline —
4 cards × autoplay-loop = 4 simultaneous decodes that the GPU is paying for
even on cards the user can't see. Solution: IntersectionObserver gates
playback so only the in-view element decodes.

Reference implementation in `src/components/Features.astro` (the `<script>`
block at the bottom). It also subscribes to `axion:idle` / `axion:active`
events so videos pause when the user steps away.

```ts
const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const v = entry.target as HTMLVideoElement;
      if (entry.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  },
  { rootMargin: "200px 0px", threshold: 0.01 }
);
```

### Save-Data + reduced-motion

Check `navigator.connection.saveData` and `prefers-reduced-motion: reduce`
before enabling autoplay. On either, skip the video entirely and show a
static poster frame. Reference: the connection-aware block in
`Header.astro`.

## Text swap animations (hard-mask pattern)

Every animated text transition on the site — hover labels, cursor pills,
state-driven copy changes, button text swaps — uses the same mask-clip
pattern. The visual rule: text travels through a rectangle that's exactly
one line-height tall, with no padding inside the mask. Outgoing line slides
up out of the box, incoming line slides up into place from below. No opacity
crossfade — the mask does all the clipping.

This makes every swap on the site feel mechanically consistent (same easing,
same vertical motion, same crisp clip edges).

### Anatomy

```html
<span class="mask">
  <span class="text" data-text="default">How it works</span>
  <span class="text" data-text="hover">Play</span>
</span>
```

```css
.mask {
  display: inline-grid;             /* or `grid` for block-level masks */
  grid-template-areas: "stack";
  overflow: hidden;
  /* THE hard rule: mask = exactly one rendered line */
  block-size: calc(var(--text-sm) * var(--leading-snug));
}

.text {
  grid-area: stack;                 /* all candidates share the same cell */
  display: block;
  white-space: nowrap;
  transition: transform 0.45s var(--ease-text-swap);
}

.text[data-text="default"] { transform: translateY(0); }
.text[data-text="hover"]   { transform: translateY(100%); }

@media (hover: hover) {
  .container:hover .text[data-text="default"] { transform: translateY(-100%); }
  .container:hover .text[data-text="hover"]   { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .text { transition: none; }
}
```

### Rules

- **Mask is exactly `block-size: calc(font-size × line-height)`.** Never
  larger, never with padding inside. The text MUST sit flush with the mask
  edges so `translateY(±100%)` clears it perfectly.
- **Use `line-height: var(--leading-snug)` (1.3), NEVER `1`.** At
  `line-height: 1` the line-box equals one em, but glyph descenders
  (the tails of `y`, `g`, `p`, `q`, `j`) extend BELOW the box. The mask
  clips those — visible as a sliced character at rest. 1.3 gives just
  enough breathing room without bloating the mask. The hero label uses
  it, the cursor pill uses it.
- **Transform only.** `translateY(100%)` parks below, `translateY(0)` is
  active, `translateY(-100%)` is gone. No intermediate states.
- **No `opacity` transitions on swap text.** The mask is the clip — opacity
  fade muddies the effect.
- **Shared easing token.** Use `var(--ease-text-swap)` (defined in
  `global.css`) for every swap. Don't invent local curves.
- **Wrap in `prefers-reduced-motion: reduce`** to disable the transition.
  The default state remains visible — content never disappears.
- **Multiple candidates?** All sit in `grid-area: stack` together. Active
  one at `translateY(0)`, the others at `translateY(-100%)` (already-shown)
  or `translateY(100%)` (queued). For state-driven swaps see
  `.custom-cursor__mask` in `Header.astro` — the three states (close / play
  / pause) all share one mask.

### When to use this pattern

- Any label that has a hover variant
- Any state machine UI that shows different copy per state (cursor labels,
  play/pause indicators, "follow"/"following" buttons, etc.)
- Button hover copy ("Submit" → "Sending…")
- Number tickers (each digit gets its own mask)

### When NOT to use

- Long-form prose changes (don't try to mask a paragraph — use a fade).
- Multi-line strings (one mask = one line; for two lines use two stacked
  masks with synchronized timing).
- Content reveals on scroll (use `IntersectionObserver` + opacity/transform
  combo there — different beast).

## Motion system

Two easing curves, three durations. Nothing else.

### Tokens

```css
:root {
  /* Curves */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);  /* hover micro-interactions */
  --ease-morph:    cubic-bezier(0.32, 0.72, 0, 1);  /* large transitions      */

  /* Durations */
  --dur-hover:       0.5s;   /* every hover effect on a component shares this */
  --dur-morph:       0.7s;   /* modal/page transitions, FLIP in               */
  --dur-morph-fast:  0.38s;  /* close / morph out — snappier than open        */
}
```

### Character

- **`--ease-out-soft` (out-quart)** — soft entry, snappy resolution, gentle
  landing. Reads as "fast but expensive." Use for any hover state, mask text
  swap, and small UI feedback.
- **`--ease-morph`** — pronounced ease-out used by Apple's stories/sheets.
  Use for any large transition (modal FLIP, view transition).

### The sync rule

When more than one thing animates on the same component at the same time
(hover scale on a card, lift on the wrapper, label text swap, etc.), they
all MUST share the same `transition: transform var(--dur-hover) var(--ease-out-soft);`
shorthand. Mismatched curves or durations look like bugs.

Example — video widget hover:

```css
.hero__video { transition: transform var(--dur-hover) var(--ease-out-soft); }
.hero__video-poster { transition: transform var(--dur-hover) var(--ease-out-soft); }
.hero__video-play { transition: transform var(--dur-hover) var(--ease-out-soft); }
.hero__video-label-text { transition: transform var(--dur-hover) var(--ease-out-soft); }
```

All four hover simultaneously, all four resolve simultaneously.

### Reduced motion

Wrap any transition longer than `0.2s` in:

```css
@media (prefers-reduced-motion: reduce) {
  .my-thing { transition: none; }
}
```

The CTA hover (`translateY(-1px)` on `:hover`) is fine without — sub-frame
position changes don't count.

### When to deviate

If a motion legitimately needs a different feel (a long scroll-driven
parallax, a slow ambient pulse), define a new local easing in `global.css`
as a named token and document why. Don't litter components with raw
`cubic-bezier()` values.

## Buttons

### Default behavior

Every button on the site — CTA, primary, secondary, icon-with-text —
follows the same baseline:

1. **Text is non-selectable.** Add `user-select: none` on the button (or
   `.liquid__content` for liquid-glass CTAs). For `<a>`-as-button, also
   add `-webkit-user-drag: none;` so the browser doesn't kick in its
   link-drag gesture on mousedown.
2. **Text hover uses the hard-mask swap** (rule #18). Default state shows
   the label, hover state shows a duplicate of the same text sliding up
   from below. The duplicate gets `aria-hidden="true"` so screen readers
   read the label once.
3. **No copy change needed** — the lift IS the affordance. You CAN swap to
   different copy (e.g. "Submit" → "Sending…") for state-driven buttons,
   but for plain hover the same-text duplicate is the convention.
4. **All hover transitions sync to `var(--dur-hover) var(--ease-out-soft)`**
   (motion section above) so the text lift, any scale, any color shift,
   any glow all resolve together.
5. **`:focus-visible` styles inherited from the global ring** in
   `global.css` (rule #14). Don't override unless the button has its own
   focus visual.

### Markup template

```astro
<a class="liquid__content my-btn" href="...">
  <span class="my-btn__label">
    <span class="my-btn__label-text" data-text="default">Click me</span>
    <span class="my-btn__label-text" data-text="hover" aria-hidden="true">Click me</span>
  </span>
</a>
```

### CSS template

```css
.my-btn__label {
  display: inline-grid;
  grid-template-areas: "stack";
  overflow: hidden;
  font-size: var(--text-xs);
  line-height: var(--leading-snug);
  block-size: calc(var(--text-xs) * var(--leading-snug));
}

.my-btn__label-text {
  grid-area: stack;
  white-space: nowrap;
  transition: transform var(--dur-hover) var(--ease-out-soft);
}

.my-btn__label-text[data-text="default"] { transform: translateY(0); }
.my-btn__label-text[data-text="hover"]   { transform: translateY(100%); }

@media (hover: hover) {
  .my-btn:hover .my-btn__label-text[data-text="default"] { transform: translateY(-100%); }
  .my-btn:hover .my-btn__label-text[data-text="hover"]   { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .my-btn__label-text { transition: none; }
}
```

That's the whole convention. Same structure for every button — only the BEM
prefixes change.
