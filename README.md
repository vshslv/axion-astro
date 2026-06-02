# Axion

Editorial marketing site for Axion. Astro 6 + Tailwind v4 + GSAP + Three.js.

## Setup

```bash
pnpm install
pnpm dev          # http://localhost:4321
```

## Build

```bash
pnpm build
pnpm preview
```

## Asset placement

Drop these files into `public/bg/` to replace the placeholders in the header:

- `hero-city.jpg` — full-bleed background photograph
- `sphere.png` — animated AI orb (transparent PNG, ~99×100)
- `video-poster.jpg` — "How it works" video thumbnail (~496×269)

Then update the `<!-- TODO -->` comments in `src/components/Header.astro` to point at these files.

## Project layout

See `CLAUDE.md` for the canonical structure, design tokens, and conventions.

## Stack notes

- **Tailwind v4** — no `tailwind.config.js`. All tokens live in `src/styles/global.css` under `@theme`.
- **Astro 6** — file-based routing in `src/pages/`. Components are `.astro` files in `src/components/`.
- **TypeScript strict** — extends `astro/tsconfigs/strict`.
- **Biome** — `pnpm lint` and `pnpm format`.
