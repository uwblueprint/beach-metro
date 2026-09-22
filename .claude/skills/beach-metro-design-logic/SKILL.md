---
name: beach-metro-design-logic
description: >-
  House design-system expectations for Beach Metro UI behavior (motion first;
  more domains to follow). Use when implementing or reviewing animation,
  transitions, press/hover/focus feedback, dialogs, drawers, dropdowns,
  tooltips, popovers, or page transitions — or when the user names design-logic
  / beach-metro-design-logic.
---

# Beach Metro — design logic

Standard expectations for UI behavior in this product. Right now this covers
**motion** only; more domains will land in this skill over time.

Product overrides in `AGENTS.md` and `docs/design_decisions.md` still win
(e.g. no unscoped UI messaging). Prefer shared primitives over one-off motion.

## Motion

### When to animate

- Keyboard-initiated and very frequent interactions should feel immediate and should not animate.
- Common interactions should use subtle state feedback instead of entrance choreography.
- Occasional surfaces (i.e. dialogs, drawers, and toasts) can use standard motion.

### Duration

| Interaction | Duration |
| --- | --- |
| Press, hover, focus, icon swap | 100–150 ms |
| Tooltip, popover, dropdown | 150–250 ms |
| Dialog, drawer, page transition | 200–300 ms |

### Easing

- Use ease-out (or whatever custom in-house ease-out) for entrances, exits, and direct feedback.
- Use ease-in-out for movement already on screen.
- Use linear timing only for constant motion such as progress or a marquee.
- Do not use ease-in for UI entrances.

### Scale & origin

- Start scale entrances at 0.95, never 0.
- Use 0.97 as the default pressed scale when the shared primitive does not already provide feedback.
- Make trigger-anchored surfaces use the transform origin exposed by the shared primitive. Centered dialogs remain centered.

### Stagger

- Stagger decorative group entrances by 30–60 ms. Never delay an interaction until a stagger finishes.
