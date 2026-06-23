# Changelog

All notable changes to Isaac will be documented in this file.


## [1.96.3] - 2026-06-16

### Fixed
- Daily digest email no longer includes shopping-list items in "Today's Tasks". `scheduler.send_daily_digest` was missing the default-list filter (`or_(Task.list_id.is_(None), ListModel.is_default == True)`) that the dashboard/calendar/CalDAV paths already use — so items from Groceries, Sparr, Home Goods, and Home Depot lists were leaking into the morning email. The `/settings/test-daily-digest/` endpoint already had the filter; the scheduled job didn't. Both queries (today + overdue) now apply the filter, matching the test endpoint exactly.


## [1.96.2] - 2026-06-16

### Fixed
- Calendar page no longer appears empty. Both `/dashboard/calendar/{year}/{month}` and `/dashboard/calendar/week/...` routes were crashing with `TypeError: '<' not supported between instances of 'int' and 'NoneType'` whenever any task in the queried range had a NULL priority — `dict.get("priority", 2)` returns None when the key exists with None value, and the sort key tuple comparison then failed. Frontend swallowed the 500 silently, leaving the calendar blank. Switched to `(x.get("priority") or 2)`.


## [1.96.1] - 2026-06-14

### Fixed
- Animals page motto now fills the header row horizontally between the title and action buttons, matching every other page. Was previously constrained to a `max-w-xs` box by a stray className override.


## [1.96.0] - 2026-06-14

### Added
- Boot-time decrypt probe (`verify_secret_key_against_db`) runs in lifespan startup; aborts service start if every encrypted setting fails to decrypt with the resolved SECRET_KEY (key mismatch detection).
- Explicit init-gate: encryption module refuses to auto-generate a fresh SECRET_KEY unless `ISAAC_ALLOW_KEY_INIT=1` is set, preventing silent key generation on container/service restarts.
- `backend/start.sh` is now versioned in the repo and deployed via the standard sync.

### Changed
- `start.sh` fail-loud on secrets backend miss: if `ISAAC_SECRET_BACKEND=infisical` and the secret key cannot be fetched, service refuses to start with a recovery hint instead of silently falling back to `.env`.
- Encryption decrypt-probe semantic: passes if at least one `enc::` row decrypts (or none exist); only fails when rows exist and none decrypt. Partial orphan rows log a warning but allow startup.

### Fixed
- Restored Infisical-stored SECRET_KEY as canonical; recovered six previously-undecryptable encrypted settings (anthropic, awn x2, cloudflare, deepl, smtp) that had been locked out by a stale auto-generated key in `.env`.


## [1.95.2] - 2026-06-09

### Fixed
- Rollover balance is now a pure per-pay-cycle sum: for every completed pay cycle since the setup month, add (per-cycle budget) + (cycle spending, negative). The previous logic mixed full monthly budgets for past months with per-cycle credit for current-month cycles, double-counting any biweekly cycle that straddled a month boundary and inflating the displayed rollover. Production rollover went from +$53.93 (wrong) to -$696.02 (honest cumulative deficit).


## [1.95.1] - 2026-06-09

### Fixed
- Period Deposit double-entry now retro-backfills the missing source-account debit when the credit already exists from a prior one-sided deposit. The earlier `continue` after the existing-credit check meant historical deposits (created before `funding_account_id` was configured) never got their offsetting debit, leaving Main Checking $1,257 higher than reality per cycle. Regression test added.


## [1.95.0] - 2026-06-06

### Added
- Budget cycle config supports four cycle types: `weekly`, `biweekly`, `semimonthly`, `monthly`. Periods-per-month math derives from the configured cycle.
- Budget categories gain an `is_rollover` flag. Rollover is now opt-in by flag, not by hardcoded category name.
- Transfer categories gain a `funding_account_id`. When set, Period Deposit auto-transactions are double-entry: credit destination + matching debit on the funding account.
- Income auto-deposit: active `budget_income` rows now generate credit transactions on every pay date inside the cycle window, for all four frequencies.
- `budget_reconcile_in_progress` app setting pauses auto deposits during backfill.
- Period snapshots persist `rollover_balance` instead of always recording 0.

