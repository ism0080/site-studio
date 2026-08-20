# @site-studio/site-template

Renders a validated `Site` document to static HTML. A **template** is data —
`theme` (colour tokens) + `layout` (which CSS variant) + `defaultSections`
(starter content) — not a file or a component. Every template funnels through
the shared section components in `src/render.tsx`, so the visual difference
between templates is entirely their theme values plus the layout CSS.

## Files

- `src/templates.ts` — the template registry: theme tokens, layouts, defaults.
- `src/render.tsx` — the renderer: section components + CSS strings + the HTML document.
- `src/site.ts` — the `Site` / `Page` / `Section` domain types.

## Add a new template

Only `src/templates.ts` changes. A template reusing an existing layout needs no
CSS.

1. Write the starter content as a `ReadonlyArray<Section>` (or reuse one of the
   existing `*DefaultSections` arrays).
2. Declare the template with `defineTemplate({ ... })`, choosing an existing
   `layout` (`editorial` | `warm` | `grid`).
3. Add the constant to the `ALL_TEMPLATES` array.

That's it. The registry (`TEMPLATES`), the gallery filter list
(`TEMPLATE_CATEGORIES`), the API gallery, and the editor all read from
`ALL_TEMPLATES`, so there is no separate registration step and a **new
`category` appears in the gallery filter automatically**.

```ts
const coastalCalm = defineTemplate({
  id: "coastal-calm",
  name: "Coastal Calm",
  font: "Inter",
  layout: "warm",
  category: "Hospitality", // new categories flow through with no other edits
  brand: "TIDE",
  title: ["Slow mornings,", "by the", "sea."],
  theme: {
    bg: "#eef3f4",
    accent: "#3d7d84",
    ink: "#1c2a2b",
    surface: "#ffffff",
    border: "#d6e2e3",
    muted: "#5f7274",
  },
  defaultSections: retailDefaultSections,
});

export const ALL_TEMPLATES = [editorialStudio, warmMinimal, cleanGrid, coastalCalm];
```

## Add a new layout

A new layout is a new visual arrangement of the shared sections. This is the
only change that requires CSS, in `src/render.tsx`.

1. Add the value to the `TemplateLayout` union in `src/templates.ts`.
2. TypeScript now errors on the `LAYOUT_MOD` and `LAYOUT_CSS` records in
   `src/render.tsx` — the type is the checklist. Fill both:
   - `LAYOUT_MOD`: the section-class modifier (e.g. `" minimal"`), or `""` for none.
   - `LAYOUT_CSS`: a `myLayoutCss()` function returning the override CSS block.
3. Optionally add a `.template-<layout> main { max-width: ... }` rule in
   `themeCss`.

Layout CSS overrides base section rules via the modifier class
(e.g. `.hero.minimal`). Reuse `eyebrowRule` / `cardSurface` where the shared
shape applies rather than re-deriving it.

## Design tokens

The palette is seven CSS custom properties emitted on `:root` by `themeCss`:
`--accent`, `--bg`, `--ink`, `--surface`, `--border`, `--muted`, `--font`.
`settings.accent` / `settings.font` on the site document (set by the editor)
override the template's values; the rest of the palette comes from the template
theme. Style with `var(--token)` so editor overrides and theme swaps just work.
