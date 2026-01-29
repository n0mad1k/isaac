# Claude Code Instructions for Isaac/Levi Project

## CRITICAL: Task Tracking Rules

**ALWAYS use TodoWrite to track your work:**
1. When starting a dev tracker item, break it into sub-tasks in TodoWrite
2. Read the FULL item description before starting - items often have multiple requirements
3. Mark each sub-task as you complete it
4. Do NOT move items to testing until ALL sub-tasks are done
5. If an item has a fail_count > 0 or [COLLAB] flag, ASK the user before proceeding

## Autonomous/Overnight Mode

**When user says "run overnight", "while I sleep", "until X am", or similar:**
1. **DO NOT** ask questions or wait for human input
2. **SKIP** items with fail_count > 0 - note them for later
3. **SKIP** items marked [COLLAB] - these explicitly need the user
4. **SKIP** anything that would require clarification - make a note and move on
5. **Work autonomously** on everything you can handle solo
6. **Deploy to dev** unless explicitly told to deploy to prod
7. **At the end time**, compile a report of:
   - What was completed
   - What was skipped and why
   - Any errors encountered
   - Current system health status

**ALWAYS use git for change control:**
1. Commit changes locally before deploying
2. Use meaningful commit messages describing what was changed
3. This provides rollback capability if something breaks
4. Do NOT include "Claude" or AI references in commit messages
5. Deploy scripts auto-commit if there are uncommitted changes (safety net)

## Secure by Design

**Every change MUST follow a security-first mindset. Apply these principles to ALL code:**

### Authentication & Authorization
- **Every new endpoint MUST have auth** - No endpoint should be accessible without authentication
  - Read endpoints: `user: User = Depends(require_view("category"))` or `Depends(require_auth)`
  - Create endpoints: `user: User = Depends(require_create("category"))`
  - Update endpoints: `user: User = Depends(require_edit("category"))`
  - Delete endpoints: `user: User = Depends(require_delete("category"))`
  - State-change endpoints: `user: User = Depends(require_interact("category"))`
  - Admin/destructive endpoints: `user: User = Depends(require_admin)`
- **Check existing router patterns** before adding endpoints to match the auth style used

### Error Handling
- **NEVER expose internal error details to users** - Use generic messages like "An internal error occurred"
- **ALWAYS log the real error server-side** - `logger.error(f"Context: {e}")` before raising HTTPException
- **NEVER use `str(e)` in HTTPException detail** - This leaks stack traces, file paths, and internal state
- Pattern: `except Exception as e: logger.error(f"...: {e}"); raise HTTPException(status_code=500, detail="An internal error occurred")`

### Input Validation
- **Validate and sanitize all user input** at API boundaries
- **Use Pydantic models** with Field constraints (min_length, max_length, pattern, ge, le)
- **Never trust client-side validation alone** - always validate server-side
- **File uploads**: Validate MIME types, reject SVG/HTML that could contain XSS
- **Path parameters**: Never construct file paths from user input; use hardcoded paths

### Data Protection
- **Session cookies**: Use HttpOnly, Secure, SameSite=Lax flags
- **Cookie name**: Always `session_token` (never `auth_token`)
- **Sensitive settings**: Mask values in API responses (passwords, API keys, tokens)
- **CORS**: Use explicit allowed origins, never wildcard `*` with credentials

