# CLAUDE.md — Axion

## Project context

- **Product:** Axion — digital product (parent: The Datum AI, `info@thedatum.ai`).
- **Site type:** editorial marketing site with heavy custom interactivity.
- **Stack:**
  - **Astro 6** (content-first, islands architecture, no client JS by default)
  - **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js` — tokens live in `src/styles/global.css` inside `@theme`)
  - **TypeScript strict**
  - **GSAP + Lenis** for scroll-driven animations and smooth scroll
  - **Three.js** for any WebGL (modular `.ts` files in `src/three/`, hydrated only on the page that needs them)
  - **pnpm** as package manager
  - **Biome** for lint + format (replaces ESLint + Prettier)
- **Deploy:** Cloudflare Pages (or Vercel — set during deploy step).
- **Content:** MDX content collections, no CMS (single-editor workflow).

## Hard rules

### Project / stack

1. **Tokens live in `src/styles/global.css` under `@theme`.** Never hardcode colors/sizes in components. If you need a new token, add it there first. This is the Tailwind v4 way — there is no `tailwind.config.js`.
2. **Tailwind v4 utilities + scoped `<style>` blocks.** Use Tailwind utilities for layout/spacing and standard surfaces. Use Astro's scoped `<style>` block for component-specific styles where utilities would get noisy or where fidelity to Figma needs precise values.
3. **One component = one Astro file in `src/components/`.** Sub-pieces inline as sections within the same file unless reused elsewhere. Don't pre-split.
4. **No client JS unless necessary.** Astro is HTML-first. Only add `client:*` directives or `<script>` tags when the interaction is real (chat, scroll, WebGL). Static UI stays static.
5. **Figma is the source of truth for design.** Read every section through `Figma:get_design_context` + `Figma:get_screenshot` + `Figma:get_variable_defs` before implementing. Don't reinterpret.
6. **Preserve design literally on first pass.** Including spelling, exact pixel values, exact opacities. Flag suspected typos (e.g. "desicion") to the user — don't silently fix.
7. **Files over 200 lines hurt context.** Keep `CLAUDE.md` lean — detail in `@docs/*.md` imports.

### CSS / layout

8. **Layout = Grid or Flex. Always.** Primary content placement (headings, paragraphs, buttons, sections, cards, video widgets) **must** use `display: grid` (with `grid-template-areas` for named regions) or `display: flex`. If you catch yourself typing `position: absolute; inset: …; top: …%` to place a content element — stop, delete it, use grid.

   **`position: absolute` is allowed when** the element is:
   - A **decorative overlay** layered on top of/inside another element (background images/videos, vignettes, gradients, particle canvases, SVG filter wrappers, liquid-glass internals — `liquid__filter` / `liquid__overlay` / `liquid__specular`, rim SVGs, blur layers).
   - A **custom interactive surface stacked inside its parent** (a play button overlaid on a video thumbnail, a play/pause icon over media, a badge pinned to a card corner).
   - **Element-internal stacking** of layers that visually compose a single component (the foreignObject blur in Intelligence text, the SVG filter defs hidden off-screen).

   **`position: fixed` is allowed for** viewport-anchored UI:
   - Modals / dialogs / popovers (the `<dialog>` element).
   - Custom cursors, drag previews.
   - Sticky toasts, scroll-progress bars.
   - Fixed nav / floating action buttons.

   The rule of thumb: **if the element is part of the page's reading flow, use grid/flex. If it floats above, inside, or beside that flow as decoration / overlay / chrome, `absolute`/`fixed` is fine.**

   **PROCESS RULE: ask before using `absolute` or `fixed`.** Even when the case clearly fits one of the allowlists above, before writing `position: absolute` or `position: fixed` in any new code, **stop and ask the user in chat**: "I need `position: absolute` here because [reason] — OK?". Wait for explicit approval (`да` / `yes` / `ok`). Existing `position: absolute|fixed` rules that were previously approved stay as-is unless the user asks to revisit them.
9. **Logical properties only.** `inset-inline-start` / `inset-block-end` / `margin-block-start` / `padding-inline` / `block-size` / `inline-size` / `border-inline-start`. **Never** `left` / `right` / `top` / `bottom` / `width` / `height` / `margin-left` etc. in CSS. (SVG attributes `x` / `y` / `width` / `height` on SVG elements stay — they're SVG, not CSS.)
10. **No fixed `px` for layout.** Spacing / typography / sizing always via tokens (`var(--space-*)`, `var(--text-*)`, `var(--radius-*)`) or fluid `clamp()` / `%` / `rem`. Fixed `px` allowed only for component-internal borders/strokes (e.g. `border: 1px solid …`, `stroke-width: 1`).
11. **Breakpoints in `em`, not `px`.** `@media (max-width: 40em)`, not `@media (max-width: 640px)`. Em-based breakpoints respect user font-size preferences.
12. **BEM naming.** `.block`, `.block__element`, `.block--modifier`. Lowercase, kebab-case. No `wrapper-2`, `mt-23px`, `div1`.
13. **Semantic HTML by default.** `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`, `<figure>`, `<button>` over `<div>` when applicable.
14. **`:focus-visible` on every interactive element.** Buttons, links, inputs — all must have a visible focus state. Global default lives in `global.css` (`:where(a, button, …):focus-visible { outline: … }`).
15. **`@media (prefers-reduced-motion: reduce)`** wrap any animation longer than a hover transition. Video loops, scroll-driven animations, GSAP timelines.
16. **No `!important` without a comment.** If you ever write `!important`, the next line must be `/* why: … */` explaining the override.
17. **Skeletons are B&W.** All loading placeholders across the site use grayscale (the `.skeleton` utility in `global.css`, or `filter: grayscale(1)` on a colorful LQIP). No brand color in loading states — they must read as "loading" without competing with content. For images that need a feels-instant load, use the LQIP → `img.decode()` reveal → video pattern documented in `@docs/frontend-conventions.md`.

18. **Text swap animations use a hard mask.** This applies to:
    - Hover labels ("How it works" → "Play")
    - **Button text on hover** (CTA, primary, secondary — same text duplicated, no copy change needed; the lift IS the affordance)
    - Cursor pill copy
    - State-driven label changes
    - **Heading text animation** (only when explicitly requested — headings are static by default)

    The pattern MUST follow these rules:
    - Wrapper element with `overflow: hidden` AND `block-size` set to **exactly one line-height** (`calc(font-size × line-height)`). No padding inside the mask — the mask box IS the line.
    - **Use `line-height: var(--leading-snug)` (1.3), NEVER `1`.** At `line-height: 1` the line-box equals one em, but descenders on letters like `y` / `g` / `p` extend below it and get sliced by the mask edge (visible artifact at rest). 1.3 gives the descender breathing room without ballooning the mask.
    - Strings stack via grid (`display: grid; grid-template-areas: "stack";` on wrapper; `grid-area: stack` on each string) so all candidates occupy the same space.
    - Transition is `transform: translateY(±100%)` ONLY. Outgoing slides up out (`translateY(-100%)`), incoming slides in from below (`translateY(100%)` → `translateY(0)`).
    - NEVER animate `opacity` on the text. The mask provides the clipping. Opacity transitions on swap-text are a code-review reject.
    - Use the shared motion tokens — `var(--dur-hover) var(--ease-out-soft)` — for visual consistency across the site (see rule 19).
    - Wrap the transition in `@media (prefers-reduced-motion: reduce) { transition: none; }`.

    Reference implementations in `Header.astro`:
    - `.hero__cta-top-label` — button hover (same text duplicated)
    - `.hero__video-label-mask` — hover swap ("How it works" ↔ "Play")
    - `.custom-cursor__mask` — state-driven (Close ↔ Play ↔ Pause)

    Mirror their structure exactly when adding new text-swap UI.

    **Button-text edge case:** when the duplicate is the SAME text as the original (button hover lift, no copy change), put `aria-hidden="true"` on the duplicate `<span>` so screen readers don't announce it twice.

    **`<a>`-as-button edge case:** add `user-select: none; -webkit-user-drag: none;` to any anchor styled as a button (`.liquid__content` does this). Without it the link's default drag behavior (browser shows URL ghost on mousedown-drag) breaks both selection AND the click target.

19. **Motion system — shared easing + duration tokens.** Don't invent local `cubic-bezier()` curves or arbitrary durations in components. Use the tokens from `global.css`:

    | Token | Value | Use for |
    |---|---|---|
    | `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Hover micro-interactions (scale, lift, mask text swap). Soft entry → snappy mid → gentle landing. |
    | `--ease-morph` | `cubic-bezier(0.32, 0.72, 0, 1)` | Large transitions (modal FLIP open, backdrop blur fade, route changes). |
    | `--dur-hover` | `0.5s` | Every hover effect on a single component shares this so they read as ONE motion. |
    | `--dur-morph` | `0.7s` | Morph in, view transition in. |
    | `--dur-morph-fast` | `0.38s` | Morph out / close — snappier than in by design. |

    **Sync rule:** when multiple things hover at once on the same component (e.g. video widget hover: poster scale + play scale + label text swap + widget lift), they MUST all use `var(--dur-hover) var(--ease-out-soft)`. Mismatched curves/durations read as bugs.

    Always wrap any transition longer than `0.2s` in `@media (prefers-reduced-motion: reduce) { transition: none; }` (see rule 15).

