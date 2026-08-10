# IBEX 2.0 — Design System Principles

## Product Character
Calm, formal, premium, trustworthy, efficient, and visually restrained.

## Typography
Preferred family: **Noto**.
- Arabic UI candidate: `Noto Sans Arabic`.
- Latin and numeric companion: `Noto Sans`.
- Final weights, fallback chain, and packaging method will be frozen in a dedicated typography ADR.

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

## Visual Density
- Prefer whitespace over separators.
- Avoid stacking many cards when grouping or typography can communicate hierarchy.
- Use borders sparingly.
- Avoid heavy gradients and decorative backgrounds.
- Keep the primary action visually obvious.
- Secondary actions should be quieter but discoverable.

## Navigation
- Frequent workflows should require minimal navigation depth.
- Back behavior must be predictable.
- Preserve in-progress form state where safe.
- Use bottom navigation only for truly top-level destinations; do not overload it.
- Use contextual actions for entity-specific operations.

## Motion
Motion is functional, not decorative.
Allowed purposes:
- establish hierarchy and continuity
- confirm state change
- reduce abrupt navigation
- clarify expand/collapse
- communicate progress or success/failure

Avoid:
- long entrance animations
- bouncing or playful motion in accounting workflows
- motion that delays data entry
- multiple simultaneous animated elements

## Forms
- Large touch targets.
- Numeric keyboard for numeric fields.
- Strong validation with human-readable Arabic messages.
- Preserve exact entered values until committed.
- Destructive actions require explicit confirmation where loss/financial impact exists.

## Accessibility & RTL
- Arabic is RTL by default.
- Icons must follow directional semantics.
- Minimum contrast and touch target standards are required.
- Text scaling should not break critical forms.

## Premium Without Clutter
Premium means consistency, spacing, typography, micro-interactions, and quality of states—not visual ornamentation.
