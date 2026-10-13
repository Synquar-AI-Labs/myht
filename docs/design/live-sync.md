# Screens that stay in step by themselves

Owner report of 2026-10-12: the website was open on a wall tablet in full
screen and on a phone. A record changed on the phone "did not appear on the
tab… someone actually needs to refresh that page". He wants this for "other
users from other phones" and "same user from different machines". Written by
@leader. It adds to `accounts-and-families.md` §5.5.

## 1. What happened

Read on 2026-10-12 from the test server's own logs (last 24 hours) and from
the library source in `node_modules/@supabase/realtime-js` (2.95.3).

- An Android tablet has had the test website open since at least the evening
  of 2026-10-11. Its page kept asking the server for things every hour of the
  night, so the page was alive.
- In those 24 hours the tablet opened a live connection only a few times
  (23:00, 05:59, 14:00, 19:00, 22:59). At 04:01 the live-update service logged
  "Tenant has no connected users". So for part of the night the page was
  running without any live connection, and it did not get one back until
  05:59.
- Why it does not come back: `useRealtimeSync` only acts on `SUBSCRIBED`. When
  the server ends a channel in an orderly way, the library marks it closed,
  removes it and does **not** rejoin (`_onClose` in `RealtimeChannel.js`; a
  rejoin is only scheduled after an error or a timeout). The page gets
  `CLOSED`, ignores it, and from then on hears nothing. A sleeping tablet
  whose sign-in ticket ran out is one way to get there; a restart on the
  server side is another.
- Nothing else catches it. The five-minute timer and the "came back to the
  front" handler refresh the family and the invites, not the records. React
  Query's refresh on focus never fires on a screen that is always showing.

## 2. What must hold

- A change made anywhere shows on every open screen of that family without
  anyone refreshing: at once when the live connection works, and within about
  30 seconds when it does not.
- A dead live connection repairs itself.
- Still no medical rows over the live connection: only the per-family ticker.
- No new server objects. The ticker row is already readable by members.
- Cheap: one small read per open screen every 30 seconds, only while the
  screen is showing.

## 3. The rule

The ticker row is the truth. The live connection is only the fast way to hear
about it.

- The screen remembers the last ticker number (`seq`) it has acted on.
- **Asking the ticker**: read the family's `seq`. If nothing is remembered
  yet, the answer is only remembered: this is the one case that sets a
  starting point without refreshing. An answer higher than the remembered
  number means something was missed: refresh everything of that family once
  (the `['household', id]` keys and the family itself) and remember the new
  number. An answer that is not higher is a late answer to an old question:
  ignore it. A read that fails changes nothing.
- The screen asks: when it starts, each time the live connection reports
  `SUBSCRIBED`, every 30 seconds while it is showing, when it comes back to
  the front, and when the network comes back.
- **A live event** carries the new `seq` and the name of one table only.
  - Exactly the remembered number plus one: refresh that table's keys as
    today and remember it.
  - Higher than that: at least one event in between was lost and its table is
    unknown, so refresh everything of that family and remember the new number.
  - Nothing remembered yet: refresh everything and remember it.
  - Not higher than the remembered number: already handled, do nothing.
- **Repair**: when the channel reports `CLOSED`, `CHANNEL_ERROR` or
  `TIMED_OUT`, and we did not close it ourselves, remove it and build a new
  one after a short wait that grows up to a minute; a successful subscribe
  resets the wait. When a ticker read finds a change that no live event
  announced within a few seconds, the channel is treated as dead and rebuilt
  too.
- Leaving the screen, signing out or switching family stops everything and
  never triggers a repair.

The existing refresh of the family and invites (on return to the front and
every five minutes) stays as it is.

## 4. Checks

- Unit tests for the rule: first answer, same number, higher number, failed
  read, event exactly one ahead, event not newer, several events in a row, an
  event that skips a number across two different tables, an event before any
  answer, and a slow answer that arrives after a newer event.
- The hook with the channel mocked: `CLOSED` from the server builds a new
  channel; our own clean-up does not; a subscribe after a repair asks the
  ticker; no repair storm while the server keeps refusing.
- Browser tests, two signed-in pages of one family, nobody reloads and the
  first page never loses focus:
  1. live connection working: a change on the second page shows on the first
     at once (exists today as test d);
  2. the first page's live connection goes silent (messages from the server
     no longer arrive): the change still shows within the 30-second check;
  3. the server closes the first page's channel: the page subscribes again
     and the next change shows at once.
- Everything that exists passes unchanged, including the hostile-subscription
  test.
- By @leader on the test server after release: the tablet row in the logs
  reconnects after a close, and the ticker is read about twice a minute per
  open screen, no more.

## 5. Not in this step

A "last updated" mark on the screen. Showing who else is looking. The old
app on `main`: its screens only refresh on focus unless live updates were
switched on in its database, which we cannot see; it is not touched here.
