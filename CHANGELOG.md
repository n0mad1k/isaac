# Changelog

All notable changes to Isaac will be documented in this file.

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
