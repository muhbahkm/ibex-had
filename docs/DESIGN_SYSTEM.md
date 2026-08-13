# IBEX 2.0 — Design System Principles

## Product Character
Calm, formal, premium, trustworthy, efficient, and visually restrained.

## Approved Visual Direction
The visual reference approved on 2026-08-10 defines the target feel for IBEX 2.0. We will not copy it literally; we will translate its design language into an Arabic-first mobile system.

Key traits to preserve:
- soft neutral page background;
- large rounded surfaces with restrained elevation;
- generous whitespace and breathing room;
- compact, high-signal dashboards rather than dense ERP grids;
- one vivid accent for the active state and key action, not many competing colors;
- selective pastel metric surfaces for semantic grouping;
- charts with thin smooth lines, low visual noise, and clear labels;
- strong visual hierarchy through spacing and typography rather than borders;
- iconography that is simple, outlined, and consistent;
- premium micro-interactions with short, subtle motion;
- calm navigation where the current destination is unmistakable.

For mobile, the desktop-style sidebar becomes a mobile-appropriate navigation model while preserving the same quiet, rounded, premium character.

## Typography
Preferred family: **Noto**.
- Arabic UI: `Noto Sans Arabic`.
- Latin and numeric companion: `Noto Sans`.
- Default UI weight should remain restrained; use heavier weights only for hierarchy and financial totals.
- Avoid mixing several font families.

## Numerals
All user-visible numerals must use Latin digits `0-9`.
This applies to:
- amounts
- quantities
- dates
- times
- percentages
- invoice numbers
- phone numbers
- reports
- receipts
- exports
- chart labels

Eastern Arabic / Arabic-Indic digits are not allowed in rendered application output.

## Color Strategy
- Primary shell/background: warm or cool neutral, very light.
- Primary content surfaces: near-white.
- Primary accent: one controlled high-visibility accent inspired by the reference's active navigation highlight.
- Semantic pastels may be used for metrics, but only when they improve grouping or status recognition.
- Financial positive/negative states must not rely on color alone.
- Avoid saturated full-screen backgrounds, heavy gradients, neon decoration, or many unrelated accent colors.

## Shape & Surface
- Rounded corners are a core characteristic of the system.
- Prefer medium-to-large radii on cards, sheets, inputs, and navigation containers.
- Elevation should be subtle and soft; avoid strong shadows.
- Borders are secondary to spacing and contrast and should be used sparingly.
- Cards must have a reason to exist; do not wrap every text block in a card.

## Visual Density
- Prefer whitespace over separators.
- Avoid stacking many cards when grouping or typography can communicate hierarchy.
- Keep dashboards information-rich but visually calm.
- Use progressive disclosure for advanced detail.
- Keep the primary action visually obvious.
- Secondary actions should be quieter but discoverable.

## Navigation
- Frequent workflows should require minimal navigation depth.
- Back behavior must be predictable.
- Preserve in-progress form state where safe.
- Mobile top-level navigation should remain small in destination count.
- Use contextual actions for entity-specific operations.
- Active destination receives a strong but clean visual highlight similar in spirit to the approved reference.

## Dashboard Language
Dashboard composition should follow a clear hierarchy:
1. contextual greeting / business status area;
2. a small number of critical KPIs;
3. one primary trend visualization;
4. compact operational summaries;
5. exceptions/alerts requiring action.

Do not build a wall of equal-priority cards.

## Charts
- Prefer line, bar, and donut charts only when they answer an operational question.
- Keep gridlines faint.
- Keep labels sparse and legible.
- Use smooth but accurate transitions; animation must not distort values.
- Tooltips and selected values must use Latin digits.
- Charts must remain understandable in RTL layouts.

## Motion
Motion is functional, not decorative.
Allowed purposes:
- establish hierarchy and continuity;
- confirm state change;
- reduce abrupt navigation;
- clarify expand/collapse;
- communicate progress or success/failure;
- subtly transition dashboard metrics and charts after data refresh.

Motion baseline:
- short durations;
- ease-out / standard Material-like curves;
- subtle scale/fade/slide where appropriate;
- no exaggerated spring, bounce, or parallax in accounting workflows.

Avoid:
- long entrance animations;
- playful/bouncy motion in financial workflows;
- motion that delays data entry;
- multiple simultaneous animated elements;
- decorative motion loops.

## Forms
- Large touch targets.
- Numeric keyboard for numeric fields.
- Strong validation with human-readable Arabic messages.
- Preserve exact entered values until committed.
- Destructive actions require explicit confirmation where loss/financial impact exists.
- Long forms should use sections and progressive disclosure instead of visual compression.

## Accessibility & RTL
- Arabic is RTL by default.
- Icons must follow directional semantics.
- Minimum contrast and touch target standards are required.
- Text scaling should not break critical forms.
- Latin digits remain LTR within Arabic contexts where needed for readability.

## Premium Without Clutter
Premium means consistency, spacing, typography, micro-interactions, quality of empty/loading/error states, and precision of data presentation—not ornamentation.

## Reference-specific mobile translation
The approved visual reference is a dashboard-heavy desktop composition. For Android we preserve the same visual DNA but adapt layout behavior:
- cards become one- or two-column depending on width;
- large desktop trend charts become full-width mobile sections;
- side navigation becomes bottom navigation / drawer / adaptive navigation based on destination count;
- metric cards remain large enough to scan quickly;
- tables become mobile lists with drill-down details;
- dense side-by-side analytics become vertically sequenced sections.
