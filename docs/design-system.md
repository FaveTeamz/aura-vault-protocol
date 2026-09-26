# Aura Vault — Design System

## Spacing Scale

The spacing scale uses a **4px base grid**. All spacing values are multiples of 4px, expressed as `rem` so they respect user font-size preferences.

### CSS Custom Properties

Defined in `ui/src/styles/tokens.css` and imported into `global.css`:

| Token            | rem value | px value | Use case                                    |
|------------------|-----------|----------|---------------------------------------------|
| `--spacing-xs`   | 0.25rem   | 4px      | Icon gaps, tight inline spacing             |
| `--spacing-sm`   | 0.5rem    | 8px      | Chip padding, label gaps, small gutters     |
| `--spacing-md`   | 1rem      | 16px     | Default padding, form field spacing         |
| `--spacing-lg`   | 1.5rem    | 24px     | Section padding, card gaps                  |
| `--spacing-xl`   | 2rem      | 32px     | Page-level margins, large card padding      |
| `--spacing-2xl`  | 3rem      | 48px     | Section separation                          |
| `--spacing-3xl`  | 4rem      | 64px     | Hero/banner vertical padding                |

### Usage in CSS

```css
/* Preferred — semantic token names */
.card { padding: var(--spacing-md); }
.section { margin-bottom: var(--spacing-xl); }
.icon-btn { gap: var(--spacing-xs); }
```

### Tailwind Config Extension

If Tailwind CSS is added to the project, extend the spacing scale in `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      spacing: {
        xs:  '0.25rem',  // 4px
        sm:  '0.5rem',   // 8px
        md:  '1rem',     // 16px
        lg:  '1.5rem',   // 24px
        xl:  '2rem',     // 32px
        '2xl': '3rem',   // 48px
        '3xl': '4rem',   // 64px
      },
    },
  },
};
```

This maps `p-md`, `m-lg`, `gap-xs`, etc. to the same values as the CSS custom properties.

### Legacy Aliases

The `--sp-1` through `--sp-8` variables used throughout existing components are preserved as aliases in `tokens.css`:

| Legacy alias | Resolves to      |
|--------------|-----------------|
| `--sp-1`     | `--spacing-xs`  |
| `--sp-2`     | `--spacing-sm`  |
| `--sp-4`     | `--spacing-md`  |
| `--sp-6`     | `--spacing-lg`  |
| `--sp-8`     | `--spacing-xl`  |

> New code should use `--spacing-*` names. Legacy aliases are kept for backward compatibility.

---

## Colour Tokens

Defined in `ui/src/styles/global.css`:

| Token                       | Value     | Usage                                |
|-----------------------------|-----------|--------------------------------------|
| `--color-bg`                | `#0f1117` | Page background                      |
| `--color-surface`           | `#1a1d27` | Card / panel background              |
| `--color-surface-raised`    | `#22263a` | Hover states, secondary surfaces     |
| `--color-text`              | `#e8eaf6` | Primary text (13.5:1 contrast)       |
| `--color-text-muted`        | `#9fa8c7` | Secondary text (4.6:1 contrast)      |
| `--color-primary`           | `#7c83fd` | Brand / interactive (4.6:1 contrast) |
| `--color-primary-hover`     | `#9da3fe` | Hover state                          |
| `--color-primary-active`    | `#6269e0` | Active / pressed state               |
| `--color-success`           | `#4caf84` | Success states (4.5:1 contrast)      |
| `--color-error`             | `#f28b82` | Error states (4.6:1 contrast)        |
| `--color-info`              | `#81d4fa` | Info states (5.1:1 contrast)         |
| `--color-skeleton-base`     | (surface-raised) | Skeleton loading base colour   |
| `--color-skeleton-shimmer`  | `#2e3350` | Skeleton shimmer highlight           |

---

## Skeleton Loading System

Skeleton components live in `ui/src/components/Skeleton.tsx`. Use them wherever data is being fetched to prevent layout shift and provide visual feedback.

| Component           | Props                         | Use case                               |
|---------------------|-------------------------------|----------------------------------------|
| `<Skeleton>`        | `rows?: number`               | Generic content rows                   |
| `<CardSkeleton>`    | `cards?: number`              | Dashboard stat cards, portfolio cards  |
| `<TableSkeleton>`   | `rows?, columns?`             | Transaction history, leaderboard       |
| `<GraphSkeleton>`   | `bars?: number`               | APY chart, yield graph placeholders    |
| `<FormSkeleton>`    | `fields?: number`             | Deposit/withdraw forms during load     |
| `<LoadingIndicator>`| `label?, progress?`           | Inline progress (determinate or not)   |

All skeleton components:
- Set `role="status"` and `aria-busy="true"` for screen reader support
- Use `--color-skeleton-base` and `--color-skeleton-shimmer` tokens (dark-mode ready)
- Apply an animated `shimmer` CSS keyframe (1.4s cycle, respects `prefers-reduced-motion`)
- Match the exact dimensions of the content they replace to avoid layout shift

### Dark Mode

Skeleton colours use CSS custom properties. Override them in a `[data-theme="light"]` selector or `@media (prefers-color-scheme: light)` block:

```css
@media (prefers-color-scheme: light) {
  :root {
    --color-skeleton-base:    #e8eaed;
    --color-skeleton-shimmer: #f5f5f5;
  }
}
```

---

## Empty State

The `<EmptyState>` component (`ui/src/components/EmptyState.tsx`) renders when a user's `share_balance` is zero. It guides new users toward their first deposit.

Props:

| Prop             | Type         | Description                              |
|------------------|--------------|------------------------------------------|
| `onDeposit`      | `() => void` | Called when the primary CTA is clicked   |
| `docsUrl`        | `string`     | URL for the "Learn how it works" link    |

---

## Border Radius

| Token          | Value    | Usage                       |
|----------------|----------|-----------------------------|
| `--radius`     | 0.5rem   | Inputs, buttons, small cards |
| `--radius-lg`  | 1rem     | Panels, modals, large cards  |

---

## Motion / Transitions

| Token               | Value         | Usage                     |
|---------------------|---------------|---------------------------|
| `--transition-fast` | 150ms ease    | Hover effects, focus rings |
| `--transition-base` | 300ms ease    | Panel enter, modal open    |
| `--transition-slow` | 500ms ease    | Page-level fades           |

All transition tokens are set to `0ms` under `prefers-reduced-motion: reduce`.

---

## Typography

| Token        | Stack                                                              |
|--------------|--------------------------------------------------------------------|
| `--font-sans`| system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif |
| `--font-mono`| "Fira Code", "Cascadia Code", ui-monospace, monospace              |
