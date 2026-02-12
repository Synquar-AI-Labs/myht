

## Dashboard Enhancements

### 1. Move Date Range Selector to Top of Page
The range selector (7 Days / 30 Days / Custom) will be moved from its current position (below the summary cards) to the very top of the dashboard, before the summary cards grid.

### 2. Add "Custom" Date Range Option with From/To Pickers
Add a "Custom" button alongside "7 Days" and "30 Days". When selected, two date pickers (From / To) appear below the selector using Popover + Calendar components. All charts and summary cards filter to the custom range.

### 3. Add Summary Bar Chart for Food / Vomiting / Constipation
Add a new bar chart showing aggregate totals (sum of days) for food taken, vomiting, and constipation across the selected date range. Placed after the existing per-day Food/Vomiting/Constipation chart.

---

### Technical Details

**File: `src/types/health.ts`**
- Already updated: `DateRange = '7' | '30' | 'custom'` -- no change needed.

**File: `src/components/DashboardTab.tsx`**

1. **Reorder layout**: Move the range selector `<div className="flex gap-2">` block above the summary cards grid.

2. **Add state**: `customFrom` and `customTo` as `Date | undefined`.

3. **Add "Custom" to range options**: `{ label: 'Custom', value: 'custom' }`.

4. **Custom date picker UI**: When `range === 'custom'`, render a row with two Popover date pickers (From / To) using the Calendar component with `pointer-events-auto`.

5. **Update filter logic**: When `range === 'custom'` and both dates are set, filter records between `customFrom` and `customTo`. Otherwise fall back to 7/30 day logic.

6. **New summary chart**: Compute aggregate totals by summing `food`, `vomit`, and `constipation` from `chartData`. Render a `ChartCard` titled "Summary: Food / Vomiting / Constipation" with a BarChart showing 3 bars for the totals.

**New imports needed**: `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent`, `Button`, `CalendarIcon` from lucide-react, and `cn` utility.

