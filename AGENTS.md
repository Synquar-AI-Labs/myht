<claude-mem-context>
# Memory Context

# [myht] recent context, 2026-07-23 3:56pm EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (28,938t read) | 3,054,525t work | 99% savings

### Jul 11, 2026
S330 Credential recovery via Supabase — discovered myht project belongs to a different Supabase account, not fahadakbar@gmail.com (Jul 11 at 3:59 PM)
S331 Credential recovery via Lovable — paused at Lovable login page, waiting for user to confirm if credentials were already found (Jul 11 at 4:05 PM)
S332 Credential recovery stalled — Playwright parked at Lovable login page, user has not yet authenticated into Lovable (Jul 11 at 4:06 PM)
S333 Credential recovery via Lovable — still blocked at login page, no user authentication action taken yet (Jul 11 at 4:06 PM)
S336 WhatsApp + health tracker integration brainstorm — exploring how to merge myht dashboard with caregiver WhatsApp group for appointment/health coordination (Jul 11 at 4:09 PM)
1780 4:11p 🔵 Session Pivoted to Design Review — Screenshots of Current App UI Being Captured
1782 " 🔵 Playwright Named Screenshots Confirmed to Save at Project Root
1785 " 🔵 Post-Fix App UI Screenshot Captured at iPhone 14 Viewport
1787 4:12p 🔴 Design Screenshots and Playwright State Deleted
1805 " ⚖️ WhatsApp Integration Brainstorm — Merging Health Tracker with Caregiver WhatsApp Group
S334 Design review of Health Tracker app UI — screenshot taken, reviewed, and artifacts cleaned up; credential recovery still pending (Jul 11 at 4:12 PM)
S335 WhatsApp + health tracker integration brainstorm — user wants to merge the myht caregiver dashboard with their existing WhatsApp coordination group (Jul 11 at 4:13 PM)
S337 WhatsApp integration architecture decision — three-tier approach proposed, with "Share to WhatsApp" buttons as the immediate first step (Jul 11 at 4:56 PM)
S338 Local dev server background noise — user noticed something in the terminal; confirmed it was just the preview server shutting down, not a problem (Jul 11 at 4:58 PM)
### Jul 13, 2026
1810 12:56p 🔵 Repository: myht project on fix/live-sync-and-mobile-improvements branch
1811 " 🔵 myht project full file structure and architecture inventory
1812 12:57p 🔵 myht application core configuration, domain model, and TypeScript setup
1813 " 🔵 Supabase database schema: 10 tables with full RLS and realtime enabled
1814 " 🔵 Custom hooks architecture: data layer for all app features
1815 " 🔵 Medicine alert system: parseScheduleTime + isMedicineDue + getDueMedicineIds
1816 " 🔵 Index.tsx navigation: 7-tab SPA with lazy loading and fullscreen/presentation mode
1817 " 🔵 DashboardTab: weekly/monthly PDF report generation using jsPDF + autotable
1818 4:46p 🟣 Today-screen redesign: new TodayScreen component + nav restructure (feat/today-screen-redesign)
1819 4:47p 🔵 Design spec (README.md) fully read: authoritative contract for Today screen redesign
1820 " 🔵 todaySchedule.ts: date/time math implementation — specific edge cases and logic traced
1821 " 🔵 TodayScreen.tsx: double useMedicines hook instances, clock tick, and dialog state fully traced
1822 " 🔵 TodaySections.tsx: MedicineSection given/due status — 12h-window limitation and adjacent-slot DUE badge risk
1823 " 🔵 todaySchedule.test.ts: 10 unit tests — coverage gaps identified in adjacent-slot and midnight-DST scenarios
1824 " 🔵 Branch diff stats and git state: 11 files, 1273 insertions, 321 deletions — currently ON feat/today-screen-redesign branch
1825 4:52p 🔵 CONFIRMED BUG: adjacent-slot double-suppression — a 9PM log silently deletes the 10PM slot for same medicine
1826 " 🔵 DST handling verified: slot Date construction via template string is safe for Toronto timezone; spring-forward handled correctly
1827 " 🔵 Index.tsx nav restructure fully traced: all 7 tab functions preserved but Medicine schedule / Hospital stays now require 2 taps on mobile
1828 " 🔵 QuickLogSheet [open]-only effect: confirmed correct but has one residual issue — mode.fields not re-initialized if mode changes while sheet stays open
1829 4:54p 🔵 npm install hangs with empty output (exit 130 after Ctrl+C) — shell environment issue blocking verification runs
1830 " 🔵 useCustomActions: ALL custom_action_logs fetched globally (no date filter) — TodayScreen performance concern for large log sets
1835 4:55p 🟣 New adversarial review brief submitted: History diary + More shelf (commit 90599c7 on feat/today-screen-redesign)
1831 4:56p 🔵 myht Today-Screen Redesign: Build/Test/Type Verification All Pass Clean
1832 " ⚖️ Adversarial Review Brief Targets: DUE Window, Double Hook, Clock-Tick Safety, Midnight DST
S339 Adversarial code review of feat/today-screen-redesign branch — a complete "Today" home-screen redesign for a medical care app handling real patient data (Jul 13 at 4:59 PM)
1836 10:51p 🔵 Full source read of commit 90599c7: diary.ts, HistoryTab.tsx, MoreShelf.tsx, DailyRecordTab.tsx, Index.tsx, and all supporting hooks
1841 10:53p ✅ New adversarial review brief issued for commit 9cf355f (fix round for History/More shelf)
1837 10:54p 🟣 History Diary + More Shelf: Second Commit to feat/today-screen-redesign
1838 " 🔵 hospital-stays-summary Query Uses .limit(1) With count:'exact' — May Return Count of 1
1839 " 🔵 Diary Timeline Uses Mixed Timestamp Precision Across Five Data Sources
1840 " 🔵 Transcript Query Key Duplicated Between HistoryTab and useTranscripts Hook
1842 11:22p 🟣 Commit 9cf355f: Full implementation of 11 adversarial-review fixes for History diary and More shelf
1847 " 🟣 Round 3 adversarial re-review brief: commit a5e3cfa closes all four Round 2 merge-gate holds
1849 " 🔵 Round 3 review started: workspace on 9cf355f while target is a5e3cfa — git checkout required before verification
1843 11:23p 🔴 Commit 9cf355f: 11 History/More Findings Fixed — Written Notes UTC Timezone Bug Resolved
1844 " 🔵 DailyRecordTab Still Has Residual Three-State Date Model Risk After 9cf355f Fixes
### Jul 14, 2026
1848 12:30p 🔵 Round 3 review session started with workspace still on 9cf355f, NOT new commit a5e3cfa
1852 12:33p 🔵 Commit a5e3cfa confirmed at HEAD — all four Round 2 merge-gate fixes verified in source code
1853 " 🔵 Verification suite results (tsc/vitest/build/lint) are cached replays from 9cf355f — not re-run against a5e3cfa
1854 " 🔵 Three residual design risks identified in a5e3cfa: toast mismatch after Copy Previous mid-edit, emptyForm.date harmless stale value, and silent discard on navigate-mid-edit
1850 12:34p 🔴 Commit a5e3cfa: One Authoritative Day + Observable Save Failures + Reports Gate
1851 " 🔵 Residual Race: Day Navigation Enabled While addRecord In-Flight on Slow Connections
1855 12:38p 🔵 Vite Dev Server Hangs Silently Without TTY in Codex Sandbox — Mobile Smoke Tests Blocked
1871 4:06p ⚖️ feat/today-screen-redesign Declared Merge-Ready After 6 Adversarial Review Rounds
1872 " 🟣 fix/transcription-reliability: iOS Recording Support + Wake Lock + Retry Without Re-Recording
1873 " 🔵 PendingRetry State-Only: Page Refresh Orphans Failed Transcription's Retry Pointer

Access 3055k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>