### Assets

20. **All media assets are optimized for web with maximum quality preservation.** One principle for every image and every video: ship the smallest file that still looks visually-lossless **at 2× retina display size** — sized for 2× the largest dimension the asset will be rendered at, not for the source camera/render resolution. Raw editor exports never ship. Every image and video goes through a compression pass before commit. If a teammate hands you a fat asset, optimize it and flag the original size in chat.

    **Videos** — concrete budget per surface:
    - **Resolution** capped at 2× the largest display size: 1920×1080 for hero / fullscreen, ~1440×900 for card backgrounds, 720p for thumbnails. A 4K source on a card the user reads at ≤1240px is wasted bandwidth.
    - **Bitrate** ≤2 Mbps for background loops, ≤4 Mbps for foreground transitions / scrub-driven.
    - **File size** ≤5 MB for card loops, ≤10 MB for hero, ≤6 MB per file for scrub-driven transitions (per-codec).
    - **Codec** — dual-ship HEVC MP4 + WebM via `<source>` tags, let the browser pick. Reference pairs: `public/bg/intro-loop-hevc.mp4` + `intro-loop.webm` (background loop), `public/spar/1-2-hevc.mp4` + `1-2.webm` (scrub-driven transition).
    - **Audio** stripped (`-an`) from any muted loop / background — the track is decoded even when silent.
    - **Looped backgrounds** trimmed to a frame-perfect integer-second loop so the seam is invisible.
    - **Scrub-driven videos** (where `currentTime` is set by scroll) encoded with `keyint=24 min-keyint=24 no-scenecut=1` for 1s keyframe interval — fast seek without visible decode lag. Keep default B-frames; `bframes=0` halves HEVC compression efficiency.
    - **Element attributes** — default `<video muted loop playsinline preload="metadata">`. Use `preload="auto"` only when the asset MUST be in cache before paint (hero, scrub-driven).
    - **Decode gating** — multiple background videos on one page need an IntersectionObserver that plays only the visible element + pauses on `axion:idle` (see `Features.astro`).

    **Images** — concrete budget per surface:
    - **Resolution** at 2× the largest display size: ~1920px wide for hero/fullscreen photos, ~1500px for card backgrounds, ~720px for thumbnails. Anything larger is wasted bandwidth on a retina downscale.
    - **Format** — ship modern + fallback via `<picture>`: AVIF preferred for photos (best compression, supported by Chrome / Firefox / Safari 16.4+), WebP acceptable for simpler cases. Always include JPEG fallback. PNG only when transparency is required — and run it through `pngquant`.
    - **Compression** — visually-lossless target: `avifenc -q 75`, `cwebp -q 80`, `mozjpeg/cjpeg -quality 82-88`, `pngquant --quality 70-90`. Strip EXIF / metadata.
    - **LQIP** for any image that needs feels-instant load — generate a ~20-32px-wide JPEG, base64-encode it, inline as `background-image: url("data:...")` with `filter: grayscale(1) blur(20-28px)` and `transform: scale(1.05-1.1)`. Reference: `Header.astro` (`.hero__bg-lqip`), `Features.astro` (`.features__card-bg-fallback`).
    - **Reveal pattern** — full image starts at `opacity: 0`, fades in once `img.decode()` resolves so the user never sees a half-decoded image on slow connections. Helper: `revealOnDecode()` in `@docs/frontend-conventions.md`.
    - **Element attributes** — default `<img loading="lazy" decoding="async">`. Use `loading="eager" fetchpriority="high"` only for above-the-fold hero images.

    Detailed ffmpeg + avifenc/cwebp/mozjpeg recipes in `@docs/frontend-conventions.md`. Before adding a new asset, run the recipe.

