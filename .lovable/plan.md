

## Problem

Two issues on tablets:

1. **App doesn't fill the tablet screen** — the `max-w-lg` (512px) constraint caps the width on mobile/default tablet view, leaving large empty margins.
2. **"Request Desktop Site" in Chrome doesn't trigger the dashboard layout** — when Chrome on a tablet requests the desktop site, it changes the user-agent string but the viewport width often stays the same (or becomes ~980px). The layout uses CSS `md:` breakpoints which depend on actual viewport width, so if the browser reports a narrow viewport, the mobile layout still renders.

The root cause for issue #2: the viewport meta tag uses `width=device-width`, which on a tablet in "Desktop Site" mode may report a wider width (~980-1024px) or may not. The real fix is ensuring the layout works properly across the actual tablet viewport widths (typically 768-1024px in portrait, 1024-1366px in landscape).

Since we already moved to `md:` (768px), the dashboard layout **should** activate on most tablets. The remaining issues are:

- The nav bar still uses `lg:static lg:border-t-0 lg:border-b` — it should use `md:` too
- The `max-w-lg` on the outer container caps width at 512px on screens that don't match `md:` — we should remove this cap entirely since the inner components handle their own responsive layouts

## Plan

### 1. Remove `max-w-lg` width cap entirely (`src/pages/Index.tsx`)
- Change `max-w-lg md:max-w-none` to just `max-w-none` (or remove both classes) so the app always fills available width
- Same for the nav wrapper: `max-w-lg md:max-w-none` → remove the cap

### 2. Fix nav breakpoints (`src/pages/Index.tsx`)
- Change `lg:static lg:border-t-0 lg:border-b` to `md:static md:border-t-0 md:border-b` so the nav docks properly on tablets

### 3. Ensure consistent behavior
- The QuickLogTab already uses `md:` breakpoints for the dashboard grid, so no changes needed there
- The mobile layout (`md:hidden`) will only show on phones (<768px), and the dashboard grid will show on everything else

These 3 small edits in `src/pages/Index.tsx` ensure the app fills the full screen on tablets in both normal and "Desktop Site" modes.

