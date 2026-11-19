# Section typeface (2026-11-19)

The 2026-11-16 three-lens review flagged the HTML sections' type: the big lines fell back to Arial (the `body` rule), and the rest used Geist, the default font of every new Next.js project. The user asked about the font of the final logo's "New Wings Solutions" words, then approved "Righteous for the big lines, a plain font for reading" after a side-by-side on the real sections ("Keep it").

## The logo's font

The words in `public/images/new-wings-artwork/text-new-wings.webp` and `text-solutions.webp` are **Righteous** (Google Fonts, open licence). Matched letter by letter against the images: the rounded "w" and "W", the "N", the squarish "S", the single-storey "g". It has one weight (400), so it is used only for short, large lines.

## Which text gets which font

| Text | Font | Where |
| --- | --- | --- |
| Title cards and the end line ("Lights up. Your theatre is next.") | Cinzel 600, unchanged | `title-card.tsx`, `diagonal-section.tsx` |
| Big section lines: the About Us sentence, "The team" | Righteous 400 (`--font-brand`) | `.nw-about-line` in `about-card.tsx`, `.nw-owner-title` in `owner-card.tsx` |
| Everything read: Section 3 text, testimonial quotes and names, film frame names and lines, menu, buttons, captions, loader, enquiry form, the page body | Jost (`--font-read`, variable 100–900) | `body` and every former `--font-geist-sans` use |
| Small capital labels (ABOUT US, CLIENT FEEDBACK, frame numbers) | Geist Mono, unchanged | |

Both fonts are self-hosted by `next/font` in `app/layout.tsx`. Jost is preloaded (the loader and menu use it from the start). Righteous is not preloaded and uses `display: "block"`, like Cinzel: its first line comes long after the opening, and it never shows a stand-in font. The two big lines are set at weight 400 (Righteous has no bold, so a heavier weight would be faked by the browser). Letter-spacing on them is −.015em (it was −.035em for Arial; Righteous is wider).

Left as they were: the tuning panel (`.cinema-panel`, a test tool) keeps Arial; `/eye-study` is untouched.

## Checked

Headless Chrome on the dev server (3100), menu jumps to each section, desktop 1920×947 and phone 390×844: both fonts load (`document.fonts`), the About line and the team title compute to Righteous 400, the team text and quotes to Jost; no overflow or bad wraps on either size. `scripts/section-typeface.test.mjs` (3) guards the roles; 233 tests pass, tsc and eslint clean. Not checked: the whole journey played through, Safari/iPhone, production build.

Evidence: `D:/CodexOutputs/Section_Typeface_20261119/` (screenshots, the logo match, the role picture).

## Revert

Restore the files in `D:/CodexOutputs/Section_Typeface_20261119/backup/` (layout.tsx, globals.css, about-card.tsx, owner-card.tsx, feedback-scene.tsx, rope-card.tsx, film-content.ts) and delete `scripts/section-typeface.test.mjs` and this folder.