### Self-check before every CSS edit

Mentally run this checklist before writing or accepting any CSS:

- [ ] **Is this layout?** If yes → grid or flex. Never `position: absolute` for content placement.
- [ ] **Logical properties?** `inset-inline-start` not `left`, `block-size` not `height`.
- [ ] **Tokens, not magic numbers?** `var(--space-md)` not `1.5rem`. `var(--text-display)` not `clamp(...)` inline.
- [ ] **Breakpoint in `em`?** `40em` not `640px`.
- [ ] **Interactive element?** Has `:focus-visible` styles (or inherits global).
- [ ] **Animation?** Wrapped in `prefers-reduced-motion: reduce` opt-out.
- [ ] **Semantic tag?** `<section>` / `<button>` / `<figure>` over `<div>` if it fits.
- [ ] **Text swap?** Hard mask only — `overflow: hidden` + exact line-height + `translateY(±100%)`. No opacity. (See rule 18.)

If any answer is ❌, fix it before moving on. See `@docs/frontend-conventions.md` for the long-form rationale and examples.

## Project structure

```
axion/
├── astro.config.mjs        # Astro + Tailwind v4 Vite plugin
├── tsconfig.json           # extends astro/tsconfigs/strict
├── package.json
├── CLAUDE.md
├── public/                 # static assets served at root
│   └── bg/                 # background images, video posters, sphere etc.
├── src/
│   ├── styles/
│   │   └── global.css      # Tailwind v4 imports + @theme tokens + base styles
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── components/         # presentational components, one per Astro file
│   │   └── Header.astro
│   ├── pages/              # routes (file-based routing)
│   │   └── index.astro
│   ├── three/              # WebGL modules — .ts files imported by client scripts
│   ├── content/            # MDX content collections (when added)
│   └── lib/                # utilities, shared TS
└── docs/                   # design notes, imported into CLAUDE.md on demand
```

