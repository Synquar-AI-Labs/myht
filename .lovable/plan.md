

## Problem

From the tablet screenshot, two issues:

1. **~20% empty space at the bottom** — The dashboard grid height is set to `calc(100vh-8.5rem)`, which is too conservative. Combined with a fixed `h-[200px]` bottom row, the layout leaves a large blank area below the chart/appointments section.

2. **Appointment and Written Note buttons not visible** — The left column stacks: time → summary → quick actions → appointment/note buttons → recorder info. On shorter tablets, the appointment/note buttons get pushed below the visible area because the column has no scroll and uses `overflow-hidden`.

## Plan

### 1. Use `100dvh` and reduce the offset (`src/components/QuickLogTab.tsx`)
- Change `md:h-[calc(100vh-8.5rem)]` to `md:h-[calc(100dvh-6rem)]` — `dvh` accounts for dynamic browser chrome on tablets, and `6rem` is a tighter fit for the header + nav bar.

### 2. Make the bottom row fill remaining space instead of fixed 200px
- Change the right column from `grid-cols-[1fr_240px] gap-3 h-[200px] shrink-0` to use `flex-1 min-h-0` so it expands to fill whatever space remains after the medicine grid.
- The bottom row should use `flex-1` instead of `h-[200px]`.

### 3. Make the left column scrollable
- Change the left column from `overflow-hidden` to `overflow-y-auto` so that on shorter screens, the appointment/note buttons remain accessible via scroll.

### 4. Update Index.tsx main container offset
- Update the main padding calculation in `Index.tsx` to match: use `md:pb-2` instead of `md:pb-4` to reclaim vertical space.

All changes in two files: `src/components/QuickLogTab.tsx` and `src/pages/Index.tsx`.

