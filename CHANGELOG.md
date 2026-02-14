# Changelog

All notable changes to Isaac will be documented in this file.

## [1.85.17] - 2026-02-14

### Changed
- **Daily Digest Task Ordering** - Tasks now sorted by scheduled time
  - Tasks with times appear first, ordered chronologically
  - Tasks without times follow, ordered by priority
  - Each task shows its time (e.g., "9:30 AM") if scheduled

## [1.85.16] - 2026-02-14

### Fixed
- **Quick Gear Item Names** - Fixed item names not displaying in Quick Gear modal
  - Was using wrong property name (`name` instead of `item_name`)
  - Item names now show correctly next to quantity controls

## [1.85.15] - 2026-02-13

### Fixed
- **Quick Gear Contents** - Fixed pool/unassigned gear not showing contents
  - Removed early return that blocked loading contents for gear without member assignment
  - Container contents now load correctly for both assigned and unassigned gear
- **Quick Transaction Categories** - Fixed category dropdown showing all categories
  - Now correctly filters out fixed (bills) and transfer (allocation) categories
  - Shows only variable and income categories appropriate for quick logging

## [1.85.14] - 2026-02-13

### Changed
- **Task Reminder Logging** - Improved logging for task reminder emails
  - Now logs which recipients received the reminder
  - Helps debug when team members don't receive expected emails

## [1.85.13] - 2026-02-13

### Fixed
- **Health Monitor False Warning** - Removed spurious "all tasks skipped" warning
  - Incremental calendar sync skips unchanged tasks (hash-based change detection)
  - This is normal behavior, not an error - sync is working correctly

## [1.85.12] - 2026-02-13

### Fixed
- **Sleep Quality Display** - AI context now correctly shows sleep quality as /5 scale
  - Was incorrectly showing as /10 which made good values (4/5) look poor (4/10)
  - Sleep quality 1-5 where: 1=Poor, 3=Average, 5=Excellent

## [1.85.11] - 2026-02-13

### Fixed
- **Test Email Error Messages** - Clearer error when SMTP password is missing
  - If encryption key changed and password can't be decrypted, shows specific message
  - Directs user to re-enter SMTP password in Settings > Email Server

## [1.85.10] - 2026-02-13

### Added
- **Quick Gear in Floating Menu** - Adjust gear/bag contents from anywhere
  - Click the hamburger/dots menu in the bottom-right corner
  - Select "Quick Gear" to see all containers with +/- buttons
  - Quickly update item quantities when using supplies on the go
- **Quick Transaction in Floating Menu** - Add budget transactions from anywhere
  - Select "Transaction" from the floating menu
  - Add income or expenses with category selection

### Fixed
- **Schedule Invoice Button Visibility** - Added calendar icon button to order cards
  - Schedule Invoice now appears in the action buttons row (top-right of order)
  - More visible than the text link at the bottom of the card

## [1.85.9] - 2026-02-13

### Fixed
- **Email Reliability** - Reduced SMTP connection timeout from 30s to 10s
  - Faster failover to alternate servers when one is unreachable
  - Improves receipt email reliability when Protonmail servers are slow

## [1.85.8] - 2026-02-13

### Changed
- **Event Time Format** - Now respects the time_format setting from Settings
  - Shows 12-hour (AM/PM) or 24-hour format based on your preference
  - Setting is in Settings > Display > Time Format

## [1.85.7] - 2026-02-13

### Changed
- **Dashboard Schedule Dropdown** - Improved mobile usability
  - Larger touch target (44px height) on mobile devices
  - Full-width dropdown for easier selection
  - Better text size and padding for mobile

## [1.85.6] - 2026-02-13

### Fixed
- **Event Date Format** - Date picker in Add Event now uses MM/DD/YYYY format
  - Replaced native date input with Month/Day/Year dropdowns
  - Consistent date display regardless of browser/OS locale settings

## [1.85.5] - 2026-02-13

### Fixed
- **Event Time Format** - Time picker in Add Event now uses 12-hour format with AM/PM
  - Replaced native time input with custom hour/minute/AM-PM dropdowns
  - Consistent 12-hour display regardless of browser/OS locale settings

## [1.85.4] - 2026-02-13

### Fixed
- **Dev Tracker Mobile Images** - Paste and upload now work on mobile devices
  - Paste button opens modal with textarea for mobile-friendly pasting
  - "Use Camera" button allows taking photos directly from mobile
  - Upload button continues to work for gallery selection

## [1.85.3] - 2026-02-11