### Fixed
- Rollover balance honors the configured cycle instead of hardcoding day-15 semi-monthly. Fixes drift when a non-semi-monthly cycle is in use.
- Rollover `monthly_budget` fallback uses `budget_amount * periods_per_month`, not the old `* 2` heuristic.


## [1.94.3] - 2026-05-31

### Fixed
- Maintenance "Complete" buttons (home, vehicle, equipment, farm-area, plant transplant) no longer 500 when duplicate auto-reminder Task rows exist. Lookup now uses exact `notes ==` match and iterates `scalars().all()` instead of crashing on `scalar_one_or_none()`.
- Exact-match notes lookup closes a substring-collision class of bug where `auto:home_maint:19` would match `auto:home_maint:190`. Same fix applied across all five maintenance routers.
- Cleaned 5 historical task rows that had `is_completed=0` with `completed_at` set (inconsistent state from an older code path; all already inactive).
- Marked older orphaned duplicate auto-reminder Task (#178 "Home: Clean Dishwasher") completed so home_maint #19 can be completed via the UI.

## [1.94.2] - 2026-05-28

### Fixed
- Floating Action Menu "Keyboard" button now works on the kiosk display. The toggle endpoint was admin-gated and silently returned 403 for the passwordless kiosk user. Relaxed to `require_auth` so any logged-in user can summon the shared on-screen keyboard.
- Onboard D-Bus session path now resolved at runtime from the current UID (`/run/user/{uid}/bus`) instead of hardcoded `1000`. Survives any future service-user change.
- D-Bus call failures now log stderr at WARNING/ERROR for diagnosability. Show fallback failures now surface as HTTP 500 instead of pretending success.

## [1.94.1] - 2026-05-28

### Fixed
- **Security:** Kiosk-user passwordless login now uses socket-level peer IP, not header-derived IP, when the connection is not from loopback. Defeats X-Real-IP / X-Forwarded-For injection by attackers who reach uvicorn directly on the LAN.
- Kiosk origin allowlist is now explicit IP pinning via `KIOSK_ALLOWED_IPS` env var (default `127.0.0.1,::1`). Garage host restored.
- Successful kiosk logins are now logged at INFO with origin IP and socket IP for audit trail and divergence detection.

## [1.94.0] - 2026-05-26

### Added
- Secret backend abstraction for `SECRET_KEY`, plus an admin CLI for key initialization, rotation, and encryption audits.
- CalDAV success tracking and silence detection, including `/health/admin` visibility for last-success timestamp and current silence severity.

### Changed
- CalDAV scheduler work now pauses while encryption rotation is in progress, and successful sync operations throttle-write `last_caldav_success_at` to avoid unnecessary database churn.

## [1.93.12] - 2026-05-26

### Fixed
- **Security:** `/health` endpoint no longer exposes `encryption_errors[]` array to unauthenticated callers (information disclosure). Now returns `has_encryption_errors: bool` instead. Detailed errors moved to new authenticated `/health/admin` endpoint. Prevents reconnaissance mapping of encrypted settings (e.g., `calendar_password`, `anthropic_api_key`).
- **Security:** `.env` auto-generation now atomic and mode 0600 (owner-only readable). Uses temp file + fsync + rename, preventing world-readable SECRET_KEY and race conditions if two processes call `_get_secret_key()` concurrently. Adds fcntl advisory lock on `.env.lock` and re-checks after lock acquisition.
- **Performance:** Encryption error email notification now fire-and-forget. `asyncio.create_task()` schedules the email send in the background with a 10s timeout, so slow/unreachable SMTP servers can no longer block backend startup. Timestamp update remains inline to prevent duplicate sends.
- **Code quality:** Lifted local imports out of `_run_encryption_audit()` to module top-level (fixes P1 code quality issue). Explicit `except ValueError:` instead of silent `pass` blocks for timestamp parsing, with logging at DEBUG level.
- Updated `_get_secret_key()` docstring to document the RuntimeError when encrypted data exists but no key is found.

## [1.93.11] - 2026-05-26

### Fixed
- SECRET_KEY rotation no longer silently destroys encrypted settings. If the master encryption key goes missing while encrypted values exist in app_settings (passwords, API keys), the backend now refuses to start with a clear recovery message instead of auto-generating a new key and orphaning the data. Fresh installs still auto-generate on first run.
- Decryption failures now log at ERROR level with the affected setting name, instead of a silent WARNING.

### Added
- Startup encryption audit. On boot, the backend attempts to decrypt every encrypted app_settings row; any failures are logged and surfaced in the /health endpoint as `encryption_errors[]` so the dashboard can show an actionable banner.
- Idempotent email alert when encryption errors are first detected (once per 24h), so a key rotation incident reaches the admin within minutes instead of being silently swallowed.


## [1.93.10] - 2026-05-23

### Fixed
- Budget Overview showed two different rollover values on the same page: the "Roll Over" category card and the "Rollover" account-balance card disagreed by ~$1,750 because they were computed by two independent code paths. The duplicate inline calculation inside the period-summary endpoint has been removed and replaced with a single call to `_calculate_rollover_balance`, so both cards now always show the same number for every period tab (This Period, Last Period, monthly).
- Note: the displayed Roll Over category value will change to match the Rollover account card. Both cards now reflect the function's existing semi-monthly logic. A follow-up will make this logic cycle-aware so it computes correctly on biweekly cycles (currently produces a stable but mode-mismatched number).


## [1.93.9] - 2026-05-07

### Fixed
- Budget Overview rollover balance was wrong because the first month of tracking (February) was excluded by a "setup month skip" rule. Rollover now starts accumulating from the actual first transaction month instead of month 2. The displayed value changes from -$670.68 to the correct -$428.29.
- Dane/Kelly spending cards showed inflated or stale available balances because they used the all-time account balance (including prior-period history) instead of the current period's deposit minus current-period spending. Cards now show deposit_per_period minus transactions scoped to the current pay period window.


## [1.93.8] - 2026-04-29

### Fixed
- Task save / complete / uncomplete returned 500 ("Server error. Please try again later.") on tasks with no priority set. The TaskResponse Pydantic schema in `backend/routers/tasks.py`, the worker TaskResponse in `backend/routers/workers.py`, and the DashboardTask + CalendarEvent schemas in `backend/dashboard.py` all declared `priority: int` while the database column is nullable. The 1.93.7 fire-and-forget CalDAV change exposed the bug because the request now actually reaches the response serializer instead of timing out first. All four schemas now declare `priority: Optional[int] = None`. The 1.93.4 entry claimed DashboardTask/CalendarEvent were patched but the change wasn't actually applied — re-applied here.


## [1.93.7] - 2026-04-29

### Fixed
- Quick-add task showed "Request timed out" even though the task saved. `_sync_task_to_calendar` in `backend/routers/tasks.py` was recursing into itself for the default-list / list-not-found / no-list branches instead of dispatching to `calendar_service.sync_task_to_calendar` (the global-sync method on the service). Each recursive frame issued an extra DB query, so the request blocked past the 10s axios timeout while the DB insert had already committed. The recursion is now corrected, and CalDAV sync runs in the background via a fire-and-forget `asyncio.create_task` (matching the email-notification pattern) so a slow or unreachable CalDAV server can never trip the API timeout. Applies to create, update, complete, and uncomplete task paths.


## [1.93.6] - 2026-04-28

### Fixed
- Editing an animal's location to a different farm area updated the `pasture` text but left `farm_area_id` pointing at the previous farm area. The collapsed card chip and the location grouping both prefer `farm_area.name`, so they kept showing the old area while the expanded "Location" detail (which reads `pasture`) showed the new one. Both `LocationSelect` call sites in Animals.jsx (edit card and add/edit form) now look up the selected name in `farmAreas` and sync `farm_area_id` to the matching id, or null for custom locations. Existing animals with stale FKs heal on next save.


## [1.93.5] - 2026-04-28

### Fixed
- Animal collapsed card location chip ignored sub-location. Editing an animal's pasture and sub-location persisted and showed correctly in the expanded edit view, but the chip on the collapsed card only rendered `farm_area.name || pasture` and dropped the sub-location entirely. The chip now mirrors the expanded view's `parent > sub` formatting (e.g., "Back Pasture > Left Pasture").


## [1.93.4] - 2026-04-27

### Fixed
- Dashboard returned 500 when any task in the result set had a NULL priority. The DashboardTask and CalendarEvent Pydantic schemas declared priority as a non-Optional int while the database column is nullable. Quick-add tasks created without a priority would crash the next dashboard fetch, which made the UI look like quick-add silently failed even though the rows were inserted. Both schemas now allow Optional[int] = None.


## [1.93.3] - 2026-04-27

### Fixed
- Completing a task on the Dashboard widget still required a refresh in v1.93.2. The dashboard renders tasks via `TaskList.jsx`, which had no optimistic update — only `ToDo.jsx` was patched in 1.93.2. `TaskList` now keeps a local `pendingState` map of optimistic completions, applies it before partitioning incomplete/completed, and self-clears each entry as the parent's refetch returns matching server state.


## [1.93.2] - 2026-04-26

### Fixed
- Completing a task no longer required a page refresh to show the checkmark. The list reconciliation refetch was triggering the loading spinner, hiding the optimistic UI update. Reconciliation refetches (toggle, delete, edit, create, backlog) now run silently while initial loads and view changes still show the spinner.
- Dashboard spending ticker showed `$0` deductions for users on the biweekly pay cycle. The dashboard summary endpoint hardcoded semi-monthly periods (1st-14th / 15th-end) and ignored `budget_cycle_type=biweekly`, so transactions before the wrong window were excluded. The endpoint now reuses `_cycle_window` with the configured cycle type and anchor.


## [1.93.1] - 2026-04-25

### Fixed
- Items unchecked on iPhone Reminders stayed marked complete on Isaac and disappeared from the list view. Calendar-to-task sync now honors uncheck events for non-recurring tasks on per-list checklists (Groceries, Sparr, Home Goods, etc.). Default-list tasks and recurring tasks keep the legacy "completion-only" guard so accidental calendar edits do not reset state.


## [1.93.0] - 2026-04-24

### Added
- Auto-purge for old completed tasks. Scheduler now runs daily at 03:15 server time and permanently deletes any task that has been completed for more than 24 hours. Recurring task series are preserved.

### Fixed
- iPhone Reminders items created in per-list calendars (Groceries, etc.) were imported into Isaac as orphans with no list assignment, because the CalDAV import code only recognized the legacy "{primary} - {list}" calendar naming. Per-list calendars are now identified by their `isaac-list-N` cal_id slug, which matches how lists are actually created on Radicale.
- The default task list never received a CalDAV calendar, so the main todo list was invisible to iPhone Reminders. Default lists are now provisioned to Radicale on creation.
- Renaming a list in Isaac now also renames the corresponding CalDAV calendar's display name on Radicale, instead of orphaning the old one and creating a duplicate.

### Added
- Budget cycle type setting (semi-monthly or biweekly). Available in Settings > Budget > Pay Period tab.
  - Semi-monthly (default, existing behavior): 1st-14th / 15th-end.
  - Biweekly: rolls every 14 days from a configurable anchor date.
- `GET /budget/cycle-config/` and `POST /budget/cycle-config/` endpoints.
- Period helpers (`_cycle_window`, `_next_cycle_start`, `_period_key_for`) centralize the period math across the budget router.
- Biweekly period keys use `BW-YYYY-MM-DD` format (cycle start date) so they don't collide with semi-monthly `YYYY-MM-1`/`-2` history.

### Notes
- Rollover calculation remains month-based in both modes (known v1 limitation).
- Monthly Budget and Bills Summary tabs still render semi-monthly layouts in both modes; they'll follow in a later release.

## [1.91.16] - 2026-04-24

### Fixed
- Budget "Advance to Next Period" button could be clicked twice and silently skip a whole pay period. Prod was double-advanced on 2026-04-24 (jumped to 2026-05-2 instead of 2026-05-1). Added:
  - Confirmation dialog before advancing, showing the current period label
  - Backend guard (HTTP 409) that refuses an advance if the target period is more than ~16 days past today (i.e. already advanced)
  - 3s post-success cooldown on the Advance button to block rapid double-submits
  - `force=true` override parameter for the rare case a user genuinely needs to skip a period


## [1.91.15] - 2026-04-24

### Fixed
- Todo list appeared empty in production — regression from v1.91.13. Frontend `parseCompletedAtInUserTz` helper in ToDo.jsx was passing the settings object (with `.value` property) directly to `Intl.DateTimeFormat()` instead of the extracted timezone string. This caused `RangeError: Invalid time zone specified` which aborted the filter callback, preventing any todos from displaying. Fixed by using `getTimezone()` context method instead and added try/catch to fallback to UTC boundary if timezone parsing fails.


All notable changes to Isaac will be documented in this file.


## [1.91.14] - 2026-04-24

### Fixed
- Tasks list endpoint (GET /api/tasks/) throws 500 error caused by undefined settings helper (regression from v1.91.13). Fixed by using correct get_setting_value() helper instead of erroneous get_setting().


## [1.91.13] - 2026-04-23

### Changed
- CLAUDE.md: Updated dev-tracker references to issue tracking system. All development tasks now tracked in project issue tracker instead of local dev-tracker.sh script.
- CLAUDE.md: Reinforced dynamic timezone rule at top-of-file. All date-bounded logic must read timezone from app_settings at runtime, never hardcode 'America/New_York' or any literal zone.

### Fixed
- Completed list items no longer vanish before end-of-day. Fixed naive-UTC timezone mishandling in:
  - Backend: `tasks.py` now resolves configured timezone dynamically instead of hardcoded 'America/New_York' when computing today-bounds for include_completed_today filter
  - Frontend: `ToDo.jsx` now correctly parses backend naive-UTC completed_at timestamps and compares to "today" in the user's configured timezone
  - Fixed items completed near local midnight (e.g., 9 PM Eastern) no longer disappear 4+ hours after completion


## [1.91.12] - 2026-04-23

### Changed
- Default task priority is now None (unprioritized) instead of Medium (priority=2). Existing tasks retain their assigned priorities.
- Task priority picker now offers explicit "None" option (previously only had High, Medium, Low).
- Tasks without a priority now sort last in all list views; prioritized tasks (1-3) sort first.
- CalDAV VTODO components omit the PRIORITY field when task.priority is null, per iCalendar spec (undefined priority defaults to 0/lowest).



## [1.91.11] - 2026-04-23

### Fixed
- CalDAV per-list calendar push no longer crashes with "Calendar.save() type error". sync_task_to_list_calendar now uses the correct caldav API (save_todo with serialized iCalendar data) and builds complete VTODO components with all fields (priority, completion, reminders, recurrence, categories, location, status, alarms) instead of dropping them.
  - Tasks on non-default lists are now synced to per-list calendars with full field set
  - Existing tasks are updated in-place by UID; new tasks are created
  - calendar_uid is populated after sync so tasks are linked and not re-created
  - Fix addresses items #820 (crash) and #819 (calendar name simplification)
- CalDAV list calendars now use bare list names (e.g., "Groceries" instead of "Mealey Family Farm - Groceries")
  - get_calendar_for_list now drops the farm-name prefix for new and existing calendars
  - Legacy calendars with old prefix format are automatically renamed in-place on next sync cycle
  - Primary calendar and iPhone-origin items are unaffected

## [1.91.10] - 2026-04-23

### Fixed
- Checking off a task now shows it as complete immediately instead of waiting for a full browser reload. Frontend uses optimistic state update to flip the checkbox and strikethrough instantly, then reconciles with the server asynchronously; on API error, the UI reverts to server truth.