## Design tokens (canonical list)

Defined in `src/styles/global.css` under `@theme`. Reference via `var(--token)` in CSS or as Tailwind utility classes (Tailwind v4 auto-generates classes from tokens — `--color-fg-muted` becomes `text-fg-muted`, `bg-fg-muted`, etc.).

**Surfaces:**
- `--color-bg` — page background (`#010101`)
- `--color-bg-soft` — secondary surface (`#0a0a0a`)
- `--color-glass` — translucent panel (`rgba(255,255,255,0.1)`)
- `--color-glass-dark` — dark translucent (`rgba(0,0,0,0.31)`)

**Text:**
- `--color-fg` — primary (`#ffffff`)
- `--color-fg-muted` — secondary (`rgba(255,255,255,0.7)`)
- `--color-fg-faint` — labels (`rgba(255,255,255,0.2)`)
- `--color-fg-ghost` — editorial ghost text (`rgba(255,255,255,0.1)`)

**Type:**
- `--font-display` — Geist Variable (editorial display)
- `--font-body` — Geist Variable (body)
- `--font-ui` — Inter Variable (UI labels, until ABC Diatype Plus license available)
- `--text-display` — fluid `clamp(4rem, 10.4vw, 11.25rem)` for hero headline

**Radii:**
- `--radius-pill` — 30px (CTAs)
- `--radius-panel` — 34px (floating glass surfaces)
- `--radius-tile` — 20px (video, cards)

## Naming conventions

- **English / Latin alphabet only.** Every identifier in the codebase — component file, class name, CSS variable, TS variable, asset filename — uses **standard English nouns/verbs**. No transliterated Russian or other non-English words (e.g. `plashka`, `kartochka`, `obertka`). No Cyrillic in code. Russian belongs in the chat / commit notes / Figma comments, not in `.astro` / `.ts` / `.css`. Pick the closest English term from the UI vocabulary: panel, frame, surface, drawer, tray, sheet, dialog, popover, tile, card, badge, chip, pill, menu, nav, sidebar, header, footer, etc.
- **Components:** PascalCase Astro files — `Header.astro`, `Navbar.astro`, `FeatureCard.astro`.
- **Classes inside `<style>`:** BEM — `block__element` and `block--modifier`. Example: `hero__title`, `nav-panel__divider`, `assistant__chip`.
- **Utility helpers in CSS:** kebab-case — `display-headline`, `display-ghost`, `glass`.
- **TS files:** camelCase — `particleSystem.ts`, `useScroll.ts`.
- **Asset filenames:** lowercase kebab — `hero-city.jpg`, `video-poster.jpg`.