### Headers & Transport
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, Content-Security-Policy are set in SecurityHeadersMiddleware
- **CSP policy**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`

### Code Review Checklist (Apply to every change)
1. Does every new endpoint have authentication?
2. Are error messages generic (no `str(e)` in responses)?
3. Is user input validated with Pydantic constraints?
4. Are file paths hardcoded (not from user input)?
5. Are sensitive values masked in responses?
6. Would this change introduce any OWASP Top 10 vulnerability?

## Session Log (Clear at midnight daily)

**2026-01-29:**
- Security audit fixes (v1.45.1): Added auth to workers/supply-requests/weather/dashboard/settings routers, hardened CORS, added CSP header, fixed exception detail leaks, fixed cookie inconsistency, fixed hardcoded timezone

**2026-01-28:**
- #230: Standardized all date formats to MM/DD/YYYY across frontend and backend
- #178: Added water overview to plants page
- Recurring event single-occurrence edit/delete (v1.45.0): RecurrenceChoiceModal, exception_dates column, delete-occurrence/edit-occurrence endpoints

**2026-01-27:**
- #182: Added custom gear categories + removed "Pool" label for unassigned gear
- #176: Added testing description requirement - descriptions now required when moving to testing
- Production database restore after migration corrupted member_gear table

**2026-01-14:**
- #127 UI Changes:
  - Weather widget: static background `#c2c9cd` (removed dynamic gradients)
  - Sun/moon widget: background `#c2c9cd` (matches weather)
  - Forecast cards: `#b3bac0` (darker shade to match weather widget)
  - Feeding guide cards: `#d4e5d0` (matches feeding guide widget)
  - Backlog cards: `#d4e5d0` (matches backlog widget)
  - Task/reminder cards in Today's Schedule: `#cab1a2` (NOT the widget background)
  - Event blocks in Today's Schedule: `#cb936a`
- #126 Feedback system: implemented approve/decline/kickback, auto-refresh
- #128 Security fix: user feedback cross-account vulnerability
- #129 ToDo page defaults to Today tab
- Updated CLAUDE.md with task tracking rules, git requirements, deploy mode

## Dev Tracker Workflow

**After completing each task, check the dev tracker for new items:**
```bash
/home/n0mad1k/Tools/levi/scripts/dev-tracker.sh list
```

The dev tracker is the source of truth for pending features, bugs, and improvements. Items are prioritized as: critical > high > medium > low. Work on items in priority order.

**Ad-hoc requests from user:**
When the user asks you to work on something that's NOT already in the dev tracker:
1. Add it to the dev tracker with appropriate priority
2. Work on it
3. Move it to testing when complete

**Item Title Convention:**
- If an item title contains `*`, it means the implementation failed and the text after `*` describes what needs to be fixed
- Example: `Feature X * backend returns 500 error` means Feature X was attempted but has a 500 error that needs fixing

**CRITICAL - Failed Items (fail_count > 0):**
- Items with `fail_count > 0` mean a PREVIOUS ATTEMPT FAILED - they are NOT fixed
- NEVER assume a failed item is "already done" or "already fixed"
- You MUST actually implement the fix and test it before moving to testing
- The fail_note explains what went wrong in the previous attempt
- Do not say "this should already be fixed" for failed items - it clearly wasn't

**[COLLAB] Flag - IMPORTANT:**
Items marked `[COLLAB]` require interactive step-by-step fixing WITH the user. Do NOT attempt to fix these autonomously.

When you see `[COLLAB]` on an item:
1. **STOP** - Do not make changes on your own
2. **ASK** the user what step to start with
3. **SHOW** them each change before making it
4. **WAIT** for their feedback after each step
5. **ITERATE** together until they confirm it's fixed

The user marks items as [COLLAB] when:
- Previous autonomous attempts failed multiple times
- The fix requires visual verification they need to perform
- They want to guide the implementation direction

To mark an item as [COLLAB]: `./dev-tracker.sh collab <id> on`
To remove [COLLAB]: `./dev-tracker.sh collab <id> off`

**Moving Items to Testing - DESCRIPTION REQUIRED:**
When moving items to testing status, you MUST provide a description of what was done. This helps the user verify the implementation is correct.

```bash
# REQUIRED format - description is mandatory:
/home/n0mad1k/Tools/levi/scripts/dev-tracker.sh testing <id> "Description of what was implemented"
```

Example descriptions:
- "Added custom category dropdown to gear form. Select '+ Add New Category' to enter custom name."
- "Fixed duplicate email issue by adding deduplication check in send_alerts()"
- "Added export button to settings page. Click to download data as CSV file."

