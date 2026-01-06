# Changelog

All notable changes to Isaac will be documented in this file.

## [1.1.4] - 2026-01-06

### Fixed
- Reminder dates showing previous day (timezone issue with JavaScript Date parsing)
- Bible verse of the day not loading (regex now handles multiline content)
- Completed auto-reminders disappearing from dashboard (now shows today's completed tasks)
- Delete button not working on completed auto-reminders (now hard-deletes deactivated tasks)

### Added
- Reusable EventModal component for creating events/reminders from any page
- "Add Reminder" button on Animals, Plants, Vehicles, Equipment, and Farm Areas pages
- Linked reminders now display on entity cards (Farm Areas, Equipment, Vehicles)
- Backend API endpoint to fetch tasks by entity type

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
