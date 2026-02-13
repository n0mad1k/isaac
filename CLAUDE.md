# Claude Code Instructions for Isaac/Levi Project

## ⛔ #1 RULE — NEVER STOP WORKING

**THIS IS THE MOST IMPORTANT RULE. VIOLATION OF THIS RULE IS UNACCEPTABLE.**

After completing ANY action — finishing a task, answering a question, deploying, or ANY interaction — you MUST immediately:

```bash
/home/n0mad1k/Tools/levi/scripts/dev-tracker.sh list
```

Then pick the next highest-priority pending item (skip `[COLLAB]`) and work on it.

**There is NO scenario where you stop and wait.** The ONLY reasons to stop are:
1. All pending items are done or `[COLLAB]`
2. The user explicitly tells you to stop

**This applies to:**
- After finishing a dev tracker item ➜ pull list, keep working
- After answering a user question ➜ pull list, keep working
- After deploying ➜ pull list, keep working
- After ANY interaction that doesn't give you new direct work ➜ pull list, keep working

**NEVER** end a response without either (a) actively working on a task, or (b) confirming zero non-COLLAB items remain.

---

## CRITICAL: Task Tracking Rules

**ALWAYS use TodoWrite to track your work:**
1. When starting a dev tracker item, break it into sub-tasks in TodoWrite
2. Read the FULL item description before starting - items often have multiple requirements
3. Mark each sub-task as you complete it
4. Do NOT move items to testing until ALL sub-tasks are done
5. If an item has a [COLLAB] flag, ASK the user before proceeding
6. If an item has fail_count > 0, read the fail_note and fix it autonomously

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

**2026-02-03:**
- #264: Health monitor colors improved for readability (v1.79.7)
- #299: Health indicator reference ranges/recommendations now readable with color-coded backgrounds (v1.79.8, v1.79.11)
- #307: BMI median displays without metric units (v1.79.9)
- #308: Budget colors updated to use theme tokens instead of hardcoded values (v1.79.10)
- #301: Chat AI provider label now shows configured provider (Claude/ChatGPT/Ollama) with model tooltip (v1.79.12)
- #306: Growth record edit/delete fixed - backend now includes height_inches, guards prevent editing entries without ID (v1.79.13)
- #304: Child milestone tracker now detects advanced development (v1.79.14)
- #302: Updated CLAUDE.md session log and README.md features list
- #290: Security audit review - added identified issues to backlog (#309-312)
- #235: Farm/Business Name setting now visible in Settings > Team (v1.79.15)
- #175: Team Readiness Alerts added to daily digest - gear low/expired, overdue training/medical (v1.79.16)

## Dev Tracker Workflow

**⛔ See "#1 RULE — NEVER STOP WORKING" at the top of this file. This section provides details.**

**EVERY TIME you finish ANYTHING (task, question, deploy, etc.), you MUST run this command to get a FRESH list:**
```bash
/home/n0mad1k/Tools/levi/scripts/dev-tracker.sh list
```
Do NOT rely on a cached/previous list. ALWAYS pull fresh. New items may have been added since you last checked.

**Continuous work loop — THIS NEVER ENDS until items run out:**
1. Run `dev-tracker.sh list` (EVERY time — no exceptions)
2. Pick the highest priority pending item that is NOT `[COLLAB]`
3. Work on it, deploy, move to testing
4. **Go back to step 1 IMMEDIATELY — do NOT stop here**

Keep going until:
- No pending items remain, OR
- All remaining items are `[COLLAB]` (which need user)

The dev tracker is the source of truth for pending features, bugs, and improvements. Items are prioritized as: critical > high > medium > low. Work on items in priority order.

**Ad-hoc requests from user:**
When the user asks you to work on something that's NOT already in the dev tracker:
1. Add it to the dev tracker with appropriate priority
2. Work on it
3. Move it to testing when complete

**Item Title Convention:**
- If an item title contains `*`, it means the implementation failed and the text after `*` describes what needs to be fixed
- Example: `Feature X * backend returns 500 error` means Feature X was attempted but has a 500 error that needs fixing

**CRITICAL - Before Starting ANY Item:**
- **ALWAYS check for images** — Run `curl -sk "https://isaac.local/api/dev-tracker/<id>"` and check the `images` array. If images exist, download and view them: `curl -sk "https://isaac.local/api/dev-tracker/images/<filename>" -o /tmp/item-<id>.png` then read the file
- **ALWAYS check fail_note_history** — The `fail_note_history` JSON field contains all previous fail notes with dates. The `show` command displays these, but also check the raw API response for the full history
- Images often show EXACTLY what's wrong — don't guess when there's a screenshot available

**CRITICAL - Failed Items (fail_count > 0):**
- Items with `fail_count > 0` mean a PREVIOUS ATTEMPT FAILED - they are NOT fixed
- NEVER assume a failed item is "already done" or "already fixed"
- You MUST actually implement the fix and test it before moving to testing
- **Every failed item has a fail_note** — ALWAYS read it before starting work. The fail_note explains what went wrong in the previous attempt and guides your fix
- Do not say "this should already be fixed" for failed items - it clearly wasn't
- Failed items with fail notes do NOT need user involvement — read the notes and fix autonomously
- If a fail_note is missing or empty, ask the user what went wrong before attempting a fix

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
Both environments run on the same Pi (levi.local):

| Environment | Directory | Service | Port | Database |
|-------------|-----------|---------|------|----------|
| **PROD** | `/opt/levi/` | `levi-backend.service` | 8000 | `/opt/levi/backend/data/levi.db` |
| **DEV** | `/opt/isaac/` | `isaac-backend.service` | 8443 | `/opt/isaac/backend/data/levi.db` |

### Dev Environment
- URL: `https://isaac.local`
- Directory: `/opt/isaac/`
- Deploy script: `/home/n0mad1k/Tools/levi/deploy-dev.sh`
- Can deploy to dev more freely, but still ask if unsure

### Prod Environment
- URL: `https://levi.local`
- Directory: `/opt/levi/`
- Deploy script: `/home/n0mad1k/Tools/levi/deploy.sh`
- **REQUIRES EXPLICIT USER PERMISSION TO DEPLOY**

## Deployment Scripts

**For DEV (isaac.local):**
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

## Nginx Reverse Proxy — Router Prefix Rule

**CRITICAL: Nginx strips `/api/` prefix before forwarding to the backend.**

The Nginx config uses:
```
location ^~ /api/ {
    proxy_pass http://127.0.0.1:8000/;
}
```
This means a browser request to `/api/chat/health/` arrives at the backend as `/chat/health/`.

**Therefore, FastAPI router prefixes must NOT include `/api/`.** Use:
- `APIRouter(prefix="/chat")` ✅ CORRECT
- `APIRouter(prefix="/api/chat")` ❌ WRONG — will cause 404

All existing routers follow this pattern: `/tasks`, `/team`, `/weather`, `/settings`, etc.
The frontend `api` axios instance has `baseURL: '/api'`, so frontend calls like `api.get('/chat/health/')` become `/api/chat/health/` in the browser, which Nginx correctly strips to `/chat/health/`.

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