The description should explain:
1. What was changed/added
2. How to test it (if not obvious)
3. Any edge cases the user should verify

## CRITICAL: Deployment Rules

**CURRENT MODE: Deploy to DEV only**
Only deploy to prod when the user explicitly asks.

Run deploy script after completing changes:
```bash
/home/n0mad1k/Tools/levi/deploy-dev.sh
```

### Server Layout (SAME PHYSICAL SERVER)
Both environments run on the same Pi (192.168.5.56 / levi.local):

| Environment | Directory | Service | Port | Database |
|-------------|-----------|---------|------|----------|
| **PROD** | `/opt/levi/` | `levi-backend.service` | 8000 | `/opt/levi/backend/data/levi.db` |
| **DEV** | `/opt/isaac/` | `isaac-backend.service` | 8443 | `/opt/isaac/backend/data/levi.db` |

### Dev Environment
- URL: `https://192.168.5.56:8443`
- Directory: `/opt/isaac/`
- Deploy script: `/home/n0mad1k/Tools/levi/deploy-dev.sh`
- Can deploy to dev more freely, but still ask if unsure

### Prod Environment
- URL: `https://levi.local` or `https://192.168.5.56:8000`
- Directory: `/opt/levi/`
- Deploy script: `/home/n0mad1k/Tools/levi/deploy.sh`
- **REQUIRES EXPLICIT USER PERMISSION TO DEPLOY**

## Deployment Scripts

**For DEV (192.168.5.56:8443):**
```bash
/home/n0mad1k/Tools/levi/deploy-dev.sh
```

**For PROD (isaac.local / levi.local) - ONLY WHEN USER EXPLICITLY ASKS:**
```bash
/home/n0mad1k/Tools/levi/deploy.sh
```

**NEVER run rsync manually** - the deploy scripts properly exclude:
- `venv/` - Python virtual environment (do not sync or delete)
- `node_modules/` - Node dependencies (do not sync or delete)
- `dist/` - Built frontend (rebuilt on Pi)
- `__pycache__/` and `*.pyc` - Python bytecode
- `.env` - Environment config (stays on Pi)
- `data/` and `logs/` - Runtime data

## SSH Access

Use the SSH config alias:
```bash
ssh -i /home/n0mad1k/.ssh/levi n0mad1k@levi.local
```

Or with the host alias `levi` if SSH config is loaded.

## Project Structure

- **Backend**: FastAPI Python app at `/opt/levi/backend/`
- **Frontend**: React/Vite app at `/opt/levi/frontend/`
- **Service**: `levi-backend.service` (systemd)

## Key Files

- `backend/models/database.py` - Database init with **auto-migration** (adds missing columns on startup)
- `backend/routers/tasks.py` - Task completion updates source entities
- `backend/services/auto_reminders.py` - Auto-generated task notes format: `auto:source_type:source_id`
- `frontend/src/components/TaskList.jsx` - Task display with collapsible completed items

## Timezone Handling

**CRITICAL: The app timezone is set in Settings (stored in `app_settings` table as `timezone`)**

- Default: `America/New_York` (Eastern Time)
- ALL datetime operations MUST use this setting, NOT hardcoded timezones
- Get timezone in backend:
  ```python
  from config import settings
  import pytz
  tz = pytz.timezone(settings.timezone)  # or fetch from app_settings
  ```
- Timestamps in database are stored as **naive UTC** - convert to user timezone for display
- When comparing dates (e.g., "today's tasks"), always use the configured timezone
- CalDAV sync, scheduler jobs, and dashboard queries must all respect this setting

## Date Formatting

**ALL user-facing dates MUST be formatted as MM/DD/YYYY (e.g., 01/28/2026)**