### Added
- **Team Member Task Visibility** - Control where member-assigned tasks appear
  - **Today's Schedule** - Task shows in main Today's Tasks and calendar
  - **Main Backlog** - Task shows in main Backlog section (not today's schedule)
  - **Member Only** - Task is private to the team member (e.g., "order new underwear")
  - Select visibility via "Show In" dropdown when creating/editing member tasks

## [1.85.2] - 2026-02-11

### Changed
- **Worker Tasks** - Unified tasks view with backlog support
  - Removed separate "Visit Tasks" tab - now all tasks show under "Tasks" tab
  - Added **Backlog section** - move tasks to backlog to do later (not this visit)
  - Click Archive icon to move task to backlog, Inbox icon to move back to active
  - Standard and one-off tasks can be freely reordered together via drag and drop
  - Backlog tasks shown in collapsible section below active tasks

## [1.85.1] - 2026-02-11

### Changed
- **Worker Visit Tasks** - Moved Visit Tasks feature from Team Members to Workers page
  - Now accessible in the Workers tab with dedicated "Visit Tasks" view mode
  - Works with workers in the Workers table (like housekeepers, contractors)
  - Standard tasks, current visit, visit history all work with the Workers section

## [1.85.0] - 2026-02-10

### Added
- **Worker Visit Tasks** - New "Visit Tasks" tab for workers (team members with SUPPORT role or worker-related title)
  - **Standard Tasks** - Tasks that reset each visit (cleaning, vacuuming, etc.)
    - Manage via "Standard Tasks" settings button
    - Drag to reorder for priority
  - **Current Visit** - Shows all tasks for this visit with clear priority order
    - Numbered tasks with "DO NEXT" badge on the first incomplete task
    - "Complete in Order" notice for clear workflow
    - Standard tasks auto-populated from templates
    - Incomplete one-off tasks carry over from previous visits
  - **One-Off Tasks** - Add visit-specific tasks (deep clean oven, organize pantry)
    - Purple badge distinguishes from standard tasks
    - Carry over if not completed
  - **Visit History** - View past visits with task completion status
    - Duplicate any past visit to create a new visit with the same tasks
  - **Complete Visit** - Mark visit as done when all tasks complete

## [1.84.0] - 2026-02-10

### Added
- **Accounts Tab in Budget** - New dedicated "Accounts" tab for managing external accounts like Trust Funds, House/Travel Funds, etc.
  - Create accounts with initial balance and "as of" date
  - Current balance auto-calculates from initial balance + transactions
  - Sub-tabs for each account with quick balance preview
  - Add deposits and withdrawals directly to accounts
  - View full transaction history per account with edit/delete capability
  - Link TRANSFER budget categories as allocations within accounts
  - Adjust allocation balances (e.g., divide funds between Travel vs House)
  - Account settings to update name, institution, and initial balance

## [1.83.15] - 2026-02-09

### Added
- **Expense Breakdown on Production Overview** - The Expenses card now shows a detailed breakdown:
  - Animal Costs (feed, medical, etc.)
  - Processing (butcher fees)
  - Business Expenses (if any)

## [1.83.14] - 2026-02-09

### Added
- **Scheduled Invoice Emails** - Schedule invoice reminder emails for livestock orders. Perfect for multi-payment orders like steer sales with deposit, feed switch payment, and final pickup payment.
  - Schedule invoices from any order card in Production > Business
  - Set send date, payment type, amount, and custom description
  - Emails are automatically sent at 8 AM on the scheduled date
  - Manually send scheduled invoices early if needed
  - View sent status and manage scheduled invoices directly on order cards

## [1.83.13] - 2026-02-09

### Added
- **Production Calculator on Production > Business** - A multi-purpose calculator with 5 modes:
  - **Price per Pound**: Calculate $/lb from total cost and weight
  - **Profit Margin**: Calculate profit and margin % from cost and sell price
  - **Break Even**: Calculate minimum price needed to cover expenses
  - **Revenue Projection**: Calculate expected revenue from price and quantity
  - **Yield per Acre**: Calculate production rate per acre

### Fixed
- **Email reliability improved** - SMTP now tries multiple DNS-resolved IPs if the first one fails. This fixes intermittent email failures when one of ProtonMail's servers is unreachable.

## [1.83.12] - 2026-02-08

### Fixed
- **Recurring tasks no longer get deactivated by calendar sync** - Previously, when the calendar sync couldn't find a recurring task in the calendar scan (due to how iPhone reports RRULE events), it would incorrectly mark the task as "deleted from phone". Now recurring tasks are protected from this false deletion detection.
- **Calendar sync no longer creates duplicates for recurring events** - iPhone reports recurring event occurrences with date-suffixed UIDs (e.g., `BASE-UID_2026-01-26`). The sync now detects these as occurrences of existing recurring tasks instead of creating new duplicate tasks.

## [1.83.11] - 2026-02-08

### Changed
- **Action items from AAR are now reminders without due dates** - Action items created from Weekly AAR no longer have automatic due dates. They appear as tasks that "just need to get done" without a specific deadline.

## [1.83.10] - 2026-02-08

### Fixed
- **Action items in Weekly AAR can now be edited** - Added a pencil icon to edit action items inline. Click the pencil to edit the item text and assigned person, then press Enter or click the checkmark to save.

## [1.83.9] - 2026-02-08

### Added
- **Worker task dropdown on Dashboard** - A new dropdown above "Today's Schedule" lets you view tasks assigned to specific workers. Select a worker to see their tasks, or leave on default to see today's schedule.

## [1.83.8] - 2026-02-06

### Fixed
- **Reduced calendar sync log noise** - RRULE parsing messages now log at DEBUG level instead of INFO. Previously every sync cycle logged 9 "Parsed RRULE" messages.

## [1.83.7] - 2026-02-06

### Fixed
- **Recurring tasks with old start dates now sync to calendar** - Recurring tasks whose start date is more than 7 days ago were being excluded from calendar sync. Now recurring tasks sync regardless of their start date since the RRULE generates future occurrences.

## [1.83.6] - 2026-02-06

### Fixed
- **Recurring events now stay on calendar when marked complete** - Completed recurring tasks (weekly fitness, monthly reviews, etc.) were disappearing from iPhone calendars because the sync excluded completed tasks. Now recurring tasks continue to sync with their RRULE so future occurrences still appear on the calendar. Completion for recurring tasks means "this occurrence done", not "cancel entire series".

## [1.83.5] - 2026-02-06

### Fixed
- **Health monitor no longer warns about expected calendar skip ratios** - The warning "High skip ratio" was triggering even when skips were expected (recurring task occurrences and worker-assigned tasks are intentionally skipped). Now only warns when ALL tasks are skipped (synced=0), which indicates a real sync problem.

## [1.83.4] - 2026-02-06

### Fixed
- **AI budget insights no longer hallucinate numbers** - The AI was misinterpreting budget data and reporting incorrect over/under budget amounts. Updated prompts to explicitly instruct the AI to only use exact numbers from the data, and to recognize over-budget status only when explicitly marked. The AI should now accurately reflect the budget vs actual data provided.

## [1.83.3] - 2026-02-06

### Fixed
- **Time format now respects 12h/24h setting everywhere** - Dashboard clock and Weather widget "Updated" time now use the configured time format setting instead of hardcoded formats. Added `formatTimeFromDate` helper for consistent time formatting from Date objects.

## [1.83.2] - 2026-02-06

### Fixed
- **Task email alerts now require explicit reminder_alerts configuration** - Previously, tasks could receive email reminders even without configuring reminder_alerts (either via default settings or the generic "upcoming tasks" hourly check). Now, tasks will only receive email alerts if they have explicit reminder_alerts set. Tasks without alerts configured will still appear in the daily digest and dashboard, but won't generate separate email reminders.

## [1.83.1] - 2026-02-06

### Fixed
- **Daily digest now retries on SMTP failure** - Previously, if the SMTP server was unreachable at digest time (e.g., network blip), the digest was marked as "sent" even though email delivery failed, preventing retries. Now the sent marker is only set AFTER successful email delivery, so transient SMTP failures trigger an automatic retry on the next scheduler run.
- **Team alerts gear name display fixed** - The daily digest team alerts section was crashing with "MemberGear has no attribute gear_name". Fixed to use the correct `name` attribute.

## [1.83.0] - 2026-02-05

### Added
- **Task reminder emails now sent to assigned team members** - When a task has alert reminders configured, emails are now sent to assigned team members who have email addresses on file, in addition to the existing worker/user/global recipient logic. Supports both the multi-member assignment (M2M) and legacy single-member assignment fields.

## [1.82.10] - 2026-02-05

### Fixed
- **Security: Encryption key derivation upgraded to PBKDF2** - Settings encryption now uses PBKDF2-HMAC-SHA256 with 100,000 iterations instead of a single SHA256 hash. Existing encrypted values are automatically decrypted with the legacy key and re-encrypted with the new key on next write.

## [1.82.9] - 2026-02-05

### Fixed
- **Security: URL settings now validated for SSRF prevention** - Ollama URL and CalDAV URL settings now require valid http/https scheme and block known cloud metadata endpoints (169.254.169.254, etc.). Prevents potential Server-Side Request Forgery if a malicious URL is configured.

## [1.82.8] - 2026-02-05

### Fixed
- **Security: Statement parser regex now has timeout protection** - User-configurable regex rules for budget auto-categorization are now wrapped in a 1-second timeout to prevent ReDoS (Regular Expression Denial of Service). Previously a pathological regex pattern could hang the request indefinitely.

## [1.82.7] - 2026-02-05

### Fixed
- **Security: Updated vulnerable dependencies** - Updated python-multipart 0.0.20→0.0.22 (CVE-2026-24486), pdfminer.six 20231228→20251230 (CVE-2025-64512, CVE-2025-70559), pdfplumber 0.11.4→0.11.9, react-router 7.1→7.13 (CSRF, XSS, and open redirect fixes).

## [1.82.6] - 2026-02-05

### Changed
- **Team member tasks split into sections** - Tasks on a team member's Tasks tab are now organized into "Do Today" (due today or overdue), "Upcoming" (future due dates), and "Backlog" sections instead of a single flat list.

## [1.82.5] - 2026-02-05

### Fixed
- **Fitness tracking "Total Time" now displays correctly** - Previously showed "0h" for workouts under 30 minutes because `Math.round(minutes/60)` rounded down to zero. Now shows "14m" for sub-hour durations and "1h 30m" for longer workouts. Also fixed the by-type breakdown which used `Math.round` instead of `Math.floor`, causing 90 minutes to display as "2h 30m" instead of "1h 30m".

## [1.82.4] - 2026-02-05

### Fixed
- **Health monitor now detects CalDAV sync issues** - Previously the health check only verified CalDAV server connectivity (HTTP OPTIONS), so it showed "healthy" even when sync was silently skipping tasks. Now tracks sync statistics (synced, skipped, linked, deleted counts) and alerts when all tasks are skipped or the skip ratio is unusually high.
- **Always-on debug log for troubleshooting** - Added a dedicated `debug.log` file that always captures DEBUG-level messages (5 MB rotation, 7-day retention), regardless of the app's configured log level. Helps diagnose intermittent issues without needing to enable debug mode first.

## [1.82.3] - 2026-02-05

### Fixed
- **Duplicate task reminder emails eliminated** - Task alert emails (e.g., "Feed Animals - now due") were being sent twice, 5 minutes apart. Root cause: SQLAlchemy does not detect in-place mutations on JSON columns. The `alerts_sent` dict was modified but the ORM never wrote the change to the database, so the next scheduler run didn't see the alert as already sent. Fixed by creating a new dict object and using `flag_modified()` to ensure the change is persisted.

## [1.82.2] - 2026-02-05

### Fixed
- **Sale receipt email now sends correctly** - Fixed issue where selling a plant with "Send receipt" checked would fail silently. Root cause: the frontend was sending a `null` JSON body to the receipt endpoint, which could cause a 422 validation error before the endpoint even ran. Also moved email service initialization inside error handling so configuration issues are properly caught and reported. Fixed for all receipt/invoice endpoints (sale receipts, order receipts, payment receipts, invoices).

## [1.82.1] - 2026-02-05

### Added
- **Create tasks directly from team member pages** - New "New Task" button on the Tasks tab of each team member. Opens the full task form with the member pre-assigned. Supports all task fields: priority, recurrence, alerts, entity links, and more.

## [1.82.0] - 2026-02-05

### Changed
- **Mobile layout improvements across multiple pages:**
  - **Monthly Budget**: Improved grid layout so edit/delete icons no longer overlap with amounts on narrow screens. Amount column uses auto-width with proper overflow containment.
  - **Team Page**: Restructured header into two rows on mobile - team name + actions on top, scrollable tab navigation below. Previously all elements competed for one line causing overlap and unusability.
  - **Team Member Form**: Section tabs now show icons-only on mobile with hidden scrollbar for cleaner look.
  - **Calendar**: Defaults to day view on mobile (< 640px). Header buttons use icons-only on small screens. Day view time column is narrower on mobile. Week view min-width reduced from 800px to 640px for less horizontal scrolling. Navigation bar more compact.

## [1.81.7] - 2026-02-05

### Fixed
- **All dates now display as MM/DD/YYYY** - Fixed 5 places where dates were shown in raw ISO format (YYYY-MM-DD) or inconsistent formats: animal expense dates, worker task due dates, bank statement import dates (mobile + desktop), and garden succession planting dates.

## [1.81.6] - 2026-02-05

### Fixed
- **Phone-linked tasks now sync with RRULEs** - Tasks that were linked to existing phone calendar events (e.g., "Dane - Mobility") were being skipped during sync, so they never received RRULE updates. Removed the overly-broad skip that treated all non-app UIDs as phone-imported. Hash-based change detection now handles all tasks correctly.
- **CalDAV sync detects hash algorithm changes** - When new fields are added to the sync hash (like recurrence data), all tasks are now re-evaluated instead of being skipped by a stale `updated_at` filter. This ensures code-level changes to the sync format are picked up automatically.

## [1.81.5] - 2026-02-05

### Fixed
- **Recurring events now show on all dates in iPhone calendar** - Recurring tasks (daily, weekly, custom weekly, etc.) were synced to CalDAV as one-off events at their start date only. Now includes proper RRULE so the iPhone calendar shows them on every recurring date. Exception dates (edited single occurrences) are also synced as EXDATE.

## [1.81.4] - 2026-02-05

### Fixed
- **No more premature email alerts for timed events** - Events with a specific time (e.g., "Dane makes dinner" at 5pm) were receiving generic "upcoming task" emails hours before they were due. Timed events now only send alerts based on their explicit reminder settings. All-day tasks (no time set) still get the daily upcoming reminder.

## [1.81.3] - 2026-02-05

### Fixed
- **Recurring event "all occurrences" edit now saves date changes** - When editing a projected recurring event and changing the start date (e.g., moving to today), the original date was always being restored, ignoring the user's change. Now only preserves the original date when the user didn't modify it.
- **Calendar event data now includes all fields** - Projected recurring events on the dashboard were missing assignment fields (assigned members, worker, user), entity links (animal, plant, vehicle, equipment, farm area), recurrence interval, reminder alerts, backlog status, and visibility. This caused the event modal to initialize with blank/default values, losing data on save.

## [1.81.2] - 2026-02-05

### Fixed
- **Test alert emails now work** - All test email buttons (Daily Digest, Gear Alerts, Training Alerts, Medical Alerts, Team Alerts Digest) were failing with an AttributeError because the code referenced `display_name` on TeamMember, which doesn't exist (the correct field is `name`). Fixed in both test endpoints and scheduled alert jobs.
- **SMTP error messages now show actual cause** - Test email failures previously showed generic "Email service not properly configured" even when the real issue was a connection timeout. Now shows the actual error (e.g., "Cannot connect to SMTP server").
- **SMTP timeout increased to 60s** - Increased from 30s to handle slower SMTP connections (Protonmail).
- **AI budget insights now use correct pay periods** - Budget analysis was dividing budget amounts by 4 (weekly), but the budget system uses bi-weekly pay periods (1st-14th, 15th-end). Budget vs actual comparisons now correctly use per-period amounts and show remaining balance per category for the current pay period.
- **AI fitness insights now include readiness data** - Fitness context now includes overall readiness status, readiness scores, performance readiness, medical readiness, and fitness tier for all active team members. Previously only showed weight and subjective inputs.

## [1.81.0] - 2026-02-05

### Fixed
- **CalDAV sync no longer deletes recurring tasks** - When recurring tasks were completed and regenerated for the next occurrence, CalDAV sync was incorrectly detecting them as "deleted on phone" and marking them inactive. This caused tasks like "Take out trash" to disappear from the calendar. Calendar sync metadata is now properly cleared when recycling recurring tasks.
- **Recurring tasks auto-recovered** - Any recurring tasks that were incorrectly deactivated by the CalDAV bug are automatically reactivated on next startup.
- **No more midnight email alerts** - Task reminder emails now only send during waking hours (6 AM - 10 PM) instead of every hour including midnight.
- **Worker task emails now go to workers only** - Email alerts for worker-assigned tasks are now sent only to the worker's email address (if on file), not to the global email recipients. If no worker email is configured, the alert is skipped entirely.
- **All recurrence types now properly generate** - Added support for biweekly, custom weekly (specific days), quarterly, bi-annually, and custom interval recurring tasks in the task generator. Previously only daily, weekly, monthly, and annual were handled.

## [1.80.9] - 2026-02-04

### Fixed
- **AI morning briefing no longer includes worker tasks** - Tasks assigned to workers are now excluded from the AI morning briefing context. They belong on the Worker Tasks page and shouldn't clutter your personal briefing.

## [1.80.8] - 2026-02-04

### Fixed
- **Duplicate email reminders eliminated** - The reminder alert scheduler was sending the same alert twice due to an overlapping time window. The window now strictly only fires before or at the alert time, not after. This prevents the same "now due" alert from being sent by consecutive scheduler runs.

## [1.80.7] - 2026-02-04

### Fixed
- **Auto-completed events no longer show as "completed today"** - When past events are auto-completed, they now retain their original date rather than being timestamped with the current time. This prevents old events from cluttering the "completed today" section.
- **Dashboard now respects exception dates for recurring tasks** - When you edit a single occurrence of a recurring event, the original date is now properly hidden from the dashboard. Previously, edited occurrences would still show on the original day.
- **Default reminder alerts changed to none** - New events no longer have any email alerts by default. You must explicitly add alerts when creating events.

## [1.80.6] - 2026-02-04

### Fixed
- **Editing "All Occurrences" of recurring events no longer deletes past occurrences** - When editing a projected occurrence of a recurring event and selecting "All occurrences", the series start date is now preserved. Previously, editing a future occurrence would move the entire series forward, making past occurrences disappear.
- **Rescheduling single occurrences now works correctly** - When editing "This occurrence only" and changing the date to reschedule, the one-off task is now created on the new date. Previously, it would stay on the original date, making rescheduling impossible.

## [1.80.5] - 2026-02-04

### Improved
- **Mobile layouts significantly improved** - Multiple pages now display properly on mobile devices:
  - **Animals page**: Card layout now stacks info vertically with full names visible, better touch targets
  - **Garden page**: Tabs show icons-only on mobile with proper horizontal scrolling
  - **Worker Tasks**: Buttons show icons-only on mobile to prevent cutoff
  - **Budget Bills/Income**: Tables convert to card layouts on mobile with all info visible and larger touch targets
  - All buttons and icons now meet 44px minimum touch target guidelines

## [1.80.4] - 2026-02-04

### Improved
- **AI Weekly Budget Review now includes actual spending data** - The AI budget insights now have access to your real transaction data including: spending by category vs budget (with over/under status), recent transactions from the past week, and total spending summaries. This enables the AI to give specific, actionable budget advice instead of asking for data.

## [1.80.3] - 2026-02-04

### Fixed
- **Events no longer show as "overdue" after they pass** - Calendar events (like appointments, dinners, activities) now auto-complete once their date passes. They won't clutter your overdue list or AI morning briefing. Events are time-bound by nature - once they pass, they're done.
- **AI morning briefing no longer includes past events** - The AI context now properly excludes events from the overdue tasks list, so your morning briefing focuses on actual incomplete tasks.

## [1.80.2] - 2026-02-04

### Fixed
- **Email reminders no longer fire at midnight for tasks without specific times** - Tasks with `due_time = "00:00"` (meaning "anytime today" rather than "at midnight") are now excluded from reminder alerts. These tasks appear in the daily digest instead. Also added protection against sending reminders for tasks whose due time has already passed.

## [1.80.1] - 2026-02-03

### Changed
- **Milestone categories now show visual gauges** - Each developmental category (Motor, Language, Social, Cognitive) now displays a color-coded gauge showing where the child falls on the spectrum from Behind → Monitor → On Track → Ahead. A white indicator dot shows the current position on each gauge. This provides at-a-glance visual feedback for developmental progress.

## [1.80.0] - 2026-02-03

### Added
- **Progressive Web App (PWA) support** - Isaac can now be installed on your iPhone home screen for a native app-like experience. Visit Isaac in Safari, tap the Share button, and select "Add to Home Screen". The app works offline for cached pages and has an improved mobile interface.
  - Custom app icon
  - Offline fallback page
  - Service worker for caching
  - iOS meta tags for proper home screen display

### Improved
- **Mobile-optimized Budget Settings** - Categories and Pots of Money now display in a stacked card layout on mobile with larger touch targets for edit/delete buttons. Information is no longer cut off on small screens.
- **Mobile-optimized Worker Tasks** - Action buttons now show icons only on mobile with larger touch targets (44px minimum as per Apple guidelines). Text labels appear on larger screens.
- **useIsMobile hook** - New React hook for mobile detection available to all components.

## [1.79.61] - 2026-02-03

### Fixed
- **AI insights sales data now works correctly** - Fixed a second column name mismatch in the AI context gathering code. Sales totals were always showing $0 because the code was looking for `total_amount` instead of the correct `total_price` column. Combined with the budget fix, AI insights should now display accurate financial data.

## [1.79.60] - 2026-02-03

### Fixed
- **Per-payment receipt buttons now work** - Fixed the receipt buttons next to individual payments in Orders. Click the receipt icon to send a receipt for that specific payment.
- **Receipt balance due is now editable** - When sending a receipt, you can now edit the balance due amount and it will be reflected in the email.

### Added
- **Optional receipt when adding payment** - When adding a payment to an order, there's now a checkbox to "Send receipt email after adding payment". If checked, a receipt for that payment will be automatically emailed to the customer.

## [1.79.59] - 2026-02-03

### Added
- **Separate daily email for team alerts** - New option in Email Notifications to receive a separate daily email specifically for team readiness alerts (gear/training/medical). Enable "Team Alerts Digest" in settings to receive this focused alert email. Unlike the main daily digest, this email ONLY sends when there are actual issues to report. Includes a "Test All Alerts" button to preview the combined alert format.

## [1.79.58] - 2026-02-03

### Changed
- **Milestones now show clear status instead of confusing percentages** - The developmental milestone category breakdown now shows status labels like "Ahead", "On Track", "Monitor", or "Behind" with achieved/total counts (e.g., "3/5 achieved") instead of percentage numbers. This makes it clearer how the child is developing in each area.

## [1.79.57] - 2026-02-03

### Added
- **Mark animal as slaughtered without archiving** - Livestock animals now have a "Mark Slaughtered" button that sets the animal's status to "slaughtered" while keeping it active. This lets you track animals that are at the butcher but not yet processed. A red "SLAUGHTERED" badge appears on the animal card. When ready to record production and archive, use "Complete Archive".

## [1.79.56] - 2026-02-03

### Changed
- **Health monitor now shows uptime as time** - The "Uptime" stat now displays actual time since the last issue (e.g., "3d 12h", "5h", "30m") instead of a fraction or percentage. If there have been no issues, it shows time since the first health check. This is the traditional meaning of "uptime" that users expect.

## [1.79.55] - 2026-02-03

### Fixed
- **Editing weight/height log now updates member's current values** - When you edit a weight or height measurement in the Growth tab, and it's the most recent entry, the member's displayed height/weight now updates correctly. Previously, edits would only update the log entry but not the member's current value, causing stale data to display.

## [1.79.54] - 2026-02-03

### Fixed
- **AI insights now correctly show budget category amounts** - Fixed a bug where budget categories always showed "$0 budgeted" in AI insights because the code was looking for the wrong column name. Budget amounts now display correctly in morning briefings and budget reviews.

## [1.79.53] - 2026-02-03

### Changed
- **Health monitor now shows healthy checks as fraction** - The "Last 24 Hours" section now displays "Healthy Checks: 5/5" instead of a confusing "Uptime: 100%" percentage. This makes it immediately clear how many health checks passed out of the total.

## [1.79.52] - 2026-02-03

### Added
- **Separate test buttons for team alerts** - The Email Notifications section now has individual test buttons for each alert type: Test Gear (orange), Test Training (purple), and Test Medical (red). This lets you test each alert category independently instead of only through the daily digest.

## [1.79.51] - 2026-02-03

### Fixed
- **Invoice/receipt email subject now uses exact user input** - Email subjects for customer invoices and receipts are now sent exactly as you enter them, without any automatic prefix. If you want "[Farm Name] Invoice", type it yourself; otherwise just "Invoice - Order #1" works.

## [1.79.50] - 2026-02-03

### Changed
- **Child milestones now show clear expectations status** - Replaced confusing percentage display with clear labels: "Exceeding Expectations" (green), "Meeting Expectations" (blue), "Below Expectations" (yellow), or "Needs Attention" (red). This makes it immediately clear how the child is developing relative to their age.

## [1.79.49] - 2026-02-03

### Added
- **Per-payment receipts** - Send receipts for individual payments on orders. Each payment in the order detail now has a receipt icon button to email a receipt for just that payment. Useful for customers who want confirmation of their deposit or partial payment.

### Fixed
- **Invoice/receipt email subject now uses farm name** - Invoice and receipt emails now include your farm name in the subject line (e.g., "[Smith Family Farm] Receipt - Order #123") instead of generic text. Farm name is pulled from Settings > Farm Settings.
- **Balance due customization now works correctly** - Fixed a bug where setting balance due to $0 in the invoice editor would be ignored and show the original balance. Custom amounts (including zero) are now respected.

## [1.79.48] - 2026-02-03

### Added
- **AI Insights debug endpoint** - New `/api/chat/insights/debug-context/` endpoint (admin only) to view exactly what context data the AI sees. Shows raw task, weather, animal, and garden data along with task counts. Use this to diagnose data issues with AI insights.
- **Enhanced insight logging** - Morning digest now logs what domains are being used and context sizes to help diagnose issues.

## [1.79.47] - 2026-02-03

### Fixed
- **Calendar sync health monitor improvements** - Fixed timezone mismatch that could cause incorrect "stale sync" warnings. Health monitor now shows more helpful messages: "Awaiting first sync" instead of critical error on startup, and displays specific error messages if sync fails (e.g., "Failed to connect to calendar").

## [1.79.46] - 2026-02-03

### Added
- **Test Daily Digest button** - New "Test Digest" button in Settings > Email Notifications to send a test daily digest email with team readiness alerts. Use this to verify gear, training, and medical alerts are working correctly.

## [1.79.45] - 2026-02-03

### Added
- **Dedicated Farm Settings section in Settings** - Farm name and payment instructions now have their own collapsible section (Settings > Farm Settings), always visible regardless of whether Team is enabled. This makes it easier to configure your farm identity for customer communications.

## [1.79.44] - 2026-02-03

### Added
- **AI restriction settings now visible in Settings UI** - New AI guardrail settings are now accessible in Settings > AI Assistant:
  - Read-only mode (prevents AI from taking actions)
  - Require confirmation for actions
  - Blocked topics (comma-separated list)
  - Max response tokens limit
  - Guardrails enabled toggle

## [1.79.43] - 2026-02-03

### Fixed
- **Calendar sync no longer resets task completion status** - Fixed a critical bug where editing any field of a task on your phone (title, time, location) would reset the completion status back to incomplete. Calendar sync now only marks tasks as complete (from phone), never resets them to incomplete.

## [1.79.42] - 2026-02-03

### Fixed
- **Weather alerts in AI insights now expire after 24 hours** - Stale weather alerts older than 24 hours are no longer included in AI morning briefings and insights, preventing outdated information.

## [1.79.41] - 2026-02-03

### Fixed
- **Multiple backend error fixes**:
  - Fixed "No recipient specified" email errors - Task reminders and animal schedule emails now properly get recipients from settings
  - Fixed auto-watering date comparison error - SQLite date strings are now properly converted to Python date objects
  - Fixed Animal schedule checks failing when columns don't exist - Wrapped legacy checks in try/except to handle gracefully

## [1.79.40] - 2026-02-03

### Changed
- **Health monitor no longer shows "Unknown" status** - All health checks now show either Healthy, Warning, or Critical. If status cannot be determined, it's treated as Critical (something is wrong). Disabled services like CalDAV now show as "Healthy (disabled)" instead of "Unknown".

## [1.79.39] - 2026-02-03

### Fixed
- **Custom invoice/receipt emails now work correctly**:
  - "From" header now displays farm name (instead of just the email address)
  - Custom message field is now rendered in receipt and invoice emails
  - Balance due can now be customized in order receipts (was already working in invoices)
  - Added optional `from_name` field to override the sender display name

## [1.79.38] - 2026-02-03

### Fixed
- **Calendar sync now runs immediately after startup** - Previously, the calendar sync health check showed "No sync data yet" for up to 10 minutes after each restart because it waited for the first scheduled sync. Now the first sync runs 30 seconds after startup, so health monitoring shows real data almost immediately.

## [1.79.37] - 2026-02-03

### Added
- **AI Task Creation** - The AI assistant can now create tasks and reminders for you. Enable "AI Can Create Tasks" in Settings > AI Assistant. When enabled:
  - Ask the AI to "create a reminder for X" or "add a task for Y"
  - AI will suggest the task with title, date, and time
  - Click "Create Task" to confirm and add it to your task list
  - Tasks are marked as AI-created for easy tracking

## [1.79.36] - 2026-02-03

### Added
- **AI Insights Management** - New section in Settings > AI Assistant for managing AI-generated insights. You can now:
  - View all insights (including dismissed)
  - Create manual insights with custom domain, title, content, and priority
  - Edit existing insight title and content
  - Delete insights permanently
  - Regenerate all insights on demand with one click
  - See insight priority, domain, read status, and creation date

## [1.79.35] - 2026-02-03

### Fixed
- **AI insights context gathering fully fixed** - Fixed remaining context errors: weather query column (timestamp→reading_time), garden date comparison (datetime vs date), fitness data source (switched from non-existent vital types to subjective inputs for energy/sleep), and budget income ordering column (source→name). All insight types now gather data correctly.

## [1.79.34] - 2026-02-03

### Fixed
- **AI insights now include weather data** - Fixed weather context gathering which was looking for wrong database column names (temp_f vs temp_outdoor, humidity vs humidity_outdoor, daily_rain vs rain_daily). Morning briefings now correctly include current temperature, humidity, wind speed, and daily rainfall.
- **Added "tasks" to AI shared domains** - Morning briefings now include task data (overdue, due today, upcoming) which was previously missing from the shared domains configuration.

## [1.79.33] - 2026-02-03

### Fixed
- **Milestone percentages now show age-appropriate progress** - Children's developmental milestone progress now calculates based on milestones expected by their current age, not total lifetime milestones. A 12-month-old who has achieved all 0-12 month milestones will now show 100% (instead of 20% of all milestones through age 5). This provides more meaningful feedback on developmental progress.

## [1.79.32] - 2026-02-03

### Added
- **Custom invoice and receipt editor** - When sending invoices or receipts from Farm Finances, a preview/edit form now appears allowing you to customize the email before sending. You can edit: recipient email, subject line, customer name, description, total/paid/balance amounts, add a custom message, and payment instructions (for invoices). This applies to order invoices, order receipts, and sale receipts.

## [1.79.31] - 2026-02-03

### Fixed
- **Activity Level indicator now shows classification instead of confidence** - The Activity Level indicator now correctly displays your activity classification (Sedentary/Low Activity/Moderate/Active/Very Active) instead of the misleading "(LOW)" data confidence indicator. For example, 6,664 steps/day now shows "Moderate" badge instead of "(LOW)".

## [1.79.30] - 2026-02-03

### Fixed
- **Height and weight decimal precision in growth tracking** - All measurements (current height, median height, weight, BMI) now consistently show one decimal place (e.g., "38.0 in", "25.5 lbs"). This fixes the inconsistency where current height showed as a whole number while median showed decimals.

## [1.79.29] - 2026-02-03

### Added
- **View Application Logs button in Health Monitoring** - Health monitoring section now has a "View Application Logs" button that scrolls to the Application Logs section and filters to show ERROR level logs. This helps quickly access raw backend logs when troubleshooting health issues.

## [1.79.28] - 2026-02-03

### Added
- **Growth charts now show gender indicator** - The growth chart header displays a badge (♂ Boys Chart / ♀ Girls Chart) showing which gender's CDC percentiles are being used. CDC growth charts have different percentiles for boys and girls, and now it's clear which data set is being applied.
- **Improved error message for missing gender** - If a child's profile is missing birth date or gender, the growth tab now shows a helpful message explaining that CDC growth charts require both and uses different percentiles for boys vs girls.

## [1.79.27] - 2026-02-03

### Fixed
- **Height in growth tracking now displays in inches only** - Changed all height displays in child growth tracking to show inches (e.g., "38 in") instead of feet-inches format (e.g., "3'2""). This applies to current height, median height, and weight/height history entries.

## [1.79.26] - 2026-02-03

### Fixed
- **Chat AI provider display now always reflects current setting** - Fixed issue where the chat header would sometimes show "Ollama" even when configured for Claude or OpenAI. Added cache-prevention headers and normalized provider detection to ensure the displayed provider always matches your configured AI provider in Settings.

## [1.79.25] - 2026-02-03

### Fixed
- **Budget colors now use theme tokens across all tabs** - Replaced hardcoded colors in all budget components (Bills Summary, Budget Overview, Settings, Transactions, Statement Import) with CSS variables for consistent theming. Income shows green, bills show red, spending shows amber, and distributions/transfers show blue.

## [1.79.24] - 2026-02-03

### Added
- **Send Invoice for orders** - Orders with a balance due now have a "Send Invoice" button (red file icon) that emails the customer an invoice requesting payment. The invoice shows order details, payment summary, and amount due. Configure payment instructions in Settings > Team (coming soon).

## [1.79.23] - 2026-02-03

### Fixed
- **Activity level now shows classification badge** - The Activity Level indicator in health data now shows the actual classification (Sedentary/Low/Moderate/Active/Very Active) next to the score, instead of the confusing "(LOW)" confidence indicator. The classification is based on your step count according to research-backed thresholds.

## [1.79.22] - 2026-02-03

### Fixed
- **Height display format consistency** - Median height in growth tracking now displays in feet-inches format (e.g., 3'2") to match the current height display
- **Tall children no longer flagged as concerning** - Height percentiles above 90th/97th no longer show "Monitor" or "Concern" status. Being tall is not a medical concern for children; only unusually short stature (low percentiles) is monitored

## [1.79.21] - 2026-02-03

### Fixed
- **Extended mobile responsiveness across all pages**
  - Monthly Budget: Account Overview section now scrollable with condensed headers on mobile
  - Animals: Processing modal date/time fields stack on mobile
  - Farm Finances: Order form quantity/unit/price fields stack on mobile
  - Member Dossier: Gear sizing wraps to 3 columns on mobile, workout type selector shows 2 columns, fitness standards stack vertically
  - Calendar pages: Month view now scrollable with single-letter day headers on mobile, smaller cell heights
  - Navigation menu: Grid shows 3 columns on small screens, 4 on larger

## [1.79.20] - 2026-02-03

### Fixed
- **Comprehensive mobile responsiveness improvements**
  - Budget Overview: Category summary table shows 2 columns on mobile (Category + Remaining)
  - Bills Summary: Responsive grids with hidden account column on mobile
  - Worker Tasks: Info bar stacks on mobile with smaller icons
  - Team page: Header title responsive size, narrower tab area
  - Member Dossier: Tabs show icons only on mobile with tooltips

## [1.79.19] - 2026-02-03

### Fixed
- **Milestone categories now show "Advanced" when achieving above-age milestones** - Each category (Physical, Cognitive, Language, Social) now correctly shows "Advanced" if the child has completed milestones from age groups above their current age, not just the overall status.

## [1.79.18] - 2026-02-03

### Fixed
- **BMI card now shows child's current BMI value** - The Growth tab now displays the calculated BMI (from weight and height) alongside the median for comparison.

## [1.79.17] - 2026-02-03

### Fixed
- **Mobile layout improvements** - Animals page cards now use 2-row layout showing key info clearly. Garden tabs show icons only on mobile. Worker Tasks buttons stack and show icons on small screens. Budget Settings pots section wraps properly.

## [1.79.16] - 2026-02-03

### Added
- **Team Readiness Alerts in Daily Digest** - The daily digest email now includes alerts for gear contents below minimum quantity, expiring/expired items, overdue training, and overdue medical appointments. A daily job also automatically updates gear content status to reflect EXPIRED or LOW states.

## [1.79.15] - 2026-02-03

### Added
- **Farm/Business Name setting visible in Settings** - Go to Settings > Team to set your farm or business name. This name is used in receipt emails sent to customers.

## [1.79.14] - 2026-02-03

### Fixed
- **Child milestone tracker now detects advanced development** - The milestone assessment now correctly identifies when a child is achieving milestones above their age level. A 2-year-old accomplishing 3-5 year old milestones will now show as "advanced" rather than "on track".

## [1.79.13] - 2026-02-03

### Fixed
- **Growth record edit/delete no longer causes white screen** - Fixed an issue where editing growth records would crash the page. The backend now includes height_inches in weight_history data, and edit/delete buttons are properly hidden for placeholder entries.

## [1.79.12] - 2026-02-03

### Fixed
- **Chat AI provider label now correctly shows configured provider** - The chat panel header now properly displays "Claude", "ChatGPT", or "Ollama" based on your ai_provider setting. Hover over the provider name to see the specific model being used. The label updates when you close and reopen the chat panel after changing settings.

## [1.79.11] - 2026-02-03

### Fixed
- **Health Monitoring colors now readable on both themes** - The Health Monitoring section in Settings now uses theme tokens instead of hardcoded dark-mode colors. Warning messages, status badges, check cards, and health history logs all use proper contrast colors that adapt to both light and dark themes. The "Why WARNING?" banner, Cal Sync warnings, and all status indicators are now clearly visible.

## [1.79.10] - 2026-02-03

### Changed
- **Budget colors now match app theme** - All hardcoded colors in the Monthly Budget have been replaced with theme tokens. Income headers, section backgrounds (Distributions, Spending, Bills), and positive/negative amount colors now adapt to the app's theme and provide consistent styling across the application.

## [1.79.9] - 2026-02-03

### Fixed
- **BMI median now shows without metric units** - The BMI percentile card in Growth tab now displays the median value as just a number (e.g., "Median: 17.2") without the confusing "kg/m²" units. Weight still shows "lbs" and Height still shows "in".

## [1.79.8] - 2026-02-03

### Fixed
- **Health indicator reference ranges and recommendations now readable** - In Team > Health Data > ALL INDICATORS expanded cards, the REFERENCE RANGES and RECOMMENDATION sections now use color-coded backgrounds with proper contrast (white text on darker backgrounds instead of faint colored text). Green, amber, and red status colors are clearly visible.

## [1.79.7] - 2026-02-03

### Fixed
- **Health monitor colors improved for readability** - The health checks section in Settings now uses higher contrast colors that are easier to read. Warning status uses amber colors with darker backgrounds and white/black text for better visibility.

## [1.79.6] - 2026-02-03

### Fixed
- **BMI median no longer shown** - The BMI percentile card in Growth tab no longer shows the median value in kg/m². Median is only shown for Weight (lbs) and Height (inches) where imperial units are more useful.

## [1.79.5] - 2026-02-03

### Fixed
- **Available to Spend now matches spending cards** - The "Available to Spend" row in each person's budget section now uses the same backend-calculated value as the spending cards (Dane Spending / Kelly Spending), ensuring they always match.

## [1.79.4] - 2026-02-03

### Fixed
- **Health indicators now expanded by default** - Detailed indicator cards in the Show Details area are now expanded by default instead of collapsed. Click to collapse if needed.
- **Indicator names no longer truncated** - PHYSICAL BREAKDOWN card names now display fully instead of being cut off.

## [1.79.3] - 2026-02-03

### Added
- **AI Restrictions & Guardrails** - New settings to control AI behavior:
  - **Read-Only Mode**: AI can only answer questions, cannot modify any data
  - **Require Confirmation**: AI must ask for confirmation before any data changes
  - **Blocked Topics**: Comma-separated list of topics the AI will refuse to discuss
  - **Max Response Tokens**: Limit response length
  - **Guardrails Enabled**: Master toggle for safety guardrails
- **Knowledge Base is always read-only** - The RAG knowledge base uses PRAGMA query_only for database-level read protection

## [1.79.2] - 2026-02-03

### Added
- **Developmental Assessment for children** - Milestones section now shows comprehensive developmental assessment:
  - Overall status (Advanced, On Track, Monitor, Needs Attention) with explanation
  - Category breakdown showing Motor, Language, Social, and Cognitive progress individually
  - Age-level comparison to help gauge if child is ahead, on-track, or behind
  - Visual progress bars for each developmental category

## [1.79.1] - 2026-02-03

### Added
- **Size Guide for children** - New "Size Guide" section in the Growth tab shows recommended diaper, clothing, and shoe sizes based on current weight/height/age. Progress bars show when it's time to size up. Sizes are based on typical US standards.

## [1.79.0] - 2026-02-03

### Added
- **Edit and delete growth records** - You can now edit or delete height/weight entries in the Growth tab. Hover over an entry to see edit/delete buttons.
- **Add height-only or weight-only entries** - Weight is no longer required when logging growth. You can add just a height measurement, just a weight, or both.

## [1.78.9] - 2026-02-03

### Added
- **Receipt upload during animal expense creation** - You can now upload or paste a receipt image/PDF when adding a new animal expense (not just after the fact). Upload and Paste buttons appear in the Add Expense form.

## [1.78.8] - 2026-02-03

### Fixed
- **Per-person budget inline totals now clearly visible** - Bill totals and remaining now displayed in a separate highlighted row after each half's bills, making them obvious instead of blending with the Add Line button.

## [1.78.7] - 2026-02-03

### Changed
- **Health indicators restructured** - PHYSICAL BREAKDOWN section now shows compact cards with just score and progress bar. Detailed info (readings, reference ranges, factors, recommendations) moved inside "Show Details" area with expandable cards. Keeps the quick glance minimal, detailed info available on expand.

## [1.78.6] - 2026-02-03

### Fixed
- **Health monitor now explains why status is warning/unknown** - Added "Why WARNING?" banner showing exactly which checks are causing issues with their messages. Includes unknown status checks (like "No sync data yet" for Cal Sync).
- **Unknown status checks now visible** - Health check cards with unknown status (e.g., Cal Sync when not configured) now have a border and show their message to explain why.
- **Cal Sync duration now displayed** - Calendar sync performance shows duration in seconds in the status card.

### Changed
- Renamed "Recent Health Logs" to "Health Check History" with subtitle clarifying these are periodic health snapshots (not application logs).

## [1.78.5] - 2026-02-03

### Fixed
- **Chat now shows correct AI provider name** - Chatbot header now properly displays "Claude", "ChatGPT", or "Ollama" based on the configured provider instead of always defaulting to "Ollama".

## [1.78.4] - 2026-02-02

### Fixed
- **Budget per-person totals now correct** - Each half (1st-14th and 15th-End) now shows its own bill total and remaining independently. Monthly Remaining is the sum of both halves' remaining (not affected by rollover). Available to Spend is current half remaining + rollover - spending.

## [1.78.3] - 2026-02-02

### Changed
- **Health indicators now expandable with detailed sections** - Each health indicator card is now clickable to expand and reveal detailed sections: Your Readings (actual measured values), Reference Ranges (normal ranges for comparison), Contributing Factors, and Recommendations. Collapsed view still shows score badge, progress bar, and summary explanation.

## [1.78.2] - 2026-02-02

### Fixed
- **Mobile pages no longer broken** - Fixed vertical single-character text on all mobile pages caused by family motto being crushed in narrow flex containers. Motto now hidden on mobile screens.
- **All page headers responsive** - 8 pages updated to use mobile-first flex layout (stacks vertically on phones, horizontal on tablets+): Plants, Vehicles, Farm Finances, Seeds, Farm Areas, Equipment, Production, Worker Tasks

## [1.78.1] - 2026-02-02

### Fixed
- **Growth chart now shows child's data** - Child's data point appears from profile weight/height even before logging entries
- **Growth chart uses imperial units** - Weight in lbs, height in inches (was showing metric kg/cm)
- **Child's line clearly visible** - Bright purple line with large dots, percentile reference lines faded to 50% opacity
- **Chart legend is readable** - Simple colored dots/lines with clear labels

### Added
- **Bulk milestone selection** - "Mark All Done" and "Clear All" buttons on each milestone age group
- **Upcoming milestone groups shown** - Children ahead of schedule can check off future milestones (labeled "Upcoming")

### Changed
- Developmental milestones collapsed by default (click to expand)

## [1.78.0] - 2026-02-02

### Added
- **Children's Growth & Development Tracking** - Children under 13 now see a dedicated "Growth" tab instead of adult Health Data:
  - Growth percentile charts with CDC reference bands (3rd, 10th, 25th, 50th, 75th, 90th, 97th percentiles)
  - Weight-for-age, height-for-age, and BMI-for-age charts with child's data plotted against CDC curves
  - Current percentile summary cards with color-coded status (on track, monitor, concern)
  - Growth velocity tracking — detects if child is maintaining or crossing percentile bands
  - Developmental milestone checklists for children under 6 (motor, language, social, cognitive)
  - Milestone progress tracking with age-grouped checkboxes based on CDC "Learn the Signs" guidelines
  - Weight/height logging shows percentile immediately after entry
  - Adults (13+) continue to see the existing Health Data tab unchanged

## [1.77.3] - 2026-02-02

### Fixed
- **Health monitor now shows WHY there's a warning** - Added warning reason banner at the top of health status (e.g., "Calendar sync stale (305m ago) — scheduler may need restart"). Previously showed WARNING badge with no explanation.
- **Calendar Sync now tracked in health checks** - Added "Cal Sync" to the health monitoring grid so stale/slow calendar syncs are visible. Previously the check ran but was invisible in the UI.
- **Health log entries are now readable** - Fixed poor contrast in expanded health log rows. Switched from colored backgrounds (unreadable) to dark backgrounds with clear text and left-border status indicators.

## [1.77.2] - 2026-02-02

### Fixed
- **AI provider selection is now a dropdown** - Changed from text input to select dropdown with Ollama/Claude/OpenAI options, fixing issue where provider-specific fields (API keys, model) wouldn't appear after changing provider
- **Observations now properly clear after AAR completion** - Fixed stale observations from completed AARs still appearing in the current week. Added startup migration to auto-mark observations as discussed when their AAR has been completed
- **Decryption warnings resolved** - Cleared corrupted encrypted settings on prod that were encrypted with an old key, eliminating recurring decryption failure warnings in logs

## [1.77.1] - 2026-02-02

### Fixed
- **Budget transactions table no longer clips on desktop** - Widened Category column (120px→140px) and Account column (90px→110px) so dropdown text and action buttons don't overflow the right edge. Added overflow handling to prevent cell content from escaping grid boundaries.

## [1.77.0] - 2026-02-02

### Added
- **Steps and stairs now affect health & fitness scores** - New "Activity Level" indicator in physical breakdown uses research-backed thresholds to score daily activity:
  - Step count scoring: Sedentary (<2k), Low (2-4k), Moderate (4-7k), Active (7-10k), Very Active (10k+)
  - Stair climbing bonus: 5+ flights/day linked to ~20% lower CVD risk
  - Workout frequency bonus on top of daily movement
  - Shows avg steps/day, stairs/day, weekly totals, and evidence-based recommendations
  - Activity level contributes 15% to overall readiness score (Lancet, JACC, ESC research)
- **Dev tracker now shows full fail note history** in `dev-tracker.sh show` output

### Changed
- Readiness score weights rebalanced: Autonomic 35%, Illness 25%, Cardiovascular 25%, Activity 15%

## [1.76.6] - 2026-02-02

### Changed
- **Health data indicators now show detailed information** - Each physical breakdown indicator (Autonomic Recovery, Cardiovascular, Immune Health) now includes:
  - Actual vital values with units (e.g., "RHR: 62 bpm", "BP: 128/82 mmHg", "SpO2: 98%")
  - Normal ranges for reference (e.g., "Normal SpO2: 95-100%")
  - Personalized baseline comparisons (e.g., "HRV baseline: 45 ms")
  - Actionable recommendations based on score (e.g., "Recovery is suppressed. Prioritize sleep...")
  - Status-specific explanations instead of generic category descriptions

## [1.76.5] - 2026-02-02

### Changed
- **Health monitor warnings are now more informative** - Warning and critical messages include actionable guidance (e.g., "Memory at 85% — consider restarting services to free memory" instead of just "Memory high: 85%"). Warning text in the UI is now larger and more prominent. Collapsed health log entries show the actual warning messages inline.

## [1.76.4] - 2026-02-02

### Fixed
- **Desktop overlapping elements** - Fixed z-index hierarchy so floating action button (z-60), chat panel (z-55), and modals (z-50) no longer overlap each other. Fixed dashboard height to properly fill available viewport space instead of using incorrect hardcoded offset.

## [1.76.3] - 2026-02-02

### Fixed
- **Decryption and calendar sync warnings no longer repeat every 10 minutes** - Both the decryption failure warning and "calendar sync not configured" warning now only log once per process lifecycle instead of every scheduler cycle. Actionable messages guide the user to re-enter the value in Settings.

## [1.76.2] - 2026-02-02

### Fixed
- **Observations now clear after AAR completion** - Completing an AAR marks all undiscussed observations from the AAR's week and earlier as discussed, not just exact week matches. Previously, observations from prior weeks would persist in the active view.

## [1.76.1] - 2026-02-02

### Changed
- **Steps and stairs now affect training load** - Daily step count and stairs climbed are no longer just observational metrics. They now contribute to the Acute:Chronic Workload Ratio (ACWR) calculation
  - 10,000 steps = ~30 load points, each flight of stairs = 5 load points
  - Shown in training load notes as "Ambulatory load included"
  - High step counts combined with workouts can push ACWR into moderate/high zones

## [1.76.0] - 2026-02-02

### Added
- **Knowledge Base RAG system** - AI chat can now search your ingested document library (PDFs, EPUBs, text files) for relevant reference material using SQLite FTS5 with BM25 ranking
  - Ingestion script: `scripts/ingest_knowledge.py` extracts text, chunks, and indexes documents
  - Supports dedup mode (`--dedup`) and auto-cleanup (`--dedup-clean`)
  - Enable in Settings under AI Assistant section (Knowledge Base Enabled)
  - Categories auto-detected from directory structure (medical, building, bushcraft, etc.)
  - Results injected as context alongside domain-specific farm data
- **Knowledge Base status endpoint** - `/chat/knowledge-base/status/` shows DB stats and availability

## [1.75.2] - 2026-02-02

### Fixed
- **Health monitor email alerts now send correctly** - Fixed `send_health_alert` passing invalid `is_alert` parameter to email service, replaced with proper `subject_prefix`
- **Health check warnings now include details** - Log messages show which specific checks failed and why, instead of just "warning"
- **Application logs readable in dark theme** - Replaced hardcoded light-theme colors with dark-compatible styling matching the Health Logs section

## [1.75.1] - 2026-02-02

### Fixed
- **Fixed duplicate calendar events from recurring entries** - CalDAV sync was expanding recurring events (e.g., weekly "Lazy Monday") into individual one-off tasks. Now skips expanded occurrences and preserves the original recurring event
- **Deleted 13 duplicate Lazy Monday entries** from production database

## [1.75.0] - 2026-02-02

### Fixed
- **Auto-watering no longer runs every 5 minutes** - Decoupled from weather polling, now runs every 30 minutes on its own schedule. Reduces unnecessary database queries and CPU usage
- **Reduced log noise** - Watering interval calculations moved from INFO to DEBUG level. Decryption warnings now only log once per session instead of every 5 minutes. Calendar sync "not configured" warning demoted to debug level
- **Auto-watering uses loguru** - Switched from stdlib logging to loguru for consistency with rest of codebase

## [1.74.3] - 2026-02-02

### Fixed
- **Security audit fixes** - Full-scope security review with actionable fixes applied
  - Fixed 3 Customer Feedback `/my/*` endpoints to properly reject unauthenticated requests
  - Fixed raw SQL strings in translation service to use proper `text()` wrapper

## [1.74.2] - 2026-02-02

### Changed
- **Comprehensive logging revamp** - Added structured logging across 15 backend files for better diagnostics and troubleshooting
  - Routers: weather, supply requests, home maintenance, equipment, vehicles, farm areas, workers, dashboard
  - Services: audit, calendar sync, encryption, fitness standards, permissions, planting calculator, watering calculator
  - All CRUD operations log create/update/delete with relevant context (IDs, names, changed fields)
  - All error handlers log the actual error before returning generic messages to clients
  - Warning-level logs for missing data, fallback values, and edge cases
  - Dashboard bare `except:` clauses converted to proper `except Exception as e:` with logging

## [1.74.1] - 2026-02-02

### Fixed
- **AI chat hides when AI is disabled** - Disabling the AI assistant in Settings now properly hides the chat button and panel from the floating action menu
- **Feature Toggles consolidated** - All feature toggles now live in the dedicated Feature Toggles section in Settings. Removed duplicates from the Display section
- **Budget page toggle** - Added missing toggle for the Budget page. All navigation pages now have on/off toggles
- **Added missing toggles** - On-Screen Keyboard, Hard Refresh Button, and Feedback Button toggles added to Feature Toggles section

## [1.74.0] - 2026-02-02

### Added
- **Steps & stairs tracking** - Track daily step count and flights of stairs climbed in the Daily Check-in form. New "Activity" section appears between Vitals and Body Measurements. Data viewable in the Health Data tab alongside other vitals

### Fixed
- **ACWR inflated with limited training data** - ACWR was always dividing by 4 weeks even with only 1 week of data, causing artificially high ratios (e.g., 4.0x). Now uses actual weeks of data available (capped at 4) for accurate ratios

## [1.73.0] - 2026-02-02

### Changed
- **Multi-provider AI assistant** - Choose between Ollama (self-hosted, free), Claude (Anthropic), or ChatGPT (OpenAI) in Settings. Set "AI Provider" to switch, then configure the relevant URL/API key. Supports streaming, conversation history, and scheduled insights on all providers
- **AI privacy controls** - New "AI Shared Domains" setting lets you choose exactly which data categories (garden, fitness, budget, production, animals, weather, tasks) the AI can access. Empty by default — no personal data leaves your Pi unless you opt in
  - Chat still works with no domains enabled, but won't reference personal data
  - Scheduled insights (morning digest, weekly reviews) only generate for enabled domains
  - Settings page shows only the relevant fields for your chosen provider

## [1.72.0] - 2026-02-01

### Added
- **Specific days recurrence** - Tasks, events, and reminders can now repeat on specific days of the week (e.g., Mon/Wed/Fri or Tue/Thu). Select "Specific Days" in the recurrence dropdown, then tap the day buttons to toggle. Works in EventModal, ToDo page, and Team member task editor. Calendar and dashboard correctly project these tasks on the selected days

## [1.71.1] - 2026-02-01

### Fixed
- **Task completion no longer redirects to profile tab** - Completing tasks on a team member's Tasks tab now stays on the correct tab instead of resetting to the Profile tab
- **AAR action item tasks no longer disappear after completion** - AAR-linked tasks (auto:aar) are no longer incorrectly deactivated when completed. Only recurring auto-reminders (plant care, vehicle/equipment maintenance, etc.) are deactivated on completion
- **Chatbot health check more reliable** - Increased Ollama health check timeout and added automatic retry on failure to reduce false "not running" status on slower connections

## [1.71.0] - 2026-02-01

### Added
- **AAR action items create tasks** - When you save action items in the Weekly AAR, they automatically create tasks assigned to the specified team member. Due date defaults to end of the following week. Editing action items updates the linked task, removing them deactivates the task, and toggling completion syncs between AAR and tasks.

## [1.70.6] - 2026-02-01

### Added
- **Edit/delete observations** - Edit or delete observations from both the individual member Observations tab and the Weekly AAR page. Hover over any observation to see edit/delete icons. Inline editing with save/cancel, delete with confirmation prompt

## [1.70.5] - 2026-02-01

### Fixed
- **Weekly AAR observations now display correctly** - Fixed timezone bug where observations added on Sunday evening (EST) were assigned to next week's AAR instead of the current week. Backend now uses app timezone setting instead of UTC for week calculations
- **AAR persists until marked complete** - AAR no longer auto-advances to next week. It stays on the current week until "Mark Complete" is clicked, then archives and starts fresh for the next week
- **Fixed 6 misassigned observations** - Corrected existing observations that were placed in the wrong week due to the UTC timezone bug

## [1.70.4] - 2026-02-01

### Added
- **Per-period bill frequency** - When adding or editing bills in Monthly Budget, choose "Each Half" (appears in both pay periods) or "Monthly" (specific day of month). Makes it easy to add recurring expenses like "Sarah Massage $110 every half month"
- **Bill totals inline per half** - Each half of a person's budget now shows the bill total and half total inline, instead of only at the bottom

### Changed
- **Mobile responsive overhaul** - Improved mobile layout across all pages: Dashboard, Budget, Plants, Animals, Settings, Team, ToDo, Calendar, DevTracker, Home Maintenance, and FloatingActionMenu
- **Pie chart shows budget allocation** - When no spending has been recorded, the Actual Summary donut chart now shows budget allocation breakdown instead of a blank state

### Fixed
- **Bill editing now works correctly** - Fixed per-period bills (no bill_day) showing wrong field in edit modal. Edit modal now shows correct amount field based on frequency type
- **Error display in edit modal** - Save errors are now shown to the user instead of being silently swallowed

## [1.70.3] - 2026-02-01

### Added
- **Pots of Money management** - New "Pots of Money" tab in Budget Settings for managing spending pots (Gas, Groceries, etc.) and funds (Savings, Travel, etc.) with a simplified, user-friendly interface
- **Add/edit/delete pots** - Create custom pots like Emergency Fund or Home Repairs directly from the Pots tab

### Changed
- **Transaction defaults** - New transactions now default to Money Market account. Category dropdown only shows pots of money (spending + funds), not fixed bills

### Fixed
- **Main rollover skips setup month** - The first month of budget tracking is treated as a setup month and does not contribute to the Roll Over balance. Rollover accumulates starting from month 2 of tracking.
- **Rollover can show deficits** - Removed the floor that capped rollover at $0. If you overspent in prior months, the Roll Over now correctly shows as negative (in red).
- **Month-pinned starting balance for person spending** - Starting balance is now tied to a specific month via `start_date`. Viewing months before the start date shows rollover as $0 (no historical data).

## [1.70.0] - 2026-02-01

### Added
- **Isaac AI Chat Assistant** - Chat with a self-hosted Ollama LLM about your homestead. Isaac understands your garden, animals, budget, fitness, production, weather, and tasks with real-time data context injection.
- **Streaming responses** - AI responses stream in real-time via Server-Sent Events
- **Conversation management** - Create, view, and delete chat conversations with persistent history
- **Topic auto-detection** - Isaac automatically detects what you're asking about and injects relevant data context
- **AI Insights tab** - View and manage proactive AI-generated insights organized by domain
- **Chat accessible from menu** - Isaac AI chat button is in the three-dot/hamburger menu for quick access on mobile and desktop

### Changed
- **Chat button moved to menu** - Removed standalone floating chat button; now accessible from the three-dot (desktop) and hamburger (mobile) menus

## [1.69.4] - 2026-02-01

### Changed
- **Period-aware available calculation** - Available to Spend now reflects only the half-periods in the viewed date range. Viewing 1st half shows rollover + 1st half net - 1st half spending. Full month shows both halves combined.
- **Cumulative 2nd half totals** - Monthly Budget 2nd half "Total" now shows the cumulative amount (1st half remaining + 2nd half remaining), matching Excel spreadsheet format
- **Full month available in Monthly Budget** - Bottom "Available to Spend" combines rollover + full monthly net - all month spending for an accurate overall balance

## [1.69.3] - 2026-02-01

### Changed
- **Person spending now shows Excel-style breakdown** - Each half shows Deposit, Bills, and Total (remaining after bills). Bottom shows Monthly Remaining, Rollover from prior months, Spending (transactions), and Available to Spend
- **Starting balance support for spending accounts** - Transfer categories now have a `starting_balance` field to seed rollover from external tracking (e.g., Excel). Set via category settings.
- **Separated rollover from monthly margin** - Backend now calculates rollover (prior months' net minus prior spending) separately from this month's deposits minus bills

## [1.69.2] - 2026-02-01

### Changed
- **Person spending shows "Available to Spend"** - Dane/Kelly spending sections now show clear breakdown: Deposit, Bills, Spending (transactions), Net This Half, and a prominent "Available to Spend" total that includes rollover from prior periods
- **Spending cards show transaction activity** - Overview and Monthly Budget cards now show how much was spent this period below the available balance
- **API returns spending breakdown** - Person spending balances now include total deposits, committed bills, total spent, and per-period spending for full transparency

## [1.69.1] - 2026-02-01

### Fixed
- **Transaction archival now only touches previous half-period** - Archive job explicitly protects the current half-period's transactions and only snapshots/cleans up completed periods
- **Transactions tab defaults to current half** - Budget transactions view now filters to the current half-period by default with toggle for This Half / This Month / All

## [1.69.0] - 2026-02-01

### Added
- **Transaction archival system** - Transactions are now tagged with a `period_key` (e.g., 2026-02-1 for 1st half) for easy grouping
- **Automatic period snapshots** - End-of-period spending summaries are saved before transactions age out, preserving trend data
- **3-month transaction retention** - Transactions older than 3 months are automatically cleaned up on the 1st and 15th of each month
- **Spending trends endpoint** - New `/api/budget/trends/` endpoint returns per-category spending across recent half-periods for trend analysis
- **Period snapshots endpoint** - New `/api/budget/snapshots/` endpoint returns archived period summaries

## [1.68.3] - 2026-02-01

### Fixed
- **Person spending balance now uses budgeted bills** - Spending account balances correctly deduct budgeted bill amounts per half-period instead of relying on actual transactions. Balances now accurately reflect: deposits minus committed bills minus discretionary spending.

## [1.68.2] - 2026-02-01

### Added
- **Dane/Kelly spending rollover** - Spending account balances now accumulate across half-periods instead of resetting each half. Leftover funds roll forward until spent.
- **Per-half budget breakdowns** - Each person's budget section shows deposit, bills, and remaining for each half (1st-14th and 15th-End)
- **Account Balance line** - Person budget sections now show the accumulated account balance with rollover at the bottom

## [1.68.1] - 2026-02-01

### Fixed
- **Budget rollover now carries across half-periods** - Surplus from Gas/Groceries/Main Spending in the 1st-14th now rolls over to the 15th-end view (previously only rolled over at month boundaries)

## [1.68.0] - 2026-01-31

### Added
- **AI Assistant (Isaac AI)** - Integrated self-hosted Ollama LLM as a smart homestead assistant
  - Chat with Isaac about garden, animals, fitness, budget, production, weather, and tasks
  - Real-time streaming responses via Server-Sent Events (SSE)
  - Context-aware conversations — Isaac automatically injects relevant data based on your question topic
  - Conversation history with persistence across sessions
  - Slide-out chat panel accessible from floating button on every page
  - Proactive AI insights: morning digest, weekly fitness/budget reviews, monthly garden review
  - Insights tab with priority indicators, read/dismiss actions, and unread badge
  - Settings for Ollama URL, model selection, and enable/disable toggles
  - Graceful degradation when Ollama is offline

## [1.67.4] - 2026-01-31

### Fixed
- **Daily check-in date format** - Date field now always displays MM/DD/YYYY instead of browser-dependent format

## [1.67.3] - 2026-01-30

### Fixed
- **Spending cards now subtract owned bills** - Dane/Kelly spending cards subtract budgeted bill amounts (Claude.AI, Klarna, etc.) instead of only actual transactions, showing true discretionary remaining

## [1.67.2] - 2026-01-30

### Fixed
- **Dashboard now requires authentication** - Previously accessible without login due to Optional auth dependency
- **Removed error detail leaks in admin endpoints** - Settings update/push/pull operations no longer return internal error messages to the client

## [1.67.1] - 2026-01-30

### Fixed
- **Security hardening** - Full security audit with fixes across backend and frontend
  - Fixed ReDoS vulnerability in bank statement parser (input length limit + recursion guard)
  - Fixed potential XSS via javascript: protocol in supply request product links
  - Added deepl_api_key to encrypted settings list
  - Removed internal error details from health monitor API responses
  - HTML-escaped admin display names in invitation email templates
  - Replaced ValueError str(e) leak in Chase statement import with generic message

## [1.67.0] - 2026-01-30

### Added
- **Child/toddler support for Team page** - Health and readiness features now adapt to member age
  - Age displayed next to member name in dossier header
  - Pediatric blood pressure ranges (AAP guidelines) replace adult ACC/AHA thresholds for children
  - Age-appropriate respiratory rate thresholds for toddlers, children, and teens
  - Body fat/lean mass cards hidden for members under 16 (Marine Corps taping method not validated for children)
  - Fitness, Training, and Mentoring tabs hidden for members under 13
  - Fitness tier badge hidden for children under 13
  - Backend readiness analysis passes age to all vital assessment functions
  - Pediatric and Well-Child appointment types already available in medical tab

## [1.66.3] - 2026-01-30

### Fixed
- **Receipt emails use farm name** - Customer receipt email subjects now show "[Farm Name]" instead of "[Isaac]"
  - Set your farm name in Settings > Farm Name to customize
  - Both order receipts and sale receipts use the configured farm name
  - Internal emails (daily digest, alerts) still use "[Isaac]" prefix

### Added
- **Send receipt for direct sales** - Receipt icon button now appears on sales that have a customer email in Farm Finances
  - Customer name shown on sales cards when available
  - Works alongside the existing order receipt system

## [1.66.2] - 2026-01-30

### Fixed
- **Worker task reorder arrows now work** - Up/down arrows properly reorder tasks with immediate visual feedback
  - Tasks are sorted by sort_order after optimistic UI updates
  - Completed tasks stay at the bottom of each section
- **Backlog always expanded** - Worker backlog section now starts expanded by default instead of collapsed

## [1.66.1] - 2026-01-30

### Added
- **Phone number auto-formatting** - All phone input fields now auto-format as (XXX)XXX-XXXX while typing
  - Team member phone and emergency contact phone
  - Worker phone
  - Customer phone (Farm Finances)
  - Medical provider phone
  - Existing phone numbers displayed in formatted form everywhere in the app

## [1.66.0] - 2026-01-30

### Added
- **Plant sale receipts & removal** - Sell Plant modal now supports customer name/email, receipt emailing, and plant removal
  - Optional customer name and email fields on the sell form
  - "Send receipt to customer email" checkbox emails an HTML receipt on sale
  - "Remove plant from my list after sale" checkbox deletes the plant after recording the sale
  - Sale total shown in the form before submitting
  - Backend: new POST /production/sales/{id}/send-receipt/ endpoint
  - Backend: Sale model now stores customer_name and customer_email for direct sales

## [1.65.8] - 2026-01-30

### Fixed
- **Receipt upload during expense creation** - Receipt upload/paste buttons now appear when adding a new farm expense, not just when editing
  - Select or paste a receipt image/PDF while creating the expense
  - Receipt auto-uploads when the expense is saved
  - Selected file shown with name and remove button before saving
  - Editing existing expenses still supports immediate upload/paste/delete as before

## [1.65.7] - 2026-01-30

### Fixed
- **Monthly Budget cards show current half** - Summary cards (Income, Bills, Gas, Groceries, etc.) now show data for the current half of the month instead of the full month
  - Cards display budgeted vs actual for just the current pay period (1st-14th or 15th-End)
  - Label above cards indicates which half is shown
  - Full-month totals still shown in the Monthly Summary section at the bottom
  - Gas, Groceries, Spending, and person remaining amounts are now half-month accurate

## [1.65.6] - 2026-01-30

### Fixed
- **Health monitor expandable logs** - Health log entries are now clickable to expand and see all individual checks
  - Each expanded entry shows all 6 checks (API, Database, CalDAV, Memory, Disk, CPU) with status, values, and messages
  - Issues highlighted with colored backgrounds for quick identification
  - Collapsed entries show issue count badge for non-healthy entries
  - Fixed CSS border coloring bug on warning/critical check cards in Current Status

## [1.65.5] - 2026-01-30

### Fixed
- **Monthly Budget half-month duplication** - Items added in one half no longer replicate to the other half
  - Distributions, spending, and transfers now respect bill_day to show only in the correct half
  - Day field shown for all item types so users can control which half an item appears in
  - Items without a day (per-period) still show in both halves as expected
  - Monthly totals, Account Overview, and person section calculations updated accordingly
  - New items auto-assigned to the half they're added from

## [1.65.4] - 2026-01-30

### Fixed
- **Readiness indicator details** - Physical breakdown indicators now show contributing factors
  - Each indicator (Immune Status, Autonomic Recovery, Cardiovascular) shows up to 3 contributing factors
  - Color-coded scores (green/yellow/red) for quick visual assessment
  - Indicators have background cards for better visual separation
  - Immune Status correctly labeled (not "Illness Risk") with explanation that 100=healthy

## [1.65.3] - 2026-01-30

### Fixed
- **Fitness score bar clarity** - Added overall score progress bar with tier boundary markers to the main fitness card
  - Bar shows score position relative to CIV (40), MAR (70), and SF (90) thresholds
  - Added explanation that overall score = average of best per workout type
  - Per-type breakdown header clarified to show each type is scored independently
  - Prevents confusion when one workout type score is higher than overall tier

## [1.65.2] - 2026-01-30

### Fixed
- **Readiness assessment explanations** - Overhauled training load and risk flag explanations
  - ACWR no longer flags HIGH risk when building a baseline (no chronic data yet)
  - Training load section now explains what ACWR means, shows "This Week" vs "4-Wk Avg" labels
  - Risk flags include full context: what the ratio means, why it matters, what to do
  - Recommendations are now specific and actionable (not just "consider reduced intensity")
  - Primary drivers explain the reasoning, not just numbers
  - Added load point formula explanation (duration x effort, ruck weight multiplier)
  - Fixed API key mismatch between backend (risk_level) and frontend (risk)

## [1.65.1] - 2026-01-30

### Fixed
- **Case normalization** - All categorical string fields are now normalized to lowercase on input and existing data
  - Prevents bugs from mixed-case values (e.g., "Watered" vs "watered") breaking queries
  - Affected fields: plant care type, growth stage, animal care type, animal status, home maintenance category, budget owner
  - Existing database values auto-normalized on startup
  - Pydantic validators ensure consistent lowercase storage going forward

## [1.65.0] - 2026-01-30

### Fixed
- **Full mobile responsiveness overhaul** - All pages and modals now work properly on mobile devices
  - **Modals**: All modals use responsive max-width (95vw on mobile, standard max-width on desktop)
  - **Grid layouts**: All grids start at 1 column on mobile, expand to 2+ on larger screens
  - **Padding**: Modal and section padding reduced on mobile (p-4 vs p-6)
  - **Tables**: Wide tables wrapped in horizontal scroll containers
  - **Pages fixed**: ToDo, Calendar, Settings, Animals, Vehicles, Equipment, Garden, Plants, Seeds, HomeMaintenance, FarmAreas, FarmFinances, Production, Team, Dashboard
  - **Components fixed**: EventModal, EventViewModal, MemberDossier, MemberForm, DailyCheckinModal, QuickAddVital, QuickAddWorkout, TeamOverview, MemberGearTab, MemberTrainingTab, MemberObservationsTab, TeamGearTab
  - Header layouts collapse properly on small screens
  - Button text hidden on mobile (icons remain visible)

## [1.64.0] - 2026-01-30

### Added
- **Budget edit modal** - Every budget item (income, bills, spending, transfers) now has a pencil icon that opens a full edit modal
  - Edit all fields at once: name, amount, bill day, account, billing schedule, start/end dates, owner, type
  - Billing schedule supports presets (monthly, quarterly, seasonal) and custom month picker
  - Start/end date fields for payment plans
  - Frequency selector for income (weekly, bi-weekly, semi-monthly, monthly)
  - Works in both Bills tab and Monthly Budget tab

### Fixed
- **Dane/Kelly spending cards** - Cards now correctly subtract their owned bills and transactions from their deposit amount
  - Previously only tracked transactions tagged directly to the transfer category
  - Now sums spending across all bills and categories owned by each person
- **Weekly income display** - Monthly Budget now shows frequency label (weekly, bi-weekly) next to income items
- **Semimonthly income display** - Bills tab now shows correct monthly total for semimonthly income (amount × 2)

## [1.63.0] - 2026-01-30

### Fixed
- **Task assignee display** - Assignee names now show on tasks in ToDo, Calendar, Dashboard, and Team member tasks
  - Added `assigned_member_names` and `assigned_member_ids` to all task API responses
  - Today's schedule, calendar view, and overdue tasks now include assignment data
  - Team member tasks endpoint includes all fields needed for the edit form
- **Budget ticker styling** - Ticker now shows green when budget is good and bold text for visibility

### Added
- **Bills tab separation** - Bills tab now shows 4 distinct sections: Income, Bills (fixed), Spending Budgets (variable), and Distributions (transfers)
  - Each section has its own add form with relevant fields
  - Recurrence labels (monthly, quarterly, seasonal, yearly, payment plan)
  - Editable account, billing months, and end date fields
- **Transaction account picker** - Transactions can now be assigned to any budget account
  - Account dropdown in add/edit form
  - Account column in transaction list
  - Category dropdown now grouped by type (Spending, Transfers, Bills)
- **Person budget sections** - Dane and Kelly sections in Monthly Budget now show positive deposits from transfers
  - Shows deposit lines, bills, and net remaining per person
  - Person bills excluded from main budget total (funded by transfer deposits)

### Fixed
- **Income/Bills cards consistency** - Overview and Monthly Budget tabs now show matching Income and Bills values
  - Fixed semimonthly income calculation in backend (was only counting one pay period)
  - Overview Bills card now excludes person-owned bills (funded by transfers)
  - Overview spending cards now find transfer-type categories (Dane/Kelly Spending)
- **Dane/Kelly Spending as transfers** - Converted from variable to transfer type so they properly show as distributions from the main budget into spending accounts

## [1.62.0] - 2026-01-30

### Added
- **Roll Over auto-calculation** - Roll Over category now dynamically calculates unspent budget from the previous month's variable spending categories
  - Automatically shows leftover amounts from Gas, Groceries, Main Spending, etc.
  - Splits evenly across both half-month periods
  - Zero rollover if nothing was left unspent
- **Budget permissions for kiosk** - Budget & Finance now appears in the role permissions settings so it can be enabled for kiosk users
  - Budget tickers on dashboard require `budget:view` permission

## [1.61.0] - 2026-01-30

### Added
- **Dynamic Monthly Budget add form** - Add any type of line item: Bill, Income, Spending, Transfer, or Payment Plan
  - Type selector with contextual fields (day, frequency, end date, account)
  - Each section's + button pre-selects the appropriate type
  - Account dropdown populated from budget accounts
- **Payment plan support** - Bills with end dates that auto-expire when the plan is complete
  - `start_date` and `end_date` fields on budget categories (YYYY-MM format)
  - Categories auto-hide from budget when outside their active date range
- **Account Overview section** - Shows per-account money flow in Monthly Budget
  - Money In, Money Out, and Net columns for each account
  - Automatically calculates flows from income, transfers, bills, and spending
- **Income delete** - Trash icon on income line items in Monthly Budget
- **Chase Trust account** - Added as budget account
- **Ambulance & Upper Endo** - Added as payment plan bills

### Changed
- **Budget Overview chart** - Constrained bar chart to 600px max width, fixed label overlap with -45 degree rotation and increased bottom padding
- **Period summary filtering** - Backend now correctly filters categories by billing_months, start_date/end_date, and bill_day for half-month periods
- **Account display** - Categories with `account_id` set show the correct account name instead of guessing from owner

### Fixed
- **Overview cards vs Monthly Budget mismatch** - Period summary now skips categories not active in current month/period
- **Per-period bill amounts in overview** - Per-period FIXED bills use budget_amount instead of monthly_budget in half-period views

## [1.60.0] - 2026-01-30

### Added
- **Non-monthly billing support** - Bills can now have a `billing_months` field (e.g., "9" for yearly September, "1,4,7,10" for quarterly)
  - Bills only appear and count in the budget during their active months
  - Frequency badge shown in Bills tab (yearly, quarterly)
  - Prime set to September only, Trash Busters quarterly, Pegasus Pest quarterly

### Changed
- **Per-period bills** (Maid, Massage) now correctly appear in BOTH halves of Monthly Budget
- **Pay updated to weekly** - $2,171.58 weekly instead of semimonthly

### Fixed
- **Monthly Budget totals** - Per-period bills now show per-half amount instead of full monthly in each half

## [1.59.0] - 2026-01-30

### Changed
- **Bills tab** - Added date (day of month) column for all income and bill lines, sorted by date
  - Day is editable inline (click to change), shown as ordinal (1st, 2nd, 15th, etc.)
  - Add form now includes a Day field
- **Income sources** - Set up correct pay structure: Pay on 1st ($3,711.85), Pay on 15th ($3,696.86), Disability on 1st ($1,968.28)
- **Bill dates populated** - All recurring bills now have their due dates set from Excel data (e.g., Mortgage on 15th, Car Insurance on 2nd, Starlink on 9th, etc.)
- **Bill ownership** - Dane's bills (US Mobile, BK, Klarna, Cloaked, Greyman, Claude.AI, Protonmail) and Kelly's bills (Massage) tagged with owner for proper Dane/Kelly breakout sections

## [1.58.0] - 2026-01-30

### Changed
- **Bi-Budget Overview** - Cards now show Income, Bills, and per-category remaining (Gas, Groceries, Main Spending, Dane Spending, Kelly Spending)
- **Monthly Budget rewrite** - Side-by-side layout for 1st half and 2nd half of month, Dane/Kelly spending side by side below
  - Every line is click-to-edit (name and amount), add/remove lines via "Add Line" button
  - Cards match Bi-Budget: Income, Bills, per-category remaining, plus Surplus/Overage
  - Monthly Summary with Total Money In, Bills, Spending, Savings, Total Outgoing, Surplus/Overage
- **Bills tab** - Full add/edit/delete support for both income and bill lines
  - Click any name or amount to edit inline, trash icon to delete, plus icon to add new lines
  - Separate Income and Bills & Expenses sections with summary totals
- **Transactions tab simplified** - Streamlined to Date, Description, Amount, and Category (Gas, Groceries, Main Spending, Dane's Spending, Kelly's Spending only)
- **Bottom padding** - Added padding to all budget tabs so the three-dot menu button doesn't block content

### Fixed
- **Charts cut off** - Donut and bar charts in Bi-Budget now use overflow-visible and proper viewBox sizing
- **Budgeted card showing incorrect total** - Broken down by meaningful per-category remaining instead of total sum

### Added
- **Bill day tracking** - Budget categories now have a `bill_day` field for which day of month the bill is due
- **Category owner** - Budget categories can be tagged as 'dane' or 'kelly' for personal bill breakouts

## [1.57.0] - 2026-01-30

### Added
- **Monthly Budget tab** - Excel-style budget layout with both pay periods (1st-14th, 15th-End) showing Variable Spending, Bills & Fixed Expenses, and Savings & Transfers sections with budget/spent/remaining columns
- **Money Market Distribution** - Monthly Budget now shows how income is distributed from Money Market to Dane's Spending, Kelly's Spending, Main Checking, Savings, and House/Travel Fund
- **Chase credit card accounts** - Added Chase Credit Card 1 and Chase Credit Card 2 as budget accounts for statement imports
- **Bills Summary tab** - Dedicated view for tracking monthly bills with paid/partial/due status indicators
- **Income frequency support** - Budget income now supports weekly, biweekly, semimonthly, and monthly pay frequencies with proper pay period calculations
- **Inline budget editing** - Click any budget amount in Monthly Budget or Bills tab to edit it inline
- **Quick add transactions** - Hover over a category row to reveal a "+" button for adding transactions inline
- **Mark bills as paid** - Click "Due" status on a bill to instantly mark it as paid with the full amount

### Fixed
- **Budget data not loading** - Fixed database enum value casing that prevented SQLAlchemy from reading budget categories, transactions, and accounts
- **Fixed bill budgets showing $0** - Half-month period summaries now correctly show monthly_budget for fixed bills instead of $0

## [1.56.0] - 2026-01-30

### Added
- **Budget & Finance tracking** - New Budget tab in Farm Finances with full personal budget management
  - Bank account tracking (checking, savings, credit, cash)
  - Budget categories with per-pay-period and monthly amounts
  - Bi-weekly pay period views (1st-14th, 15th-end) and full month view
  - Manual transaction entry with auto-categorization
  - Chase PDF statement import with duplicate detection
  - Auto-categorization rules (contains, starts with, regex)
  - Recurring income source definitions
  - Budget vs actual progress bars and spending pie chart
  - Dashboard widget showing current pay period spending summary
  - Farm expense auto-creates budget transaction for cross-tracking

## [1.55.0] - 2026-01-30

### Added
- **Calendar event view modal** - Clicking a calendar event now opens a read-only detail view showing title, date/time, description, location, category, priority, recurrence, and assigned members. Use the Edit button to switch to the edit form, or Complete/Delete directly from the view
- **Fitness task category** - Added "Fitness" as a category option for events and reminders
- **APT correction stretching events** - Added 4 weekly recurring mobility events (Mon/Tue/Thu/Sun 6:00-6:15am) with full 15-minute APT correction stretching routine

### Fixed
- **Fitness score bar markers misaligned** - The CIV/MAR/SF tier markers below fitness progress bars were evenly spaced instead of positioned at their correct percentage locations (40%, 70%, 90%). This caused the bar to appear to reach Marine level when the score was still in Civilian range

## [1.54.0] - 2026-01-30

### Added
- **Worker task backlog** - Each worker now has a separate backlog section for tasks not currently active. Move tasks between active and backlog using the Archive/Inbox buttons
- **Worker task reordering** - Use up/down arrow buttons to manually reorder tasks within active or backlog lists. Order persists across sessions

## [1.53.1] - 2026-01-30

### Fixed
- **Daily checkin sliders replaced with segmented pickers** - Replaced hard-to-use range sliders with tappable numbered button pickers for energy, sleep quality, soreness, pain, and stress inputs
- **Daily checkin date timezone fix** - Date now uses local timezone instead of UTC, preventing wrong date when checking in after 7pm ET
- **Readiness illness risk messaging** - Renamed "Illness Risk" to "Immune Status" so high scores (98 = healthy) no longer sound like "98% risk of getting sick." Added human-readable status labels and explanatory text
- **Readiness confidence display** - Fixed confidence level showing "NaN%" by displaying the correct LOW/MEDIUM/HIGH text

## [1.53.0] - 2026-01-30

### Security
- **Authentication enforced on all API endpoints** - Added authentication requirements to ~149 previously unprotected endpoints across 11 router files
  - production.py: 45 endpoints secured with role-based permissions (view/create/edit/delete)
  - animals.py: 19 GET endpoints secured with require_view
  - tasks.py: 13 endpoints secured with role-based permissions
  - plants.py: 12 endpoints secured with role-based permissions
  - equipment.py: 7 endpoints secured
  - vehicles.py: 7 endpoints secured
  - farm_areas.py: 6 endpoints secured
  - home_maintenance.py: 6 endpoints secured
  - seeds.py: 5 endpoints secured
  - team.py: 2 photo-serving endpoints secured
  - garden.py: 1 photo-serving endpoint secured

## [1.52.2] - 2026-01-30

### Fixed
- **Rain forecast time accuracy** - Rain "In Xhr" now uses actual NWS period start times instead of array index, fixing inaccurate hour calculations when forecast periods don't align with current time

## [1.52.1] - 2026-01-29

### Fixed
- **Health monitor more informative** - Each health check now shows its status message (e.g., "Memory high: 82%", "CalDAV returned status 503") instead of just an icon. Warning/critical checks are highlighted with colored borders. Health logs now show which specific checks caused the issue with detailed messages

## [1.52.0] - 2026-01-29

### Added
- **Receipt upload for expenses** - Attach receipt images or PDFs to any farm or animal expense. Upload from file or paste from clipboard. Receipts display as thumbnails (images) or PDF icons in expense lists and modals
  - Supported formats: JPEG, PNG, GIF, WebP, PDF
  - Receipt indicator badge shown on expenses with attachments - click to view in new tab
  - Available on both Farm Finances and Animal expense views

## [1.51.1] - 2026-01-29

### Fixed
- **Mobile layout overhaul** - Fixed navigation, grids, modals, and tables across all pages for proper mobile display
  - Mobile nav menu now matches desktop sidebar routes (Garden instead of separate Plants/Seeds, includes Team)
  - Dashboard now scrolls properly on mobile instead of cutting off content
  - All detail grids stack to single column on small phones (320px), 2 columns at 640px+
  - All modals narrower on mobile to prevent overflow
  - Settings permissions table compact on mobile with smaller text and checkboxes
  - Added bottom safe area support for notched devices (iPhone home indicator)

## [1.51.0] - 2026-01-29

### Added
- **Succession planting** - Schedule repeated plantings at regular intervals. Set interval (weeks) and number of plantings to auto-generate a series of connected planting events with preview dates
- **Timeline view** - Horizontal Gantt-style chart showing all crop schedules across the year. Toggle between Calendar and Timeline views in the Planner tab. Frost dates shown as vertical marker lines
- **Garden journal** - Photo-linked journal entries for tracking garden observations, progress, and notes. Filter by plant, seed, date range, or tags. Full CRUD with photo upload support
- **Companion planting guide** - Searchable database of 40 common garden plants with companion and antagonist relationships. Green indicators for beneficial pairings, red for plants to keep apart, with explanatory notes
- **Garden bed layout designer** - Create and manage garden beds (raised bed, in-ground, container, row, greenhouse). Visual grid layout showing plant placement with click-to-plant functionality
- **Bed planting management** - Place seeds/plants in specific grid positions within garden beds. Shows companion planting compatibility when adding plants near each other

## [1.50.0] - 2026-01-29

### Added
- **Garden planting calendar** - Auto-generated 12-month planting calendar based on seed data, frost dates, and USDA zone. Shows when to start indoors, direct sow, transplant, and harvest for each seed variety
- **Frost date configuration** - Configurable last frost and first frost dates (defaults to Zone 9b Oxford FL). Calendar and overview automatically adjust planting recommendations
- **Garden overview dashboard** - New default landing tab showing this month's planting activities, plants needing attention (water/fertilizer/frost), quick stats with growing season progress bar, active plant lifecycle tracking, and recent care activity
- **Planting events** - Create, edit, complete, and delete custom planting events on the calendar. Events overlay on the auto-generated schedule with distinct styling
- **Seed-to-plant lifecycle** - "Plant This Seed" button on seed cards creates a linked plant with growth_stage tracking. Plants show their source seed and lifecycle dates
- **Growth stage tracking** - Plants now track lifecycle stages (seed, seedling, transplanted, vegetative, flowering, fruiting, harvesting, dormant) with color-coded badges, interactive progress bar, and quick stage advance dropdown
- **Lifecycle dates** - Automatic date stamping when plants transition to seed (date_sown), seedling (date_germinated), and transplanted (date_transplanted) stages

## [1.49.0] - 2026-01-29

### Added
- **Garden page** - Merged Plants and Seeds into a single "Garden" page with tab navigation. One nav icon, switch between Plants and Seeds with tabs at the top. Old `/plants` and `/seeds` URLs redirect to `/garden`
- **Sell plants/trees** - New "Sell" button on plant cards to record sales of whole plants or trees (not just produce). Records to the Production/Sales system with plant linkage

### Fixed
- **Harvest button** - The Harvest button on plant cards now opens the proper harvest recording form instead of just logging a quick care event
- **Plant photos too large** - Expanded plant/seed photos now display properly with contained sizing instead of being cropped

## [1.48.4] - 2026-01-29

### Fixed
- **Plant photos now import during PictureThis import** - Photos are downloaded when creating a plant via the import flow (previously only worked via the direct import endpoint)

### Added
- **Paste photos from clipboard** - Plants and seeds now have a "Paste" button alongside "Upload Photo" to paste images directly from clipboard

## [1.48.3] - 2026-01-29

### Fixed
- **Plant photo import fix** - Fixed PictureThis image URL extraction (mainImage.imageUrl instead of mainImageUrl) so photos now import correctly during plant import and enrichment
- **Plant data enrichment** - Re-ran enrichment on all 67 active plants in production with expanded field coverage
  - Water schedules: 14% -> 90% filled
  - Fertilize schedules: 11% -> 60% filled
  - Prune frequency: 14% -> 90% filled
  - Photos: 0% -> 87% filled (58 plants now have photos)
  - Added backup/dry-run/single-plant modes to enrichment script for safety

## [1.48.2] - 2026-01-29

### Changed
- **Clarified zone field labels** - Renamed "Grow Zones" to "Hardiness Zones (species)" and "Plant Zone" to "This Plant's Zone (override)" to make the difference clear. Hardiness Zones is the species' natural range (informational), while Plant Zone overrides the global zone for watering calculations

## [1.48.1] - 2026-01-29

### Fixed
- **PictureThis import missing care schedules** - Import now extracts watering schedules, fertilizing schedules, pruning frequency/techniques, and harvest frequency/details from PictureThis care pages
  - Watering frequency labels (e.g., "Every 2-3 days") now generate seasonal water_schedule values
  - Fertilizing frequency labels now generate seasonal fertilize_schedule values
  - Pruning techniques and descriptions now populate prune_frequency field
  - Harvest frequency and how-to-harvest instructions now populate their respective fields
  - All care details also appended to cultivation_details for reference

## [1.48.0] - 2026-01-29

### Added
- **Plant & seed photo support** - Upload, view, and delete photos for plants and seeds
  - Thumbnail shown next to plant/seed name in card list view
  - Full-size photo displayed in expanded detail view
  - Upload via dashed drop area in edit mode, delete with hover overlay button
  - Photos auto-imported from PictureThis during plant import
  - Imported photo preview shown in import modal before confirming

## [1.47.0] - 2026-01-29

### Added
- **Plant import search** - Replaced external PFAF search link with an integrated search powered by PictureThis database. Type a plant name and get instant results with thumbnails, common names, and latin names. Click a result to auto-fill the import URL
- **PictureThis shown as import source** - Import modal now lists PictureThis as the primary import source alongside PFAF, Gardenia, and Growables

## [1.46.1] - 2026-01-29

### Fixed
- **Daily digest missing high temperature** - When digest runs early morning and NWS forecast starts with a nighttime period, the high temp was showing as "--". Now checks the first two forecast entries to find both high and low for today

## [1.46.0] - 2026-01-29

### Added
- **PictureThis.ai plant import** - New import source at picturethisai.com, extracting 16-18 fields per plant including description, growing zones, sun/moisture requirements, soil composition & pH, temperature tolerance, frost sensitivity, propagation methods, pruning time, harvest season, toxicity warnings, and uses
  - Supports all URL patterns: /wiki/, /care/, /care/propagate/, /care/pruning/
  - Combines data from both wiki page and care page for maximum field coverage
  - Proper JavaScript string unescaping for embedded JSON data extraction
  - Metric-to-imperial conversion for all height/spread/temperature values

## [1.45.5] - 2026-01-29

### Fixed
- **Growables.org plant import** - Completely rewrote scraper to extract 15+ fields (was ~5-7); now captures description, uses, cultivation details, harvesting, propagation, spacing, drought/salt tolerance, pest/disease notes, and more
  - Fixed multi-line value extraction (walks all sibling nodes instead of just next_sibling)
  - Added 30+ label pattern matchers organized by category
  - Fixed drought tolerance detection ("cannot tolerate" now correctly sets drought_tolerant=false)
  - Cleaned up figure reference artifacts from extracted text
  - Fixed plant import endpoint field name mismatch (cultivation vs cultivation_details)
  - Added missing fields to import: drought_tolerant, salt_tolerant, plant_spacing, produces_months, how_to_harvest

## [1.45.4] - 2026-01-29

### Fixed
- **Security: SVG upload XSS risk** - Removed SVG from dev tracker allowed image types; added SVG sanitization for team logo uploads (strips scripts, event handlers, javascript: URLs); all image serve endpoints now include `Content-Security-Policy: script-src 'none'` header

### Added
- **Security: API rate limiting** - All endpoints now rate-limited to 200 requests/min and 60 write requests/min per IP; returns HTTP 429 with Retry-After header when exceeded; auth endpoints excluded (handled by existing account lockout)

## [1.45.3] - 2026-01-29

### Fixed
- **CalDAV sync re-deactivating tasks** - When sync marks a task as "deleted on phone", it now clears sync metadata (calendar_uid and calendar_synced_at) so re-activated tasks won't be falsely deactivated again on the next sync cycle
- **Date format consistency** - Fixed 3 instances of unformatted toLocaleString() in MemberDossier and Settings pages to use MM/DD/YYYY format

### Added
- **Care schedule calendar projection** - Animal care tasks (e.g., "Feed Animals") now appear on future calendar dates in both month and week views, projected from care schedule frequency settings

## [1.45.2] - 2026-01-29

### Fixed
- **Recurring events disappearing from calendar** - CalDAV sync was incorrectly deactivating newly created tasks that hadn't been pushed to the calendar yet; now only deactivates tasks that were previously synced and then removed from phone
- **CalDAV sync now marks individual task syncs** - Tasks synced individually (on create/update) now get `calendar_synced_at` set immediately, preventing false "deleted on phone" detection

## [1.45.1] - 2026-01-29

### Fixed
- **Security: Authentication added to unauthenticated routers** - Workers, Supply Requests, and Weather routers now require authentication on all endpoints
- **Security: Dashboard endpoints authenticated** - All dashboard endpoints (calendar, stats, cold protection, freeze warning, storage, verse) now require auth; clear-logs requires admin
- **Security: Settings endpoints authenticated** - All settings read endpoints require auth; write/reset/sync/test endpoints require admin
- **Security: CORS hardened** - Replaced wildcard origin with explicit allowed local origins
- **Security: CSP header added** - Content-Security-Policy header now set on all responses
- **Security: Exception details no longer leaked** - Internal error messages replaced with generic responses; details logged server-side only
- **Security: Session cookie name consistency** - Invitation acceptance now uses correct `session_token` cookie name
- **Security: Dynamic timezone** - Dashboard no longer hardcodes Eastern timezone; reads from app settings

## [1.45.0] - 2026-01-28

### Added
- **Recurring event single-occurrence edit/delete** - When editing or deleting a recurring event, a choice dialog now appears:
  - "This occurrence only" — affects just the selected date (creates exception + one-off task for edits)
  - "All occurrences" — affects the entire series (existing behavior)
  - Works in month, week, and day calendar views
  - DayDetailPanel delete button also supports the recurring choice

## [1.44.1] - 2026-01-28

### Added
- **Customer receipt emails** - Send order receipts directly to customers via email
  - Receipt button (receipt icon) on each order in the Business tab
  - Professional HTML receipt with order details, payment history, and balance
  - Requires customer to have an email address on file
  - Uses the "Farm Name" setting (configurable in Settings) for the receipt header
- **Farm Name setting** - New setting for farm/business name used in receipts and customer communications

## [1.44.0] - 2026-01-28

### Added
- **Per-plant USDA zone override** - Each plant can now have its own zone for watering calculations
  - New "Plant Zone" dropdown in plant forms and detail view
  - Select a zone (1a through 13b) or leave as "Use global zone" for the farm's default
  - Plants in different microclimates (greenhouse, shade structure) get zone-appropriate watering intervals
  - Smart watering decisions use per-plant zone when set, falling back to global setting

## [1.43.7] - 2026-01-28

### Fixed
- **Rain/Dry Days display improved for readability** - Rain days shown in cyan, dry days in amber with explicit labels
  - Format changed from "3 / 4" to "3 rain / 4 dry" with color-coded values
  - Period length now shown in the card subtitle
  - Daily rain chart tooltips now use MM/DD/YYYY date format

## [1.43.6] - 2026-01-28

### Fixed
- **Sprinkler plants now reliably marked as watered on schedule days**
  - Decoupled sprinkler watering check from weather station fetch — sprinklers now run even when weather data is unavailable
  - Fixed timezone handling to use app-configured timezone instead of system time for schedule evaluation

## [1.43.5] - 2026-01-28

### Fixed
- **Recurring events now display on all occurrences in calendar views** - Fixed both month and week views
  - Recurring tasks starting within the view range (not just before it) are now projected correctly
  - Tasks with future start dates no longer project backwards before their start date
  - Original due date no longer duplicated alongside projected occurrences

## [1.43.4] - 2026-01-28

### Fixed
- **Sprinkler plants no longer show as "needs water"** - Plants with sprinkler enabled are handled automatically and excluded from:
  - Water overview "Needs Water Now" list
  - "Needs Water Today" filter on Plants page
  - Needs-water stat counter on Plants page
  - Water droplet icon on individual plant cards
  - Auto-generated watering reminders/tasks

## [1.43.3] - 2026-01-28

### Changed
- **Order pricing redesigned** - Order Total is now the primary field instead of price per pound
  - Direct "Order Total ($)" input at the top of the form for setting flat prices
  - Weight and Price/lb moved to collapsible "optional details" section
  - Order list now shows the total price prominently
  - Backend already supported direct totals, this is a frontend-only change

## [1.43.2] - 2026-01-28

### Fixed
- **Recurring CalDAV events now sync correctly** - Daily, weekly, monthly, and yearly recurring events from Proton Calendar are recognized and displayed on every occurrence
  - Parses RRULE property from CalDAV events and maps to task recurrence fields
  - Existing synced events will update on next sync cycle
  - Supports DAILY, WEEKLY, BIWEEKLY, MONTHLY, and ANNUALLY frequencies

## [1.43.1] - 2026-01-28

### Fixed
- **Date formatting standardized to MM/DD/YYYY** across entire application
  - Fixed 25+ date-fns format() calls using inconsistent formats (MMM d, MMMM d, M/d/yy)
  - Fixed local formatDate functions in Plants and Member Tasks to use MM/DD/YYYY
  - Fixed default browser locale toLocaleDateString calls to specify explicit format
  - Updated email subjects, digest headers, alert timestamps, and task reminders to use MM/DD/YYYY
  - Updated CLAUDE.md with date formatting rules for future consistency

## [1.43.0] - 2026-01-28

### Added
- **Water Overview** on Plants page - collapsible dashboard showing comprehensive water status
  - Rain totals (daily, weekly, monthly) with daily rain bar chart
  - Soil moisture sensor readings
  - Smart watering tracking: rain-tracked plants, sprinkler coverage, scheduled plants
  - Watering activity: plants watered vs skipped with skip reason breakdown
  - "Needs Water Now" list showing overdue plants sorted by urgency
  - Configurable time period (7d, 14d, 30d)

## [1.42.2] - 2026-01-28

### Fixed
- **Readiness assessment data quality** - Fixed missing data points display for 7-day and 30-day readings
  - Taping method now correctly reports availability based on waist/neck/hip measurements
  - Missing vitals list now shows which key vital types have no data
- **Fitness score explanation** - Expanded score breakdown with full scoring details per workout type
  - Tap any workout type to expand detailed scoring inputs, thresholds, and grading scale
  - Shows pace/time targets for each tier (SF/Marine/Civilian) based on age and gender
  - Ruck: pack weight adjustments table with body weight context (% BW targets)
  - Strength: barbell lift BW ratio thresholds with actual weight targets, bodyweight exercise standards
  - Distance scaling info showing partial credit for shorter distances
  - HIIT/Combat: RPE formula breakdown with HR bonus and score cap
  - Full 9-tier grade scale reference in every expanded section

## [1.42.0] - 2026-01-28

### Added
- **Production page redesign** - Restructured from 5 tabs to 3 purpose-driven tabs: Overview, Business, Homestead
- **Farm Expenses** - New standalone expense tracking with 14 categories (Feed, Vet, Processing, Seeds, Equipment, Utilities, Fuel, Supplies, Labor, Insurance, Taxes, Fencing, Bedding, Other)
- **Expense scoping** - Expenses can be tagged as Business, Homestead, or Shared (with configurable business/homestead split percentage)
- **Monthly Trends** table in Overview tab showing revenue/expenses/net by month
- **Homestead Costs** card in Overview P&L summary
- **Expense Breakdown** by category in Overview tab
- **Collapsible sections** in Business and Homestead tabs for better organization
- **Recurring expense** tracking with monthly/quarterly/annually intervals

- **Fitness score explanation** in fitness tracker - detailed score breakdown with progress bars, tier markers, best vs average scores, recent scored workouts, and variance warnings (matches readiness assessment style)
- **Dev tracker image attachments** - upload or paste images on dev tracker items for visual bug reports and screenshots
  - Upload via file picker or paste from clipboard
  - Click thumbnails to view full-size in lightbox
  - Delete images individually; auto-cleaned when items are deleted

### Changed
- **Overview tab** now shows full P&L: Revenue, Expenses, Net Profit, Outstanding, and Homestead Costs
- **Business tab** consolidates Sales, Livestock Production, Orders & Payments, Customers, and Business Expenses
- **Homestead tab** consolidates Harvests, Homestead Expenses, and Personal Use Summary
- **Financial summary API** now includes standalone expenses in P&L calculations and monthly trends data

## [1.41.1] - 2026-01-28

### Added
- **Feature Toggles** section in Settings - toggle on/off any page from navigation (Calendar, Plants, Seeds, Animals, Home, Vehicles, Equipment, Farm Areas, Farm Finances, Workers, Team)
- **Fitness badge** next to team member names in tabs and roster (SF=yellow, MARINE=green, CIVILIAN=blue)
- **Dev tracker fail note history** - expandable log of all past fail notes with timestamps and attempt numbers
- **Send to backlog button** when creating new dev tracker items (purple Archive button)

### Fixed
- **Task editing from team member tab** now includes Location field and Link to entity selector (animal, plant, vehicle, equipment, farm area)
- **Multi-select Assign To** dropdown now works across all pages (calendar events, vehicles, equipment, farm areas, plants, animals)
- **Hip measurement** hidden for males in Latest Vitals display and check-in recording type dropdown
- **Workouts** default to Stats view instead of list view
- **Fitness tier data** (fitness_tier, fitness_sub_tier) now included in member API serialization

## [1.41.0] - 2026-01-28

### Changed
- **Fitness Scoring Overhaul** - Complete rewrite with real military and civilian standards:
  - **Run scoring** now uses official USMC PFT 3-mile run scoring function (time → PFT points → score)
  - **Ruck scoring** anchored to MARSOC A&S standards with 4-mile full credit distance
  - **Swim scoring** based on 300m continuous swim time standards
  - **Bike scoring** with population speed data and medium confidence flag for outdoor rides
  - **Row scoring** using 500m split time standards from RowingLevel.com
  - **Strength scoring** with BW ratio for barbell lifts (squat, deadlift, bench, OHP) plus PFT bodyweight exercises (pull-ups, push-ups, plank)
  - **HIIT/COMBAT** uses RPE × duration + HR bonus, capped at SF Good (96)
  - **PT_TEST** maps PFT/CFT scores (0-300) to our scale via class-based anchors
  - **MOBILITY** participation credit, capped at Civilian Excellent (69)
- **Sub-tier names** renamed to Passing/Good/Excellent across all tiers
- **9 explicit thresholds** per age bracket for granular scoring
- **Distance scaling** neutral point moved to 55 (was 70) — short efforts no longer inflate scores
- **Composite score** now uses best recent score per workout type category (recovery jogs don't drag down run score)
- **Badge label** changed from "READY" to "OVERALL" in member dossier header
- **Workout data** now passes score, avg/max heart rate, and test standard to fitness scoring

## [1.40.0] - 2026-01-28

### Added
- **Three-Tier Fitness Classification System** - Performance scores now classified as:
  - **CIVILIAN** (0-69) - Blue badge - General population fitness
  - **MARINE** (70-89) - Green badge - Military-grade fitness
  - **SF** (90-100) - Gold badge - Special Forces/Elite operator fitness
  - Age/gender-normalized using Marine Corps CFT-style brackets
  - Ruck weight body ratio adjustments (30%+ BW = +10 bonus)
- **Fitness Profile display** - New fitness tier badges in Stats view showing overall tier and breakdown by workout type
- **Evidence-Based Readiness Analysis** - Major refactor of readiness system:
  - **Medical Safety** as hard gate (RED = no-go regardless of performance)
  - **Dual baselines** - 7-day short-term + 35-day long-term trends
  - **Persistence-based fatigue detection** - Single bad day no longer triggers alerts
  - **Training Load Analysis** with ACWR (Acute:Chronic Workload Ratio)
  - **Confidence levels** now show HIGH/MEDIUM/LOW instead of percentage
- **Daily Check-in Feature** - Comprehensive form to log all health metrics at once:
  - Vitals section: RHR, HRV, BP, SpO2, Temperature, Respiratory Rate
  - Body measurements: Weight, Waist, Neck, Hip
  - Subjective inputs: Energy level, Sleep quality/hours, Soreness, Pain, Stress
  - Context factors: Alcohol, Poor sleep, High caffeine, Travel, Illness, etc.
- **Quick Add in Team page** - Health data options added to "+ Add" dropdown menu:
  - Daily Check-in, Log Workout, Log Vital, Log Weight
  - Member selector to log for any active team member
- **Subjective Inputs Model** - New data model to capture fatigue, pain, and context factors
- **Training Load Spike Detection** - Warns when ACWR > 1.5 (elevated injury risk)
- **Readiness & Fitness card** in Profile tab - Shows overall readiness, physical status, medical safety, and fitness tier
- **Health data retention** - Automatic cleanup of health data older than 2 years (runs daily at 4 AM)

### Changed
- **Readiness display updated** - Now shows:
  - Medical Safety status with hard gate indicator
  - Training Load panel with ACWR, acute/chronic loads, and spike warnings
  - Better confidence display with color-coded HIGH/MEDIUM/LOW badges
  - Data quality note explaining analysis confidence
- **BP categories** now follow ACC/AHA guidelines (crisis = >180/120)
- **Hip measurement** now only shows for female members in Daily Check-in form
- **Body fat auto-calculation** no longer creates duplicate entries when value unchanged

### Fixed
- **Context factors** now properly read from individual vital logs (not just function parameters)
  - BP Stage 1 readings with explainable factors (caffeine, stress, etc.) won't trigger AMBER status

## [1.39.1] - 2026-01-28

### Added
- **Calendar sync monitoring** - Health monitor now tracks sync duration
  - Alerts if sync takes >60s (warning) or >90s (critical)
  - Alerts if sync hasn't run in >15 minutes
  - Logs warning when sync is slow

## [1.39.0] - 2026-01-28

### Fixed
- **Calendar sync performance** - Fixed sync hanging for 1.5+ minutes every 10 minutes
  - Added content hash to detect actual changes, skip unchanged tasks
  - Pre-fetch calendar todos once for bulk operations instead of N+1 calls
  - Completed/inactive tasks properly cached after removal from calendar

### Added
- **Data retention cleanup** - Automatic cleanup of old tasks to prevent database bloat
  - Tasks completed >1 year ago are automatically deleted daily at 3:30 AM
  - Inactive/deleted tasks >1 year old also removed

## [1.38.0] - 2026-01-28

### Added
- **Global Supply Requests tab** - New "Supplies" tab in Team page for admin view

### Changed
- **Team Tasks edit modal** - Now matches ToDo edit modal features:
  - Added "All day" checkbox with conditional time field
  - Added "Visible to Farm Hands" checkbox
  - Added alerts selection (at time, 5 min, 10 min, etc.)
  - View all team member supply requests in one place
  - Filter by status, priority, or member
  - Quick status change dropdown on each request
  - Summary cards showing request counts by status
  - Pending/Approved total cost display
  - Add admin notes to requests

## [1.37.0] - 2026-01-28

### Added
- **Fitness tracking tab** - New tab in Team member dossier to track workouts
  - Log workouts with detailed metrics: duration, distance, weight carried, elevation, heart rate, calories
  - Support for multiple workout types: Run, Ruck, Swim, Bike, Row, Strength, HIIT, Combat, PT Test, Mobility
  - Track RPE (Rate of Perceived Exertion) and workout quality ratings
  - Stats view showing 30-day summary, workout frequency, breakdown by type, and best performances
  - Pace auto-calculated from distance and time
- **Fitness integration with readiness** - Workout consistency now affects overall readiness score
  - Fitness Performance indicator added (10% weight in physical readiness)
  - Tracks workout frequency, training variety (cardio + strength), and sustainable intensity
  - Trend analysis compares recent vs older workout patterns

## [1.36.0] - 2026-01-28

### Added
- **Context factors for vitals** - Tag readings with factors that may affect them:
  - Caffeine, Stress, White Coat, Post-Exercise, Fasting, Dehydrated, Poor Sleep
  - Select multiple factors when logging vitals
  - BP analysis accounts for these factors in scoring
- **Auto-refresh on data entry** - Vitals list and readiness analysis auto-refresh after adding new recordings

### Changed
- **Adjusted BP thresholds** - Less strict for athletic population:
  - Normal: <130/85 (was <120/80)
  - Elevated: 130-139/85-89 (was 120-129/80)
  - Stage 1: 140-159/90-99 (was 130-139/80-89)
  - Stage 2: ≥160/100 (was ≥140/90)
- 130/85 now scores 90 instead of 70 (minor concern, not amber)

## [1.35.3] - 2026-01-28

### Changed
- **Body fat requirements shown** - Body Fat card now shows which measurements are missing
  - Shows "Missing: waist, neck" etc. when measurements needed
  - For women, shows "(Hip required for women)" when hip is missing
  - Calculate button only appears when all required measurements exist

## [1.35.2] - 2026-01-28

### Added
- **Calculate Body Fat button** - In Health Data tab, click "Calculate from Measurements" to calculate and store body fat from existing taping measurements
- Body fat display now checks for stored body fat vitals first, then falls back to on-the-fly calculation
- New `/calculate-body-fat/` endpoint for manual body fat calculation
- Readiness analysis now also stores calculated body fat when refreshed

## [1.35.1] - 2026-01-28

### Added
- **Auto-calculate body fat** - Body fat percentage is now automatically calculated and stored when waist, neck, or hip measurements are logged
  - Uses Navy/Marine Corps taping method formula
  - Stores calculated body fat as a tracked vital with note "Auto-calculated from taping measurements"
  - Manual body fat entry still available for other measurement methods (calipers, DEXA, etc.)

## [1.35.0] - 2026-01-28

### Added
- **Gender field for team members** - Track gender for each team member
  - Gender displayed in profile Basic Information section
  - Edit gender in the Identity tab of member form
  - Health stats now use gender-specific body fat standards (ACE fitness)

### Changed
- **Date format standardization** - All dates now display in mm/dd/yyyy format
  - Updated SettingsContext formatDate to default to mm/dd/yyyy
  - Updated team components (MemberDossier, TeamGearTab, etc.)
  - Updated Settings, DevTracker, and other pages
- **Body fat calculation** - Now uses member gender instead of inferring from hip measurement
  - Female body fat requires hip measurement
  - Gender-specific ACE fitness standards applied

## [1.34.4] - 2026-01-28

### Added
- **Send dev tracker items directly to backlog** - Use `./dev-tracker.sh add --backlog <priority> <title>` to create items in backlog

## [1.34.3] - 2026-01-28

### Fixed
- **Body fat standards in readiness analysis** - Now uses ACE fitness standards instead of Marine Corps standards
  - 20% body fat now correctly shows as "within standard" (was showing yellow for exceeding 18% military limit)
  - Male standard: up to 24% is Normal (was 18% for USMC)
  - Female standard: up to 31% is Normal (was 26% for USMC)

## [1.34.2] - 2026-01-28

### Added
- **Full function test script** - Comprehensive API endpoint testing script (`scripts/test-endpoints.sh`)
  - Tests 73 endpoints across all modules (dashboard, weather, tasks, animals, etc.)
  - Color-coded output with pass/fail/warning status
  - Use before deployments to verify nothing is broken

### Fixed
- **Dashboard quick-stats 500 error** - Fixed broken endpoint that was referencing non-existent Animal columns
  - Now properly uses Animal model properties (next_hoof_trim, next_worming)
- **CalDAV status endpoint** - Fixed 500 error due to missing method calls
- **Dev tracker fail_count display** - FAILED badge now shows count (e.g., "FAILED x3")

## [1.34.1] - 2026-01-28

### Added
- **Environment Switcher** - Quick link in Settings to switch between Dev and Prod instances
  - Shows DEV/PROD badge indicating current environment
  - One-click link to navigate to the other environment

## [1.34.0] - 2026-01-28

### Changed
- **Consolidated Health Data UI** - Streamlined health data tab layout:
  - Single "Add Recording" button in header (near refresh) for all vitals including weight
  - Weight now included in Latest Vitals grid as first card
  - Each vital card shows last 3 readings in small text (instead of baseline box)
  - Removed separate Baseline Averages section (info visible in other areas)
  - Removed separate Weight History section (weight now in Latest Vitals)
  - Click any vital card to see full history with delete option
- **Body fat categories updated** - 18-25% now shows as "Normal" (green) instead of "Average" (yellow)
  - Uses ACE fitness standards: Essential (<6%), Athletic (6-14%), Fitness (14-18%), Normal (18-25%), Above Normal (25-32%), High (32%+)

## [1.33.3] - 2026-01-28

### Fixed
- **Title whitespace accumulation** - Fixed bug where task titles starting with "Home:" or similar patterns accumulated leading spaces each sync cycle
- **Title comparison** - Now strips whitespace when comparing titles to prevent false change detection

## [1.33.2] - 2026-01-28

### Fixed
- **CalDAV sync false change detection** - Fixed bug where calendar sync was incorrectly detecting changes and overwriting tasks with data from different calendar events
- **UNIQUE constraint error** - Added check to prevent calendar_uid collision when linking tasks to calendar events
- **Cleared Python cache on prod** - Fixed stale bytecode causing email import errors in health monitor

## [1.33.1] - 2026-01-28

### Added
- **Resting Heart Rate tracking** - New vital type for resting HR separate from active HR
- **Active Heart Rate display** - Health data tab now shows both Resting HR and Active HR
- **Baseline Averages section** - Prominent display of all vital baselines with deviation indicators
  - Shows yellow highlight when current reading deviates significantly from baseline
  - Displays sample count for each baseline

### Fixed
- Baseline averages section now uses standard gray theme for better readability
- Readiness analysis uses resting HR for baseline comparisons (falls back to regular HR if no resting data)

## [1.33.0] - 2026-01-27

### Added
- **Health Monitoring System**
  - Automatic health checks every 5 minutes monitoring API, database, CalDAV, memory, disk, and CPU
  - Health logs stored in database with 7-day retention
  - Email alerts sent when issues are detected (with cooldown to prevent spam)
  - Health Monitoring section in Settings page showing:
    - Current system status with individual check results
    - 24-hour uptime statistics
    - Historical health logs with status filtering
    - Manual health check trigger
    - Option to clear old health logs

## [1.32.0] - 2026-01-27

### Added
- **Performance-Readiness Analysis System**
  - Automatic overall readiness calculation combining physical and medical factors
  - Physical readiness calculated from vitals (RHR, HRV, BP, SpO2, temp, respiratory)
  - Marine Corps taping method for body composition (no BMI)
  - New vital types: NECK and HIP circumference for taping method
  - Weighted scoring: Autonomic Recovery (45%), Illness Risk (25%), Cardiovascular (20%), Body Composition (10%)
  - Risk flags with severity levels and recommendations
  - Updates member's overall_readiness field automatically
- **Readiness Analysis Panel in Health Data tab**
  - Visual display of overall, physical, and medical readiness status
  - Progress bars for physical breakdown indicators
  - Primary drivers explaining current status
  - Risk flags with color-coded severity
  - Expandable details showing data quality and all indicators
  - Refresh button to recalculate
- **Enhanced Health Stats for tactical athletes**
  - Body Fat % calculated via Navy/Marine Corps taping method (height, waist, neck circumference)
  - Lean Mass calculated from weight and body fat percentage
  - Resting Heart Rate displayed prominently

### Changed
- Dev Tracker edit mode now shows fail note and test notes fields
  - Click edit pencil on any item to modify title, priority, fail note, and test notes
  - Notes can be edited for items in any status

### Removed
- BMI from health stats (not suitable for tactical athletes with high muscle mass) analysis

## [1.31.0] - 2026-01-27

### Added
- **Rain forecast indicator in weather widget**
  - Shows "In Xhr" when rain is expected within 48 hours
  - Displays "Now (X%)" when currently raining
  - Shows "No rain 48hr" when no precipitation expected
  - Uses NWS hourly forecast data for accurate predictions
- **Task assignment display everywhere**
  - Task assignments now shown in cyan badges across all views
  - Visible in TaskList, Dashboard backlog, Calendar day details
  - Shows member name with user icon
- **Health data improvements**
  - Added HRV (Heart Rate Variability) tracking
  - Removed glucose tracking (not relevant for general health)
  - Vital averages displayed as baselines in health data tab
  - Shows reading count next to averages

### Changed
- **Task edit modal improvements**
  - Edit modal now matches ToDo page styling
  - Added ability to reassign/unassign tasks to different members
  - Added category dropdown and backlog toggle
- **Deploy script improvements**
  - Better lock detection with explicit SSH verification
  - Clearer error messages when blocked by concurrent deploy

## [1.30.0] - 2026-01-27

### Added
- **Blood type prominently displayed in team member header**
  - Large red badge with heart icon shows blood type next to member name
  - Always visible regardless of active tab
- **Anaphylaxis allergy tracking**
  - Allergies can now be marked as "triggers anaphylaxis"
  - Checkbox when adding allergy to mark as anaphylaxis risk
  - Toggle button (↑↓) on existing allergies to change severity
  - Anaphylaxis allergies shown with warning icon and bold red styling
  - Pulsing warning banner in header for members with anaphylaxis allergies
- **Enhanced allergy display in profile**
  - Clear visual distinction between regular and anaphylaxis allergies
  - Warning triangle icon on severe allergies

## [1.29.9] - 2026-01-27

### Added
- **Dev tracker note editing commands**
  - `dev-tracker.sh failnote <id> <note>` - Update fail note without changing status
  - `dev-tracker.sh testnotes <id> <notes>` - Update test notes without changing status

## [1.29.8] - 2026-01-27

### Changed
- **Deploy script conflict behavior**
  - Production deploy now FAILS immediately if another deploy is running (does not wait)
  - Dev deploy still waits for other deploys to complete (up to 5 minutes)
  - Clear error message shows which deploy is blocking

## [1.29.7] - 2026-01-27

### Added
- **Task management in team member tasks tab**
  - Three-dot menu on each task with Complete, In Progress, Send to Backlog, Edit, Delete options
  - Click status icon to quickly mark task complete
  - Edit modal allows updating title, description, due date/time, priority
  - Move tasks between Active and Backlog sections
  - Delete tasks with confirmation

### Fixed
- **Task assignment display in ToDo page**
  - Tasks assigned to team members now show the member's name in a cyan badge
  - Both legacy single-member and multi-member assignments are displayed

## [1.29.6] - 2026-01-27

### Added
- **Health Data tracking for team members**
  - Renamed "Weight" tab to "Health Data" for comprehensive health tracking
  - Track blood pressure (systolic/diastolic), heart rate, temperature, blood oxygen (SpO2)
  - Track body fat percentage, glucose levels, respiratory rate, waist circumference
  - BMI automatically calculated from weight and height
  - Latest vitals quick view with click to expand full history
  - Add and delete vital readings with timestamps and notes
  - Weight history logging with notes support

## [1.29.5] - 2026-01-27

### Added
- **Deploy script conflict protection**
  - Dev and prod deploy scripts now use lock file mechanism
  - Prevents concurrent deploys from running simultaneously
  - Waits up to 5 minutes if another deploy is in progress
  - Auto-releases lock on completion or error via trap

## [1.29.4] - 2026-01-27

### Added
- **Team members in Assign To dropdown**
  - Team Members now appear in the same "Assign To" dropdown as Workers and Users
  - Team Members shown as first optgroup for easy access
  - Additional checkboxes below dropdown for assigning multiple members to events
  - Single-select dropdown plus multi-select checkboxes for flexible assignment

### Changed
- **Log viewer styling**
  - Off-white background (#f5f5f0) for better readability
  - Dark carbon text instead of light text
  - Color-coded backgrounds for ERROR (red) and WARNING (yellow) entries
  - Maintains ANSI codes from logs for color preservation

## [1.29.3] - 2026-01-27

### Added
- **Multi-member assignment for events and reminders**
  - Can now assign multiple team members to any task/event
  - New "Team Members" multi-select checkbox UI in event form
  - Assigned members display in ToDo page and backlog
  - Backend support for many-to-many task-member relationship

## [1.29.2] - 2026-01-27

### Fixed
- **Production & Sales page finalization**
  - Nav icon label changed from "Finance" to "Production"
  - Page title now "Production & Sales"
  - Meat Production section now shows cost per lb breakdown by animal type
  - Each animal type (beef, pig, lamb, etc.) shows individual cost/lb

## [1.29.1] - 2026-01-27

### Fixed
- **Log viewer text readability**
  - Brightened log text colors for better visibility on dark background
  - Timestamps now gray-400, messages now gray-100
  - ANSI color codes are now stripped from logs
- **Production page improvements**
  - Customers tab now uses table format instead of cards
  - Overview now shows Harvests section with consumed/sold/preserved stats
  - Harvests tab no longer shows "Record Sale" button (use Track Usage instead)
- **Gear container handling**
  - Removed redundant "Container" badge from gear display
  - "Can Hold Contents" checkbox now shows for all categories
  - Any gear item can be marked as a container regardless of category

## [1.29.0] - 2026-01-27

### Added
- **Team Member Task Assignment**
  - Tasks can now be assigned to team members
  - New "Tasks" tab in member profile shows assigned tasks and backlog
  - Backlog view shows member name badge for assigned tasks
- **Team Member Supply Requests**
  - New "Supplies" tab in member profile for requesting gear/equipment
  - Request form includes item name, description, quantity, price, vendor, product link
  - Priority levels: Low, Medium, High, Urgent
  - Status tracking: Pending, Approved, Ordered, Delivered, Denied
  - Admins can view all requests and update status

## [1.28.8] - 2026-01-27

### Added
- **Multiple log file support in Settings**
  - Can now view Application Log, Backend Log, and Backend Error Log
  - Buttons to switch between log files with size indicators
  - All important system logs accessible from one location

## [1.28.7] - 2026-01-27

### Fixed
- **Notes now visible for gear contents without editing**
  - Content item notes now display below the expiration info
  - Shows in both Member Gear tab and Team Gear tab views

## [1.28.6] - 2026-01-27

### Fixed
- **Multiple expiration dates when adding content items**
  - Add Content modal now supports tracking individual unit expirations
  - When quantity > 1, checkbox appears to enable individual tracking
  - Each unit can have its own expiration date and lot number

## [1.28.5] - 2026-01-27

### Added
- **Application Log Viewer in Settings (Admin only)**
  - View recent application logs directly in Settings
  - Filter by log level (ERROR, WARNING, INFO, DEBUG)
  - Search logs by text
  - Configurable number of lines (50-500)
  - Clear logs button
  - Collapsible section to reduce clutter

### Changed
- **Dev tracker now requires testing descriptions**
  - When moving items to testing, a description of what was done is required
  - Use: `./dev-tracker.sh testing <id> "description"`
  - Descriptions are shown when viewing item details

## [1.28.4] - 2026-01-27

### Added
- **Custom gear categories**
  - Can now add custom categories when creating gear (not limited to predefined list)
  - Custom categories automatically appear in filter dropdown and future category selections

### Changed
- **Unassigned gear no longer shows "Pool" label**
  - Gear without an assigned member now shows nothing instead of "Pool" indicator
  - Assigned gear still shows the member name with green indicator

## [1.28.3] - 2026-01-27

### Fixed
- **Mobile view zoom/overflow issue on iPhone**
  - Added overflow-x: hidden to html, body, and #root to prevent horizontal scroll
  - Input font-size set to 16px on mobile to prevent iOS auto-zoom on focus
  - Weather forecast now shows 3 columns on mobile (was 5)

## [1.28.2] - 2026-01-27

### Fixed
- **Gear content status now automatically computed**
  - Items with quantity=0 show as MISSING
  - Items below min_quantity show as LOW
  - Items with expired dates show as EXPIRED
  - Status is computed server-side, no longer depends on manual setting

## [1.28.1] - 2026-01-27

### Added
- **Battery type tracking for gear contents**
  - Specify what type of batteries an item uses (AA, AAA, CR123A, 18650, etc.)
  - Battery type displayed as badge on content items
- **Cleaning and recharge status for gear contents**
  - Mark items as needing cleaning or recharge
  - Visual indicators show items needing attention

### Fixed
- Pool gear (unassigned) contents can now be edited without timeout errors
  - Added dedicated API endpoints for pool gear content management
- Content edit modal in Team Gear tab now matches Member Gear functionality
  - Individual unit expiration tracking works in both views
- Container checkbox now hidden when gear category is set to BAG
  - BAG category automatically sets is_container=true

## [1.28.0] - 2026-01-27

### Added
- **Farm Finances page** (renamed from Production & Sales)
  - Complete redesign with new tab structure: Overview, Livestock, Harvests, Orders, Customers
- **Customer management system**
  - Track customers with contact info, address, and notes
  - Link customers to sales and orders
  - Soft delete (deactivate) customers to preserve history
- **Multi-payment livestock orders**
  - Create orders for livestock sales with portion tracking (whole, half, quarter, custom)
  - Track estimated and actual weights with price per pound
  - Payment progress bar showing deposit/partial/final payments
  - Support for multiple payment methods: cash, check, Venmo, Zelle, card
  - Order status tracking: Reserved, In Progress, Ready, Completed, Cancelled
- **Production allocation tracking**
  - Allocate livestock production for: Sale, Personal use, Gift, Loss
  - Track weight and cost per allocation
  - Calculate cost value of personal use meat
- **Harvest allocation tracking**
  - Track harvest usage: Sold, Consumed, Gifted, Preserved, Spoiled
  - Quick "Mark as Consumed" option for personal use
- **Enhanced financial overview**
  - Revenue, expenses, and net profit summary
  - Outstanding payments dashboard with quick payment actions
  - Livestock cost per pound tracking
  - Personal use weight and cost value
- **Outstanding payments view**
  - See all orders with unpaid balances
  - Quick access to add payments from overview

### Changed
- Navigation renamed from "Prod" to "Finance" with new icon
- Route changed from /production to /farm-finances

## [1.27.3] - 2026-01-27

### Fixed
- Pool gear creation now works (fixed database schema constraint)
  - The `member_id` column was incorrectly set as NOT NULL in the database
  - Pool gear can now be created without being assigned to a member

## [1.27.2] - 2026-01-27

### Changed
- Team Gear tab moved to appear before Weekly AAR in team tabs
- Team Gear tab now shows expandable containers (bags) with full content management
  - Click to expand and view contents
  - Add, edit, delete contents directly
  - Quantity +/- controls for quick adjustments
- Dev Tracker section order reordered: To Implement → Testing → Backlog → Metrics → Verified

## [1.27.1] - 2026-01-27

### Added
- Individual unit expiration tracking for gear contents
  - Track separate expiration dates for each unit (e.g., 2 Epi Pens with different expiration dates)
  - Optional lot number tracking per unit
  - Toggle "Track individual expirations" when quantity > 1

## [1.27.0] - 2026-01-27

### Added
- Team-wide Gear Inventory tab on Teams page
  - View all gear across team members and unassigned pool
  - Filter by category, status, and assignment
  - Add gear to pool (unassigned)
  - Assign/reassign gear to team members
  - Search gear by name, make, model, serial number, or color
- Color field for gear items (bags, clothing, etc.)
- Gear can now exist unassigned in a pool for later assignment

## [1.26.2] - 2026-01-27

### Added
- Dev tracker backlog status for deferring items to work on later
  - Move items from "To Implement" to backlog with archive button
  - Backlog section shows deferred items sorted by priority
  - Move items back to pending from backlog

### Changed
- Nav sidebar always expanded - removed "more" arrow button
  - Settings, Dev Tracker, and User menu always visible

## [1.26.1] - 2026-01-27

### Added
- Quick quantity adjustment (+/-) buttons for gear contents items
  - Adjust quantity without opening edit modal
  - Auto-updates status (MISSING when 0, LOW when below minimum)

## [1.26.0] - 2026-01-27

### Added
- **Team Member Gear Tracking**
  - Assign equipment/gear to team members (firearms, bags, medical, comms, optics, tools, electronics)
  - Track serial numbers, make, model, caliber, status, and location
  - Container support for go bags with contents tracking
  - Maintenance schedules with frequency (days or rounds for firearms)
  - Mark maintenance complete to auto-calculate next due date
  - Expiration tracking for contents (MREs, medical supplies, batteries)
  - Status badges: Serviceable, Needs Maintenance, Needs Repair, Out of Service
- **Training Tracking System**
  - Track training items per member (Shooting, Medical, Comms, Navigation, Fitness, Driving)
  - "Days since last trained" counter with color coding (green <30, amber 30-60, red >60 days)
  - Optional frequency setting with overdue warnings
  - Quick log or detailed session logging with duration and notes
  - Training history view per item
  - Team training summary showing overdue training across all members
- **Enhanced Medical Appointment Tracking**
  - Flexible appointment types: Physical, Dental, Vision, Specialist, Immunization, Lab Work
  - Age/gender-appropriate types: OB/GYN, Mammogram, Pap Smear, Pediatric, Well Child
  - Custom appointment type support
  - Provider details (name, phone, address) per appointment type
  - Configurable frequency (3, 6, 12, 24, 36 months)
  - Mark complete to auto-calculate next due date
- **Children's Sizing Options**
  - Baby shirt sizes: NB, 0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M
  - Toddler shirt sizes: 2T, 3T, 4T, 5T
  - Kids shirt sizes: 4, 5, 6, 6X, 7, 8, 10, 12, 14, 16
  - Baby shoe sizes: 0-5
  - Toddler shoe sizes: 5T-10T
  - Kids shoe sizes: 10.5K-6Y
- **Auto-Reminders for Team Members**
  - Gear maintenance due reminders synced to calendar
  - Gear expiration alerts (configurable days before expiration)
  - Training due reminders (when frequency is set)
  - Medical appointment due reminders

### Changed
- Member dossier now has Gear and Training tabs between Profile and Medical
- Medical tab now includes tracked appointments section

## [1.25.0] - 2026-01-26

### Added
- **Team/Unit/Family Management Page**
  - Inspired by USMC Marine Corps Mentoring Program (NAVMC DIR 1500.58)
  - Enable via Settings > Display > Team Management Page
- **Operator-Style Member Dossiers**
  - Profile with photo, role, callsign, nickname
  - Contact info and emergency contact
  - Physical measurements (height, weight with history tracking)
  - Gear sizing: blood type, shoe, shirt, pants, hat, glove sizes
  - Skills, responsibilities, and completed trainings
- **Medical Readiness Tracking (MEDPROS-inspired)**
  - Overall readiness status (Green/Amber/Red)
  - Dental status with last/next appointment dates
  - Vision status with prescription tracking
  - Physical exam tracking with limitations
  - Allergies, medical conditions, and current medications
  - Medical history log for all changes
- **Mentoring System (MCMP-inspired)**
  - Weekly mentoring sessions with previous goals review
  - Three goal categories: Professional, Personal, Readiness
  - Values alignment assessment with 1-5 ratings per value
  - Positive observations and areas for improvement
  - Action items tracking
  - Auto-archive after 4 sessions (keeps most recent visible)
- **Configurable Team Values**
  - Define team values with names, descriptions, and assessment questions
  - Configure in Settings > Team Configuration
  - Values used in mentoring session assessments
  - Historical tracking of values alignment per member
- **Weekly Observations**
  - "What went well" and "Needs improvement" entries
  - Scope: Individual, Team, or Operations
  - Optional linking to team values or goal categories
- **Weekly After Action Review (AAR)**
  - Aggregates all member observations by scope
  - Summary notes and team action items
  - Historical AAR archive
- **Team Overview Dashboard**
  - Mission statement and core values display
  - Readiness summary bars (overall, medical, dental)
  - Team roster with readiness indicators
  - Upcoming appointments (next 30 days)
- **Photo Upload**
  - Upload member photos for dossier display
  - Photos stored securely on server
- **Unit Configuration**
  - Imperial or metric units for measurements
  - Configurable mentoring day and AAR day

## [1.24.0] - 2026-01-26

### Added
- **Motto / Mission Statement setting**
  - Set a motto or mission statement in Settings > Display
  - Displayed on every page to keep you focused on your purpose
  - Shows to the right of page titles (hidden on mobile for space)
  - Centered display on Dashboard above the main content
- **Bible Verse collapse feature**
  - Click chevron to collapse verse of the day
  - Remembers collapse state for the day, resets daily
  - Click collapsed bar to expand again
- **Calendar overlap display**
  - Events at the same time now display side by side instead of stacking
  - Visual gap between back-to-back events for clarity

### Fixed
- **Recurring events now display in future calendar weeks**
  - Weekly, biweekly, monthly, and daily events project correctly
  - Navigate forward in calendar to see recurring schedule
- Duplicate className warnings on Seeds, Vehicles, FarmAreas pages

## [1.23.5] - 2026-01-24

### Fixed
- **Mobile viewport sizing and pinned navigation bar**
  - Uses dynamic viewport height (dvh) for proper mobile browser support
  - Nav bar now stays pinned at top during scroll on mobile
  - Fixes iOS Safari address bar viewport issues

## [1.23.4] - 2026-01-23

### Fixed
- **Smart bi-directional calendar sync with timestamp comparison**
  - Compares last-modified timestamps to determine which version is newer
  - Phone edits sync to app only if phone was edited more recently
  - App edits sync to phone only if app was edited more recently
  - No more overwriting phone changes during sync

## [1.23.3] - 2026-01-23

### Fixed
- **Calendar sync now finds tasks by ID when UID doesn't match**
  - Uses X-ISAAC-TASK-ID to link calendar events to tasks
  - Fixes sync issues when calendar UIDs get out of sync

## [1.23.2] - 2026-01-23

### Fixed
- **Full bi-directional calendar sync**
  - Edit any event/reminder from your phone and it syncs back to Isaac
  - Supports: title, date, time, location, description, and completion status
  - Changes sync in both directions between app and phone calendar

## [1.23.1] - 2026-01-23

### Fixed
- **Auto-capitalize now works on touch screens**
  - Uses native value setter to properly trigger React state updates
  - Capitalizes immediately as you type (not on blur)
  - Works with both inputs and textareas

## [1.23.0] - 2026-01-23

### Added
- **Add Event/Reminder from any page**
  - Floating action menu (3 dots) now has "Add" button
  - Opens full event modal with all options (recurrence, alerts, entity linking, etc.)
  - Same functionality as calendar page "Add Event" button

## [1.22.4] - 2026-01-23

### Fixed
- **Calendar sync performance - reduced database contention**
  - Calendar service is now cached instead of recreating per operation
  - Eliminates excessive CalDAV reconnections (was 7+ per sync, now 1)
  - Reduces database lock contention significantly

## [1.22.3] - 2026-01-23

### Fixed
- **Database lock errors when adding tasks**
  - Added 30-second timeout to SQLite connections
  - Prevents "database is locked" errors during calendar sync

## [1.22.2] - 2026-01-23

### Fixed
- **Duplicate email alerts finally fixed**
  - Deploy scripts now kill orphaned processes before restart
  - Daily digest uses atomic database update to prevent race conditions
  - Task reminders claim task before sending to prevent duplicates
  - Multiple processes can no longer send the same email

## [1.22.1] - 2026-01-23

### Fixed
- **Auto-capitalize first letter now works on desktop and mobile**
  - Text inputs capitalize first letter on blur (when leaving field)
  - Works on all devices, not just mobile keyboards
  - Preserves cursor position during transformation

## [1.22.0] - 2026-01-22

### Added
- **Metrics tab in ToDo page**
  - Track productivity with completion stats
  - Shows tasks completed today, this week, this month
  - Displays completion streak (consecutive days)
  - Average tasks per day calculation
  - Overdue and backlog health indicators

## [1.21.2] - 2026-01-22

### Changed
- **Dashboard now uses a distinct icon**
  - Dashboard navigation uses LayoutDashboard icon instead of Home
  - Home Maintenance keeps the Home icon to avoid confusion

## [1.21.1] - 2026-01-22

### Added
- **Auto-capitalization for text inputs**
  - Mobile keyboards now auto-capitalize the first letter of sentences
  - Applied to all text inputs and textareas throughout the app

## [1.21.0] - 2026-01-22

### Fixed
- **Mobile view text sizing**
  - Added text-size-adjust CSS to prevent mobile browsers from auto-inflating text
  - Prevents "zoomed in" appearance on mobile devices

## [1.20.9] - 2026-01-22

### Fixed
- **Basic users can now access important settings**
  - Location Settings (timezone, coordinates, USDA zone) now available to all users
  - Email Notification Settings (enable/disable, recipients, digest time) now available to all users
  - Alert Thresholds and Notification Categories were already accessible

## [1.20.8] - 2026-01-22

### Fixed
- **Duplicate email alerts and daily digests**
  - Added grace period to daily digest catchup to prevent race with cron job
  - Reminder alerts now update last_notified to prevent check_upcoming_tasks duplicates

## [1.20.7] - 2026-01-22

### Fixed
- **Dashboard clock now uses configured timezone from Settings**
  - Previously used system/browser timezone, causing wrong times on devices with different system timezones
  - Added timezone-aware date formatting functions to SettingsContext
  - Components can now use formatDate, formatDateTime, getNow, getTodayISO for timezone-aware display

## [1.20.6] - 2026-01-22

### Fixed
- **Sprinkler watering now reliably marks plants as watered**
  - Changed timing window from "within 1 hour of schedule" to "anytime after schedule"
  - Sprinkler watering now updates both last_watered and last_watering_decision for consistency

## [1.20.5] - 2026-01-21

### Added
- **Full event-style slaughter and pickup scheduling**
  - Slaughter and pickup now have time ranges (start and end times)
  - Added notes fields for phone numbers and instructions
  - Calendar events now show duration based on start/end times
  - Event descriptions include notes with contact info

## [1.20.4] - 2026-01-21

### Added
- **Processor address field for livestock**
  - Added processor_address field for the processor's location
  - Address is used as the calendar event location (falls back to processor name if not set)

## [1.20.3] - 2026-01-21

### Added
- **Slaughter and pickup times for livestock**
  - Added slaughter_time and pickup_time fields to animals
  - Slaughter and pickup events now appear as calendar events (not reminders) with times
  - Times can be set when creating/editing livestock animals

## [1.20.2] - 2026-01-21

### Fixed
- **Calendar sync now uses configured timezone from Settings**
  - Previously hardcoded to America/New_York, causing events to appear at wrong times
  - Now respects the timezone setting for all calendar operations

## [1.20.1] - 2026-01-21

### Fixed
- **Animal slaughter dates now update task due dates when changed**
  - Previously, changing an animal's slaughter date would not update the associated task's due date
  - Task due dates now sync correctly when slaughter dates are modified

## [1.20.0] - 2026-01-20

### Added
- **Multi-language support for workers (Spanish)**
  - Workers can have a language preference (English or Spanish)
  - Task titles and descriptions auto-translate using argos-translate
  - Worker Tasks UI switches to Spanish when a Spanish-speaking worker's tab is selected
  - Translation happens on the backend, cached for performance

## [1.19.6] - 2026-01-20

### Fixed
- **Freeze/frost weather alerts can now be properly dismissed**
  - Dismissed alerts were being deleted and recreated on each weather poll (every 5 min)
  - Now respects user's dismissal until the alert naturally expires
  - Only active (non-dismissed) alerts are replaced when weather conditions change

## [1.19.5] - 2026-01-20

### Fixed
- **Daily digest no longer sends duplicate emails**
  - Implemented atomic database transaction for deduplication check
  - Previous check-then-set pattern had race condition vulnerability
  - Added info-level logging to track digest send claims

## [1.19.4] - 2026-01-20

### Fixed
- **Acknowledged cold/blanket advisories now display when no weather alerts exist**
  - AlertBanner was returning early if no regular alerts existed, hiding acknowledged advisories
  - Fixed to show acknowledged advisories section even when alerts array is empty
- **Cold/blanket alert acknowledgement now resets at midnight in app timezone**
  - Previously used UTC date which caused reset at wrong time
  - Now uses the timezone configured in Settings for consistent behavior
- **Cold protection now shows upcoming night's low, not ending overnight**
  - In the morning, was showing the overnight low that was about to end
  - Now finds the next nighttime period that ends more than 2 hours from now
  - Ensures alerts are relevant for planning tonight's protection needs

## [1.19.3] - 2026-01-19

### Fixed
- **"Pull to Tracker" button now works** in DevTracker feedback section
  - Button was incorrectly calling the list function instead of the pull function
  - Now properly pulls pending feedback from production into the dev tracker
- **Auto-generated maintenance tasks now properly recreate after completion**
  - Fixed logic that prevented new task creation when previous task was completed
  - Added automatic re-sync of maintenance reminders after task completion
  - Stale next_due dates (older than frequency) are now reset to today
- **Cold protection and blanket advisories now persist after page refresh**
  - Acknowledgement state saved in localStorage (resets daily)
  - Acknowledged advisories properly stay in "Acknowledged Alerts" section
- **Events can now be set to repeat** in EventModal
  - Added recurrence dropdown (daily, weekly, biweekly, monthly, quarterly, annually, custom)
  - Custom recurrence supports "every X days" interval
- **Date format hint added** to EventModal date fields
  - Shows (MM/DD/YYYY) hint next to date labels for clarity
- **Weather alert dismiss investigated** - backend correctly dismisses individual alerts by ID
  - If issue persists, may be related to cold protection widgets which now use localStorage persistence
- **Users can now delete their own feedback at any stage**
  - Previously could only delete feedback with NEW status
  - Now allows deleting feedback that has been reviewed/processed

### Security
- **Updated Python dependencies for CVE fixes**
  - cryptography 44.0.0 → 44.0.1 (CVE-2024-12797)
  - FastAPI 0.115.6 → 0.125.0 (pulls starlette 0.50.0 for CVE-2025-54121, CVE-2025-62727)
  - python-multipart 0.0.18 → 0.0.20

## [1.19.2] - 2026-01-15

### Added
- **Delete button in EventModal** for calendar events
  - Delete button now appears when editing existing events in Day/Week/Month views
  - Previously delete was only available in Month view's day detail panel

## [1.19.1] - 2026-01-15

### Added
- **Manual feedback check button** on DevTracker page
  - "Check Feedback" button always visible to manually pull feedback from production
  - Shows success/info message with count of pending items

### Fixed
- Calendar event deletion now shows proper error messages

## [1.19.0] - 2026-01-15

### Changed
- **Alerts are now collapsible with acknowledge/dismiss workflow**
  - New alerts show prominently at the top of the dashboard
  - Click checkmark to acknowledge - moves alert to collapsible "Acknowledged Alerts" section
  - Click X to dismiss - removes alert completely
  - Cold protection and blanket advisories also move to alerts section when acknowledged
  - Acknowledged alerts section uses consistent deep red header color
  - Earth-toned colors: critical (deep red), warning (burnt orange), info (forest green), cold (teal), blankets (purple)
  - Reduces dashboard clutter while keeping alerts accessible

## [1.18.9] - 2026-01-15

### Added
- **Multi-day events now available in Calendar**
  - Calendar page now uses shared EventModal component with full multi-day support
  - Toggle "Multi-day event" checkbox when creating/editing events
  - Set end date for events that span multiple days

## [1.18.8] - 2026-01-15

### Changed
- **Dashboard backlog widget is now scrollable**
  - Long backlog lists no longer make the whole page scroll
  - Backlog content scrolls independently with max height of 256px

## [1.18.7] - 2026-01-15

### Fixed
- **User feedback status display improvements**
  - "Failed" tracker items now properly show as "In Development" (was showing raw status)
  - Approved items with pending tracker status now show "Pending Implementation" instead of "In Development"
  - Last 5 completed items sorted by completion date (most recent first)

## [1.18.6] - 2026-01-15

### Fixed
- **Fix duplicate daily digest emails**
  - Dev instance now skips sending digest (only prod sends)
  - Added deduplication check in send function to prevent any duplicate sends
  - Digest is now guaranteed to send only once per day regardless of restarts

## [1.18.5] - 2026-01-15

### Fixed
- **Daily digest email no longer shows worker-assigned tasks**
  - Tasks assigned to workers are now excluded from the daily digest email
  - Owner digest focuses on their own tasks, not worker tasks

## [1.18.4] - 2026-01-14

### Fixed
- **Duplicate email reminders**
  - Fixed race condition where scheduler could send same reminder multiple times
  - Now commits to database immediately after marking alert as sent (before sending email)
  - Tightened alert window to prevent overlap between 5-minute scheduler runs
  - Added database refresh to check latest state before sending each alert

## [1.18.3] - 2026-01-14

### Changed
- **E-paper theme applied to Calendar page**
  - View switcher buttons, navigation, day/week/month views all use CSS variables
  - Event chips and day detail panel now themed consistently
- **E-paper theme applied to Home Maintenance page**
  - Stats cards, category cards, task items use theme colors
  - Status indicators (ok/due soon/overdue) use CSS variables
  - All form modals updated with consistent styling
- **E-paper theme applied to Animals page**
  - Location styling on collapsed animal cards updated
  - Action buttons (Edit, Add Expense, View Expenses, etc.) themed
  - Animal tags now use CSS variable colors
  - Urgency indicators for slaughter dates use theme colors
  - Stats cards, header buttons, and grouped location views updated

## [1.18.2] - 2026-01-14

### Added
- **Duplicate expense feature for animals**
  - Click the copy icon on any expense to create a duplicate
  - Pre-filled form with today's date for quick editing before saving
- **Pull from Prod button for user feedback**
  - Manually refresh feedback from production without waiting for auto-refresh
- **My Feedback status tracking**
  - See your feedback progress: Pending Review → In Development → In Testing → Completed
  - Production queries dev tracker for real-time status updates
  - Last 5 completed items remain visible so users can see things get worked on

### Changed
- **Feeding guide and backlog cards now match widget background**
  - Cleaner visual appearance with consistent theming

## [1.18.1] - 2026-01-14

### Fixed
- **Security: User feedback cross-account vulnerability**
  - Users can now only view, edit, and delete their own feedback
  - Feedback endpoints now require authentication
  - Ownership verified by matching username/display_name

### Changed
- **Today's Schedule widget now has warm parchment background (#cab1a2)**
  - Provides visual distinction from other dashboard widgets
  - Dark mode falls back to standard surface color
- **ToDo page now defaults to "Today" tab**
  - Previously defaulted to "Upcoming" (today + tomorrow)

## [1.18.0] - 2026-01-14

### Added
- **Enhanced feedback management system**
  - Auto-refresh production feedback every 5 minutes in Dev Tracker
  - Approve, decline, or kickback feedback directly from Dev Tracker
  - Add notes when reviewing feedback to explain decisions
  - Users see feedback status and admin responses in Settings > My Feedback
  - Submit new feedback directly from Settings page (no floating button needed)
  - Priority assignment when approving feedback

### Fixed
- **Daily digest email sent multiple times**
  - Fixed race condition when service restarts during catchup window
  - Digest now marked as sent before actual sending to prevent duplicates
  - Catchup window dynamically follows configured digest time

## [1.17.0] - 2026-01-13

### Added
- **Multi-day events support**
  - Events can now span multiple days (e.g., vacations, trips, conferences)
  - Toggle "Multi-day event" checkbox when creating an event
  - Set start date and end date separately
  - Multi-day events display in purple on calendar views
  - Events show on each day they span with visual indicators
  - Month view shows arrows (→ and ↳) to indicate continuing events
  - Week view shows rounded corners on start/end days only

## [1.16.0] - 2026-01-13

### Added
- **Customer feedback system for user testing**
  - Toggle feedback collection on/off from Dev Tracker page
  - Floating feedback button appears on production when enabled
  - Users can submit feature requests, bug reports, and improvements
  - Pull feedback from production into dev tracker with one click
  - Submitted feedback marked as "[User Feedback]" in dev tracker

### Changed
- **Light mode now has a "foresty" green theme**
  - Background colors shifted from warm cream to soft sage/moss tones
  - Borders, inputs, and navigation elements now have green tints
  - Scrollbars and form controls match the forest aesthetic
  - Creates a more nature-inspired, agricultural feel

### Fixed
- **Weather widget colors now theme-aware**
  - Hot weather shows warm/red backgrounds in light mode
  - Cold weather shows blue/cyan backgrounds in light mode
  - Sun icon is yellow, rain is blue, clouds are gray

## [1.15.5] - 2026-01-13

### Changed
- **Light mode now has a "foresty" green theme**
  - Background colors shifted from warm cream to soft sage/moss tones
  - Borders, inputs, and navigation elements now have green tints
  - Scrollbars and form controls match the forest aesthetic
  - Creates a more nature-inspired, agricultural feel

## [1.15.4] - 2026-01-13

### Changed
- **Weather widget now has color-coded temperatures**
  - Main temperature display colored by temperature range (blue=cold to red=hot)
  - High/low temps, feels-like, and forecast all use temperature colors
  - Widget background changes based on conditions (hot, cold, rainy)
  - Humidity colored by level (amber=dry, blue=humid)
  - Wind speed colored when high (amber >15mph, red >25mph)
  - Rain amount colored by inches received
  - More descriptive condition text (Extreme Heat, Freezing, etc.)

## [1.15.3] - 2026-01-13

### Added
- **Automated dependency security scanning**
  - Deploy scripts now run `pip-audit` for Python dependencies
  - Deploy scripts now run `npm audit` for Node dependencies
  - Warnings shown but don't block deployment

## [1.15.2] - 2026-01-13

### Security
- **Session tokens now hashed in database**
  - Session tokens are stored as SHA-256 hashes, not plaintext
  - If database is compromised, attacker cannot steal active sessions
  - Existing sessions are automatically migrated on startup
  - No user action required - sessions remain valid

## [1.15.1] - 2026-01-13

### Fixed
- **Worker tasks no longer appear on Dashboard, Calendar, or ToDo pages**
  - Tasks assigned to workers now only appear on the Worker Tasks page
  - Prevents worker-specific tasks from cluttering main views
  - Affects task lists, calendar views, stats counts, and backlog

## [1.15.0] - 2026-01-13

### Security
- **Encrypted storage for sensitive settings**
  - API keys, passwords, and tokens are now encrypted at rest in the database
  - Encrypted settings: SMTP password, CalDAV password, AWN API keys, Cloudflare token
  - Uses Fernet symmetric encryption with environment-based key
  - Existing plaintext values are automatically encrypted on first startup

### Added
- **Percentage input mode for split expenses**
  - When using "Custom Amounts" in split expense modal, can now toggle between $ and %
  - Enter percentages and see calculated dollar amounts in real-time
  - Validates that percentages add up to 100%

## [1.14.5] - 2026-01-13

### Fixed
- **Farm area location badge now shows for all linked tasks**
  - Tasks created from Farm Area page now show location badge on Dashboard, ToDo, Calendar
  - Previously hidden when task category was "Home Maintenance"

## [1.14.4] - 2026-01-13

### Changed
- **Feeding widget display order**
  - Reordered to: Name · Color+Type · Location · Feed info
  - Example: "Duke · Black Dog · House · 1/4th Scoop Dog Food Once daily"
  - More natural reading flow matching spoken language

## [1.14.3] - 2026-01-13

### Fixed
- **Touchscreen time picker defaulting to midnight**
  - Added "All day (no specific time)" checkbox to ToDo form
  - Time field now hidden by default, only shown when checkbox unchecked
  - Prevents touchscreen time pickers from accidentally setting 00:00
  - Matches EventModal behavior for consistency

### Security
- **Seeds router authentication**
  - Added authentication to create/update/delete seed endpoints (was missing)
  - Changed permission denied error message to not disclose internal categories

### Changed
- **Improved error handling for kiosk users**
  - Kiosk users now have full editor-like permissions (create, edit, delete)
  - Error messages no longer disclose internal permission categories

## [1.14.2] - 2026-01-13

### Fixed
- **Comprehensive button text visibility audit**
  - Added explicit text-white to ALL colored buttons across all pages
  - Fixed Calendar event borders and text readability
  - Fixed Worker Tasks buttons (Assign, Block, Save Note, Approve, Deny)
  - Fixed buttons in Settings (Invite, Add Role, Test Email, Test Sync)
  - Fixed buttons in Plants, Seeds, Animals, Equipment, Vehicles, Farm Areas, etc.

### Changed
- Theme switching now triggers hard page reload to ensure all CSS changes apply
- Floating keyboard button for touchscreen devices

## [1.14.1] - 2026-01-13

### Fixed
- **Light mode readability improvements**
  - Fixed unreadable labels in Seeds, Plants, and Animals pages (Name, Category, etc.)
  - "No" values now display in red instead of invisible gray for semantic meaning (Yes=green, No=red)
  - Field containers (bg-gray-900/30) now properly visible in light mode
  - Sun/Moon widget colors updated to use theme tokens
  - Worker Tasks empty state backgrounds now consistent with rest of page
  - User Management badges (Pending Invite, Kiosk, Farm Hand) now readable with white text
  - All priority indicators in task list use proper theme tokens
  - Location and equipment badges use proper badge styling
  - UV index warning badge properly themed
  - Removed all remaining hardcoded rgba() and hex colors from components

## [1.14.0] - 2026-01-13

### Added
- **Professional Design Token System**
  - Complete semantic token system for colors, borders, shadows, and spacing
  - Separate tokens.css file as single source of truth for all colors
  - 100+ design tokens covering all UI elements
  - Natural, earthy color palette: "Sunlit Field" (Light) & "Moonlit Farm" (Dark)

### Changed
- **Complete Theme Refactor**
  - Light Mode: Warm sage/cream backgrounds (#F4F6EE) with dark green text (#243024)
  - Dark Mode: Deep forest backgrounds (#141A16) with warm white text (#E8EDE9)
  - All status colors use semantic tokens (success, warning, error, info)
  - Badges and chips now use solid backgrounds with white text for maximum readability
  - Primary green ramp: #1F3A28 to #D4E6D8
  - Gold accent ramp for highlights
  - Teal accent ramp for secondary elements
  - Improved WCAG AA contrast compliance

### Fixed
- Flash of unstyled content prevented with inline theme init script
- Theme now respects system preference (prefers-color-scheme) when no localStorage setting
- All hardcoded hex colors replaced with CSS variables
- Form inputs, buttons, badges consistent across all pages

## [1.13.1] - 2026-01-13

### Fixed
- **Improved badge/tag readability in light mode**
  - All colored badges (plant tags, status labels, etc.) now have solid backgrounds
  - White text on darker badge backgrounds for maximum contrast
  - Consistent styling across Plants, Seeds, Animals, ToDo, Calendar, Settings pages
  - Dark mode badges also improved with more solid backgrounds

## [1.13.0] - 2026-01-13

### Changed
- **Complete theme overhaul: "Sunlit Field" (Light) & "Moonlit Farm" (Dark)**
  - Dark mode: Night Soil background (#1E211C) with Bone White text
  - Light mode: Warm Off-White background (#F6F5F1) with Rich Soil text
  - Sage Green (#8FB996) / Deep Olive (#4E6F52) primary accents
  - Harvest Gold / Dried Corn accent colors for highlights
  - Status colors: Fresh Sprout (success), Amber Grain (warning), Rust Clay (error), Cool River (info)
  - Button glow effects in dark mode for better visual feedback
  - All widgets, cards, and components use CSS variables for consistent theming
  - Improved contrast and readability across all pages
  - Custom scrollbar styling matches each theme

## [1.12.5] - 2026-01-13

### Changed
- Dashboard now uses smart data refresh instead of full page reload
  - Auto-refresh updates widget data without reloading the entire page
  - Smoother experience on kiosk displays
  - Weather forecast also refreshes on the interval

## [1.12.4] - 2026-01-13

### Added
- Dark/Light mode theme toggle in Settings > Display Settings
  - Switch between dark (default) and light color scheme
  - Theme persists across sessions via localStorage
  - Instant preview when toggling

## [1.12.3] - 2026-01-13

### Fixed
- Daily digest email now catches up if service restarts after scheduled time
  - If service starts after digest time (before noon), sends digest within 30 seconds
- Cold protection email logic corrected
  - Now properly alerts when forecast low is within buffer of plant's minimum temperature
  - Added clearer logging with threshold temperature

## [1.12.2] - 2026-01-13

### Added
- On-screen keyboard button for kiosk/touch displays
  - Toggle in Settings > Display Settings > On-Screen Keyboard Button
  - Shows keyboard icon in nav bar that toggles onboard keyboard

## [1.12.1] - 2026-01-13

### Fixed
- Expense split UX improved
  - Initial animal now shown prominently with their allocation (remainder)
  - Percentage auto-calculates as you add other animals
  - Add Expense button no longer incorrectly disabled

## [1.12.0] - 2026-01-13

### Added
- Enhanced expense management for animals
  - Inline expense splitting when adding expense from animal card
  - "Add Animal" button to split expense across multiple animals with percent or dollar amounts
  - View all expenses for an animal with edit and delete capabilities
  - CSV export for individual animal expenses or all animal expenses
  - "Export All" button exports combined expense report for all animals
- Expense list modal shows total, type, date, description, and vendor for each expense
- Backend API endpoints for expense update, delete, and CSV export

## [1.11.2] - 2026-01-13

### Fixed
- CalDAV sync incorrectly marking future tasks as completed
  - Phone completion now only applies to tasks due today or earlier
  - Prevents accidental completion of tomorrow's tasks from stale calendar data
- Calendar sync now runs every 10 minutes instead of once at 2am
  - Much faster sync between phone and webapp

## [1.11.1] - 2026-01-13

### Fixed
- Auto-reminder system creating duplicate tasks for completed maintenance items
  - Completed tasks now properly tracked to prevent re-creation
  - Cleaned up existing duplicate tasks in database

## [1.11.0] - 2026-01-12

### Added
- Split expense feature for animals
  - New "Split Expense" button on Animals page
  - Create expenses shared across multiple animals (e.g., feed for 4 cows)
  - Two split modes: Equal split or custom amounts per animal
  - Visual validation shows remaining amount to allocate
  - Each animal's expense records are linked by expense_group_id for tracking

## [1.10.14] - 2026-01-12

### Fixed
- Invite form now shows all available roles
  - Role dropdown dynamically populated from database roles instead of hardcoded options
  - Removed legacy farmhand checkbox (farmhand is now a proper role)

## [1.10.13] - 2026-01-12

### Fixed
- Fix accept-invite Internal Server Error
  - Incorrect log_audit call signature in accept_invitation endpoint

## [1.10.12] - 2026-01-12

### Fixed
- Fix Cloudflare tunnel API access denied error
  - Middleware was incorrectly using forwarded IP headers instead of socket IP
  - Now properly trusts localhost connections from nginx/cloudflared
  - Follows least privilege: only localhost and local network allowed

## [1.10.11] - 2026-01-12

### Fixed
- Fix resend invite button not showing for pending invitations
  - User list API wasn't returning `invitation_token` status
- Fix Cloudflare tunnel redirect loop causing accept-invite page to fail
  - Updated nginx to serve directly on port 80 for cloudflared tunnel traffic

## [1.10.10] - 2026-01-12

### Fixed
- Fix Cloudflare Access OTP emails not being sent for invited users
  - Cloudflare requires each email as a separate policy rule, not comma-separated
  - Updated add/remove email functions to use correct API format

## [1.10.9] - 2026-01-12

### Fixed
- Fix home/farm maintenance tasks not appearing on dashboard/calendar
  - Fixed FarmAreaMaintenance attribute name bug (`next_due_date` → `next_due`)
  - Auto-reminder sync was silently failing due to this error

## [1.10.8] - 2026-01-12

### Fixed
- Fix permission denied errors for animal operations (feeds, expenses, care schedules)
  - Changed permission category from "livestock" to "animals" to match role definitions
  - Affects create, edit, delete, and interact actions on animal-related endpoints

## [1.10.7] - 2026-01-12

### Fixed
- Fix animal edits not saving (e.g., special instructions for feeding)
  - API was missing `updated_at` field in response
  - Frontend couldn't detect changes to refresh edit data

## [1.10.6] - 2026-01-12

### Fixed
- Fix duplicate tasks when completing grouped care reminders (e.g., hoof trimming)
  - Completing a care task now cleans up any duplicate tasks with same notes
  - Auto-reminder sync now handles and removes existing duplicates
  - Changed notes matching from `contains` to exact match to prevent false matches
  - Clear `manual_due_date` on completion so next due date calculates correctly

## [1.10.5] - 2026-01-12

### Fixed
- Fix page freeze when selecting "Link to" in worker task creation modal
  - Entity linking section is now hidden for worker tasks (not needed)
  - No longer fetches all entities (plants, animals, etc.) for worker task modal
- Fix supply requests disappearing when marked as "Purchased"
  - Purchased items now remain visible in active list
  - Only Delivered and Denied requests are hidden by default
- Fix Dev Tracker COLLAB option not saving when creating new items
- Fix completed tasks not showing in today's schedule
  - Tasks completed today now show regardless of original due date

### Changed
- Sunrise/sunset times now show civil twilight (when you can see outside)
  - Previously showed astronomical sunrise/sunset which was ~25 min earlier/later

## [1.10.4] - 2026-01-12

### Added
- Task reminders now email assigned workers and system users
  - Workers with email addresses receive reminder alerts for their assigned tasks
  - System users can now be assigned to tasks (not just workers)
  - Assignment dropdown groups Workers and System Users with email addresses
  - Emails sent based on task reminder_alerts settings
- Supply request workflow improvements
  - Can now move items back to previous status (e.g., Delivered → Purchased)
  - Reopen button for denied requests
  - Edit and Delete buttons now available for all statuses including Delivered/Denied

## [1.10.3] - 2026-01-12

### Fixed
- Fix page freeze when selecting "Link to" dropdown in task creation modal
  - Added loading state while entity data (animals, plants, etc.) is being fetched
  - Added Array.isArray checks to prevent errors if API returns unexpected data
  - Entity dropdowns now disabled during loading to prevent race conditions

### Added
- COLLAB option in Dev Tracker for items requiring interactive collaboration
  - Users icon button in add form to mark new items as requiring collab
  - Toggle button on each item to quickly enable/disable collab
  - Collab toggle in edit mode when modifying item title
- Supply request workflow management in Worker Tasks
  - Pending requests: Approve or Deny buttons
  - Approved requests: Mark Purchased button
  - Purchased requests: Mark Delivered button
  - Edit button for modifying request details (non-terminal statuses)

## [1.10.2] - 2026-01-12

### Fixed
- Fix "Assign Existing" button in Worker Tasks page not showing available tasks
  - Route ordering issue was causing `/assignable-tasks/` to be matched as `/{worker_id}/`
- Supply requests now hide when marked as "Purchased" (in addition to Delivered/Denied)
  - Changed filter label to "Show completed" for clarity

### Added
- Worker notes on tasks
  - Workers can add progress notes to tasks without completing them
  - Purple "Add Note" / "Edit Note" button in task actions
  - Notes display with purple styling in task details
- Task in-progress tracking for workers
  - Start button to mark task as in-progress
  - Revert button to reset task back to not-started
  - IN PROGRESS and BLOCKED status tags show in collapsed task cards
  - Worker notes preview shown in collapsed view
- Quick-complete checkbox for worker tasks
  - Click the circle next to a task to instantly complete it
  - Similar behavior to ToDo page checkboxes
- Edit and uncomplete actions for completed worker tasks
  - Expand a completed task to see "Mark Incomplete" and "Edit" buttons
  - Allows reverting accidental completions

### Changed
- Moved "Workers" nav item to appear after Calendar in the navigation bar

## [1.10.1] - 2026-01-12

### Fixed
- Calendar push notifications now use default reminder alerts
  - Tasks without explicit reminder_alerts now fall back to `default_reminder_alerts` setting
  - Fixes missing iOS/phone push notifications for calendar events

## [1.10.0] - 2026-01-11

### Added
- Worker supply request feature
  - Workers can request supplies/items they need (cleaning supplies, tools, etc.)
  - Toggle between Tasks and Supply Requests views on Worker Tasks page
  - Status tracking: Pending, Approved, Purchased, Delivered, Denied
  - Workers can add notes to explain what they need
  - Homeowner can respond with admin notes

## [1.9.1] - 2026-01-11

### Added
- Worker assignment available across all task creation
  - Assign tasks to workers from EventModal (Calendar, Dashboard)
  - Assign tasks to workers from ToDo page
  - Worker Tasks page now uses standard EventModal for consistent task creation
  - All task creation forms include "Assign to Worker" dropdown when workers exist

### Changed
- Worker Tasks page improvements
  - Edit button added to worker tasks
  - Simplified form hides irrelevant options (alerts, farmhand visibility) for worker tasks
  - Uses standard EventModal for full feature consistency (notes, categories, etc.)

## [1.9.0] - 2026-01-11

### Added
- Worker Tasks page for managing external workers (maids, contractors, farm hands)
  - Tab-based UI to switch between workers
  - Assign tasks to workers without requiring user accounts
  - Workers can mark tasks as "Complete" with optional notes
  - Workers can mark tasks as "Cannot Complete" with required reason
  - Task blocking system with clear block status display
  - Enable via Settings > Display > Worker Tasks Page toggle

## [1.8.2] - 2026-01-11

### Fixed
- New user accounts unable to login
  - Expiration date was being set when left blank (should be null)
  - Affected farmhand and regular user creation
- Auth timestamps now use configured timezone instead of UTC
  - Session expiry, login times, invitation expiry all use settings timezone

## [1.8.1] - 2026-01-11

### Added
- Resend invitation button for pending user invites
  - "Pending Invite" badge shown for users who haven't accepted yet
  - Resend button generates new token and extends expiration
  - Available in Settings > User Management

## [1.8.0] - 2026-01-11

### Added
- Cloudflare Access integration for user invitations
  - When inviting users via email, automatically add them to Cloudflare Access policy
  - Settings for API token, account ID, and app ID in Settings > Cloudflare Access
  - Users can access the accept-invite link without manual Cloudflare configuration

### Security
- Settings endpoint now requires authentication
  - Previously exposed all settings (with masked passwords) to unauthenticated users
  - Settings are only fetched when user is logged in

## [1.7.1] - 2026-01-11

### Fixed
- Email invitations sending duplicate emails
  - Added guard to prevent double form submission

## [1.7.0] - 2026-01-11

### Added
- User email invitations
  - Invite users via email instead of creating accounts directly
  - Invited users choose their own username and password
  - Invitation emails include accept link with 48-hour expiry
  - Available in Settings > User Management > "Invite via Email"

## [1.6.1] - 2026-01-11

### Fixed
- Tasks with past due_time now show as overdue
  - Previously only checked due_date, ignored due_time
  - "Feed animals at 9am" now shows overdue if it's past 9am
  - Affects Dashboard, ToDo page, and TaskList component

## [1.6.0] - 2026-01-11

### Added
- Farm hand user accounts
  - Create user accounts with limited dashboard access
  - Farm hands only see tasks marked "visible to farm hands"
  - No access to backlog section
  - Account expiration: set date/time when account auto-disables
- "Visible to farm hands" checkbox on all events and reminders
  - Toggle per task to control farm hand visibility

## [1.5.1] - 2026-01-11

### Fixed
- Daily digest now shows correct rain chance percentage
  - Was always showing 0% even when rain was forecast
  - Now extracts precipitation probability from NWS API

## [1.5.0] - 2026-01-10

### Added
- Per-reminder alert intervals
  - Set alert times when creating/editing events and reminders
  - Intervals match iOS calendar: 5/10/15/30 min, 1/2 hrs, 1/2 days, 1 week
  - Select multiple intervals per reminder
  - Alerts sync to CalDAV as VALARM for native phone notifications
  - Also triggers email alerts at selected times

## [1.4.11] - 2026-01-10

### Fixed
- Sunrise/sunset times now accurate (was off by 3-12 minutes)
  - Replaced manual formula with astral library
  - Includes proper Equation of Time and atmospheric refraction corrections
  - Times now match timeanddate.com and NOAA calculations

## [1.4.10] - 2026-01-10

### Fixed
- Dev Tracker delete now works on mobile
  - Replaced browser `confirm()` dialog with proper modal
  - `confirm()` can fail silently on mobile browsers
- Dev Tracker action buttons now visible on mobile
  - Edit, delete, move buttons previously hidden (required hover)
  - Buttons visible by default on mobile, hover-reveal on desktop

## [1.4.9] - 2026-01-10

### Fixed
- 24hr time format now respects user setting on all pages
  - Fixed Animals, FarmAreas, Equipment, and Vehicles pages
  - Due times now use formatTime helper consistently

## [1.4.8] - 2026-01-09

### Added
- Linked location badges now shown in ToDo and Calendar pages
  - Purple badge with MapPin icon shows farm area/home maintenance area
  - Orange badge with Wrench icon shows linked vehicle/equipment
  - Consistent display across Dashboard, ToDo, and Calendar

## [1.4.7] - 2026-01-09

### Fixed
- Dashboard no longer shows completed tasks from past days
  - Only shows today's active tasks and today's completed tasks
- Mobile nav bar no longer cut off on phones with notches
  - Added safe-area support for modern devices
  - Fixed dropdown menu positioning when dev banner is shown

## [1.4.6] - 2026-01-08

### Changed
- User icon in sidebar now prompts for confirmation before logging out
  - Prevents accidental logout from mis-clicks

## [1.4.5] - 2026-01-08

### Added
- Timezone setting now available in Settings > Location Settings
  - Database-configurable timezone for all date/time calculations
  - Default: America/New_York
- Audit logging for critical security operations
  - Logs: login, logout, failed login, password change, user create/delete
  - Records IP address, user agent, timestamp, and details
  - Admin-only endpoint: GET /api/auth/audit-logs
- Pagination added to all major list endpoints
  - Default limit: 500, max: 1000 (prevents DoS from large responses)
  - Endpoints: plants, animals, tasks, equipment, vehicles, home maintenance
- Rate limiting now persisted to database
  - Survives backend restarts (prevents lockout bypass via restart)
  - LoginAttempt table tracks failed attempts with IP and timestamp

### Security
- Auth tokens moved from localStorage to HttpOnly cookies only
  - Prevents XSS attacks from stealing authentication tokens
  - Frontend no longer stores or sends tokens via JavaScript
  - Cookies sent automatically with `withCredentials: true`
- Fixed file permissions on Pi
  - Database files: 600 (owner read/write only)
  - Log files: 640 (owner read/write, group read)
  - Backup files: 600/640
  - Removed duplicate sudoers config
- Removed legacy SHA-256 password hash support
  - Only bcrypt hashes are now accepted (more secure)
- Added security headers via nginx
  - HSTS (Strict-Transport-Security)
  - Content-Security-Policy (CSP)
  - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
  - Referrer-Policy
- Fixed CalDAV/iCal property injection vulnerability
  - User input in event titles/descriptions/locations now sanitized
  - Prevents injection of malicious iCalendar properties via crafted text

## [1.4.4] - 2026-01-08

### Fixed
- Daily digest no longer shows past EVENTs as "overdue"
  - Only TODOs/reminders can be overdue, not calendar events
  - Past events are excluded from digest (they just happened, not "overdue")

## [1.4.3] - 2026-01-08

### Fixed
- Settings page time fields now use native time picker
  - Prevents validation errors from incorrect time formats (e.g., "6:30 AM")
  - Daily digest time setting now has proper HH:MM input

## [1.4.2] - 2026-01-08

### Fixed
- Daily digest no longer shows backlog items as "due today"
  - Added missing `is_backlog` column to database
- Sun/moon widget now shows accurate "first light" (civil dawn) time
  - First light = when sky starts to lighten (~30 min before sunrise)
  - Addresses user confusion about seeing light before listed sunrise time

### Security
- Password change now invalidates all other sessions (keeps current session active)
  - Prevents compromised sessions from remaining active after password change
- Reduced session expiry from 30 days to 7 days for improved security

## [1.4.1] - 2026-01-08

### Added
- Dev Tracker: Verified items grouped by day with collapsible sections
  - Today's items expanded by default, older days collapsed
  - Items auto-archived after 30 days (kept in metrics)
- Dev Tracker: Productivity metrics section
  - Completed today/week/month counts
  - Average items per day
  - Breakdown by priority level

### Changed
- User icon in sidebar now triggers logout on click (streamlined navigation)
- Dashboard widgets now use natural sizing (no forced expansion to fill space)
- Weather widget forecast section proportionally sized with other weather data

### Fixed
- "Last: in about X hours" showing future time for past completions (UTC vs local time bug)
  - Maintenance completion timestamps now use local timezone
- Dashboard backlog auto-collapses only when page would need scrolling (not always collapsed)
- Dashboard layout no longer creates excessive empty space between widgets

## [1.3.0] - 2026-01-07

### Added
- Sunrise/sunset/moon phase widget on Dashboard
  - Shows sunrise and sunset times
  - Countdown to sunrise/sunset with civil twilight offset (+30 min)
  - Moon phase with emoji and illumination percentage label
  - Daytime/nighttime indicator
- Home Maintenance page revamp
  - Tasks now grouped by Area/Appliance (Pool, A/C Unit, Water Heater, etc.) instead of category
  - Category shown as secondary tag on each task
  - Area icons and colors for visual distinction
  - Auto-complete suggestions for common areas
  - Collapsible sections with overdue/due soon badges
- Custom frequency for Home Maintenance tasks (every X days)
- "Add to Backlog" checkbox in ToDo inline creation form
- Bulk Animal Care: due time and one-time option
- "Pull from Production" button in Settings (dev instance only)
  - Copies production database to dev for testing with real data
  - Automatically clears alerts_sent and sync_uid to prevent duplicates
- Desktop sidebar navigation redesign
  - Compact left sidebar with collapsible section for Dev Tracker, Settings, and User
  - User icon displays username and triggers logout on click
  - Reduced nav bar footprint while keeping all functionality accessible
- Weather widget forecast now scales to fill available space

### Fixed
- 24hr time format not working on Dashboard (Settings button called wrong function)
- Alert time bugs:
  - Tasks with specific due_time now alert at that exact time
  - Tasks without due_time no longer send hourly alerts
- Daily digest bugs:
  - Backlog items excluded from "due today" section
  - Yesterday's events excluded from digest
- Plant import popup now shows correct sources with hyperlinks (pfaf.org, gardenia.net, growables.org)
- Edit button added for linked reminders on Farm Areas page

## [1.2.1] - 2026-01-06

### Security
- Fixed SSRF bypass vulnerability in plant import domain whitelist
  - Previous: `if "pfaf.org" in domain` allowed bypass via `pfaf.org.attacker.com`
  - Fixed: Now uses exact match or proper subdomain matching
- Comprehensive security audit completed (see SECURITY_AUDIT_DEEP_DIVE_2026-01-06.md)

## [1.2.0] - 2026-01-06

### Added
- Backlog feature for tasks/reminders
  - Mark tasks as "backlog" so they don't appear as due today
  - Backlog widget on Dashboard with quick complete and "move to today" actions
  - Backlog tab in ToDo page to view and manage backlog items
  - Backlog toggle button on all todo items
  - "Add to backlog" checkbox when creating reminders
- Sales tracking on Production page
  - Record sales of livestock, plants/nursery, produce, and other items
  - Track quantity, unit price, and total revenue
  - Sales tab with category filtering
  - Revenue and Net Profit summary cards
  - Page renamed to "Production & Sales"

## [1.1.7] - 2026-01-06

### Added
- Plant import from Gardenia.net (uses JSON-LD structured data for accurate parsing)
- Plant import from Growables.org (Florida tropical fruit and edible plants)

### Removed
- Permapeople.org plant import (replaced with better sources)

## [1.1.6] - 2026-01-06

### Changed
- Dashboard simplified: removed redundant "To Do" section (dateless tasks already appear in Today's Schedule)

## [1.1.5] - 2026-01-06

### Changed
- Daily digest now shows today's NWS forecast (high/low/conditions) instead of current weather
- Daily digest includes all tasks: today's, overdue, and dateless reminders

### Fixed
- Daily digest email not sending (scheduler email service not loading SMTP settings from database)
- Task reminder emails failing with wrong parameter name (html_content → body)
- SMTP "From" address rejected when using display name only (now formats as "Name <email@domain>")
- Verse of the day parsing for quoted text with newlines

## [1.1.4] - 2026-01-06

### Added
- Dev environment support (isaac.local separate from prod levi.local)
- "Push to Production" button in Settings (dev instance only)
- IS_DEV_INSTANCE configuration flag
- Reusable EventModal component for creating events/reminders from any page
- "Add Reminder" button on Animals, Plants, Vehicles, Equipment, and Farm Areas pages
- Linked reminders now display on entity cards (Farm Areas, Equipment, Vehicles)
- Backend API endpoint to fetch tasks by entity type

### Fixed
- Reminder dates showing previous day (timezone issue with JavaScript Date parsing)
- Bible verse of the day not loading (regex now handles multiline content)
- Completed auto-reminders disappearing from dashboard (now shows today's completed tasks)
- Delete button not working on completed auto-reminders (now hard-deletes deactivated tasks)
- Dateless reminders now show as "due today" on ToDo page and Dashboard
- Old completed dateless reminders no longer appear (only shows if completed today)
- Deleting completed tasks now properly removes them from the list
- bcrypt/passlib compatibility issue on Python 3.13

## [1.1.3] - 2026-01-05

### Changed
- "What's New" section now displayed above changelog in Settings
- Removed unused "Recent Commits" section from Settings

## [1.1.2] - 2026-01-05

### Fixed
- Plant save/edit validation errors (empty strings sent for enum fields)
- Trailing slash consistency on all plant API routes

## [1.1.1] - 2026-01-05

### Changed
- Plant care reminders now grouped by location (e.g., "Water: Front Yard" with plant list)
- Completing grouped reminder updates all plants in the group

## [1.1.0] - 2026-01-05

### Added
- Complete plant forms (Add Plant and Import) now include all fields matching expanded card view
- Care Schedule section with water, fertilize, prune frequency/months
- Auto Watering section with rain/sprinkler settings
- Production & Harvest section with produces months, harvest frequency, how to harvest
- Field selector when importing to existing plants (choose which fields to overwrite)
- PFAF care icons extraction for more accurate moisture/sun/hardiness data
- Metric to imperial conversion in plant importer (strips metric, keeps imperial)

### Fixed
- Plant edits not saving (PATCH request 307 redirect issue with trailing slash)
- sub_location missing from plant API response
- SMTP email timeout issues (added 30-second timeout)
- Protonmail DNS resolution issues (one IP unreachable)

## [1.0.0] - 2026-01-05

### Added
- Version tracking and update system in Settings
- Daily email digest with verse of the day
- Location dropdown with farm areas for Plants and Equipment
- Current time indicator on calendar (like Outlook)
- Auto-generated reminders now immediately create next occurrence when completed

### Fixed
- Auto-generated reminders not appearing on calendar after task completion
- Old completed auto-reminders now properly marked inactive

### Changed
- Daily digest now includes verse of the day at the top
- Email digest uses dedicated recipient setting with fallback to alert recipients

## [0.9.0] - 2026-01-04

### Added
- Calendar week view (default) and day view with 24-hour time grid
- Todos/reminders now show on calendar (not just events)
- Visual distinction between events (green solid) and reminders (blue dashed)
- Farm area hierarchical sub-locations (e.g., House > Master Bedroom)
- Equipment location tracking
- 24hr/12hr time format setting
- ToDo page views: Today, Upcoming, Week, Month
- Hide completed tasks toggle in Settings

### Fixed
- Group by location now default for Plants and Animals
- Added many new farm area types (rooms, outdoor areas, animal housing)

## [0.8.0] - 2026-01-03

### Added
- Grouped animal care reminders (one task per care type per date)
- Cold protection reminders with animal blanket notifications
- Sunset-based reminder scheduling
- Rain-based auto-watering integration with AWN stations
- Sprinkler schedule auto-watering (per-plant settings)

### Fixed
- iPhone reminder completion sync
- Calendar todos not being overwritten when marked COMPLETED

## [0.7.0] - 2026-01-01

### Added
- Production tracking (eggs, milk, harvest)
- Authentication system
- Web UI for config settings and storage monitoring
- Comprehensive security audit

### Changed
- Renamed project to Isaac
- Public release preparation