## Tailwind v4 reminders

- **No `tailwind.config.js`.** Configuration is CSS — tokens in `@theme`, plugins via `@plugin "..."`.
- **`@theme` keys auto-generate utilities.** `--color-glass-dark` → `bg-glass-dark`, `text-glass-dark`, etc.
- **Container queries are built-in.** `@container` directive and `@sm:`, `@md:` variants. Prefer these over media queries for component-level responsive behavior.
- **Arbitrary values still work.** `class="w-[290px]"` is fine when matching Figma exactly, but always prefer a token when the value will repeat.

## Figma-to-Astro workflow (per section)

1. `Figma:get_design_context` (with `clientFrameworks: "astro"`, `clientLanguages: "typescript,html,css"`) for the section node.
2. `Figma:get_screenshot` for visual reference.
3. `Figma:get_variable_defs` to capture any design tokens — add missing ones to `@theme` before writing the component.
4. Identify which fonts/assets are referenced. If a font isn't licensed (SF UI Display, ABC Diatype Plus, etc.), substitute with the closest token-defined font and flag for the user.
5. List asset TODOs at the top of the component file as a comment block, with expected paths under `public/`.
6. Write the Astro component using the project's BEM-in-`<style>` pattern. Match pixel values from Figma where they matter; use proportional units (%, vw, clamp) where the design must scale.
7. Test in `pnpm dev` before declaring done.

## Animation patterns

- **CSS first.** `@keyframes` for breathing/floating/rotation effects (sphere orb, etc.).
- **GSAP for scroll-driven.** Import GSAP only on pages that need it. ScrollTrigger for pin/scrub. Lenis for smooth scroll, init once in a layout-level `<script>`.
- **Three.js scenes** mount to a `<canvas>` placed in the Astro template. Module lives in `src/three/{scene}.ts` and is dynamically imported from a `<script>` tag in the component. Dispose on page navigation (Astro View Transitions).

## Anti-patterns — refuse to do these

- ❌ `tailwind.config.js` — this is v4, config is CSS.
- ❌ Hardcoded hex colors / px values in components when a token exists.
- ❌ Importing GSAP or Three.js at the top of an `.astro` file (adds to every page bundle). Use `<script>` blocks or dynamic `import()`.
- ❌ `react` / `vue` integrations unless a component genuinely needs framework-level reactivity. Astro + vanilla TS is the default.
- ❌ Inline `style="..."` attributes — use scoped `<style>` or utility classes.
- ❌ Silently fixing typos found in Figma copy. Surface them as questions.
- ❌ Splitting components prematurely. One Astro file until shared by 2+ pages.
- ❌ Generic AI aesthetics — Inter for body, purple gradients, system-font fallback. The brand uses Geist + (eventually) ABC Diatype Plus.

## Brand specifics — Axion

- Surface is near-black `#010101`, never pure `#000`.
- Editorial split-headlines are a signature pattern: white primary word + ghost (opacity-10) secondary word, offset down and right.
- Glass surfaces use **27.5px** backdrop blur and `rgba(255,255,255,0.1)` — this is the canonical glass recipe.
- The floating central nav panel is the site's anchoring UI element across pages. Treat as a persistent component when adding more pages.
- The "sphere" orb in the nav is an AI assistant visual — eventually replace the CSS placeholder with a real Three.js sphere with shader-driven distortion.

## Imports (load on demand)

@docs/frontend-conventions.md
@docs/figma-conventions.md
@docs/three-scenes.md
@docs/animation-timings.md

## Quick reference

| Need | Use |
|---|---|
| Color | `var(--color-fg)` in CSS or `text-fg`/`bg-fg` in Tailwind |
| Display headline size | `var(--text-display)` or `text-display` |
| Glass surface | `.glass` helper class (or `bg-glass backdrop-blur-[27.5px]`) |
| Pill button | `rounded-[var(--radius-pill)]` + `bg-glass` |
| Editorial ghost word | `.display-ghost` class |
| Section padding (component-scoped) | scoped `<style>` block |