### Frontend Rules
- **date-fns format()**: Use `'MM/dd/yyyy'` — NEVER `'MMM d, yyyy'`, `'MMMM d, yyyy'`, `'MMM d'`, or `'M/d/yy'`
- **toLocaleDateString()**: Always pass `'en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }`
- **NEVER** use default `toLocaleDateString()` without explicit format options
- **Calendar month labels** (e.g., "January 2024") and **weekday abbreviations** (e.g., "Mon") are OK as-is — these are navigation labels, not date displays
- **HTML input type="date"** uses yyyy-mm-dd internally — this is correct for form inputs
- **Internal ISO dates** (yyyy-MM-dd) for API data exchange are fine — only change user-facing displays

### Backend Rules
- **Python strftime**: Use `"%m/%d/%Y"` for user-facing dates in emails, notifications, reminders
- **API responses**: Keep `.isoformat()` (ISO 8601) — the frontend handles display formatting
- **iCalendar/CalDAV**: Keep standard format (`%Y%m%dT%H%M%SZ`) — protocol requirement
- **CSV exports**: Keep `%Y-%m-%d` — standard data format

### Existing Central Format Function
- `SettingsContext.jsx` has a `formatDate()` function that already returns MM/DD/YYYY
- Use it via `const { formatDate } = useSettings()` when available in a component
- Some components define their own local `formatDate` — these must also use the MM/DD/YYYY format

## Database Schema Changes

When adding new columns to models:
- The `init_db()` function in `database.py` automatically adds missing columns on startup
- New tables are created automatically by SQLAlchemy's `create_all()`
- New columns on existing tables are detected and added via `_migrate_tables()`
- This runs every time the backend starts, so deploys automatically apply schema changes

## Auto-Reminder Source Types

When tasks are completed, the source entity is updated based on `task.notes`:
- `plant_watering` → Plant.last_watered
- `plant_fertilizing` → Plant.last_fertilized
- `vehicle_maint` → VehicleMaintenance.last_completed
- `equipment_maint` → EquipmentMaintenance.last_completed
- `home_maint` → HomeMaintenance.last_completed
- `farm_maint` → FarmAreaMaintenance.last_completed
- `animal_care_schedule` → AnimalCareSchedule.last_performed
- `care_group` → Multiple AnimalCareSchedule records

## Version Management

**⚠️ MANDATORY: After completing ANY feature or bug fix, you MUST update BOTH files:**

### 1. VERSION (`/home/n0mad1k/Tools/levi/VERSION`)
- Contains just the version number (e.g., `1.4.0`)
- Bump PATCH (1.4.0 → 1.4.1) for bug fixes
- Bump MINOR (1.4.0 → 1.5.0) for new features

### 2. CHANGELOG.md (`/home/n0mad1k/Tools/levi/CHANGELOG.md`) - "What's New"
- Add entries under `### Added`, `### Changed`, or `### Fixed` for current version
- Format: `- Brief description of change`
- Nested details use 2-space indent: `  - Detail here`
- **This populates the "What's New" section in Settings** - users see these changes!

### When to Update
- **ALWAYS** update both VERSION and CHANGELOG.md after completing work (before deploying to dev)
- **Bump PATCH** for any bug fix (dev changes will be deployed to prod)
- **Bump MINOR** for new features
- Create new version section in CHANGELOG.md when bumping version

### Examples
| Scenario | VERSION | CHANGELOG |
|----------|---------|-----------|
| Fixed bug in dev | Bump patch (1.4.1 → 1.4.2) | Add to `### Fixed` under new version |
| Added new widget | Bump minor (1.4.1 → 1.5.0) | Add to `### Added` under new version |
| Multiple fixes same session | Single bump | Group all fixes under same version |

### How "What's New" Works
- Settings page calls `/api/settings/version/`
- Backend parses CHANGELOG.md and extracts `- ` lines under current version
- These appear as "What's New in vX.X.X" in the Settings UI
- Keep a running log of what I have asked and what you changed so you can remember what is going on. you can clear the log at midnight everyday
- Any item in dev trackers to implement with a failed status is not already completed it has been kicked back
- Timezone should be dynamic based on what is set in Isaacs settings