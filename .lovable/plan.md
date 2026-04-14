

## Problem

The dashboard layout you built is gated behind the `lg:` breakpoint (1024px+). Tablets in portrait mode (768px wide) and phones fall below this threshold and show the old mobile stacked layout instead.

## Plan

**Single change in `src/components/QuickLogTab.tsx`:**

1. Replace `hidden lg:grid lg:grid-cols-[260px_1fr] lg:gap-3 lg:h-[calc(100vh-8.5rem)] lg:overflow-hidden` with `hidden md:grid md:grid-cols-[260px_1fr] md:gap-3 md:h-[calc(100vh-8.5rem)] md:overflow-hidden` — this activates the dashboard at **768px+** (tablets in portrait and up).

2. Update all other `lg:` prefixed classes inside `tabletLayout` to use `md:` instead, so the entire dashboard grid renders on tablets.

3. Update the `mobileLayout` wrapper from `lg:hidden` to `md:hidden` so it only shows on phone-sized screens (below 768px).

4. In `src/pages/Index.tsx`, update the main container's `lg:overflow-hidden` and `lg:pb-4` to `md:overflow-hidden` and `md:pb-4` so the parent container also cooperates at the tablet breakpoint.

This is a straightforward find-and-replace of the `lg:` breakpoint prefix to `md:` across the dashboard-related classes, ensuring the same dashboard appears on tablets, desktops, and in fullscreen mode.

