# Tasks & Calendar

Isaac provides flexible task management with calendar integration.

## Calendar Views

### Week View (Default)
- 7-day view starting from Sunday
- 24-hour time grid
- All-day events at top
- Timed events positioned by time
- Auto-scrolls to current hour
- Click any slot to add event

### Day View
- Single day with 24-hour grid
- All-day section at top
- More detail space per event
- Shows location and description
- Click to add or edit

### Month View
- Traditional calendar grid
- Events shown as colored chips
- Click day to see details
- Side panel shows selected day's events
- "+X more" indicator for busy days

## Event Types

### Events
- Calendar appointments
- Displayed with green solid background
- Have specific times or all-day
- Sync as VEVENT to external calendars

### Reminders (Todos)
- Tasks with due dates
- Displayed with blue dashed border
- Can have times or be all-day
- Sync as VTODO to external calendars

Both types appear on the calendar with visual distinction.

## Creating Events

Click "Add Event" or click any calendar slot:

| Field | Description |
|-------|-------------|
| Type | Event or Reminder |
| Title | Event name (required) |
| Date | Due date (required) |
| All Day | Toggle for all-day events |
| Start Time | When event starts |
| End Time | When event ends |
| Location | Where it happens |
| Category | Garden, Livestock, Maintenance, etc. |
| Priority | High, Medium, Low |
| Notes | Additional details |

## Task Categories

- Garden
- Livestock
- Maintenance
- Seasonal
- Household
- Other
- Plant Care
- Animal Care
- Equipment
- Custom

## Priority Levels

| Priority | Display |
|----------|---------|
| High (1) | Red accent |
| Medium (2) | Yellow accent |
| Low (3) | Blue accent |

## Recurring Tasks

Tasks can repeat on schedule:
- Daily
- Weekly
- Bi-weekly
- Monthly
- Quarterly
- Bi-annually
- Annually
- Custom interval (every X days)

## Special Features

### Weather-Dependent Tasks
Mark tasks as weather-dependent:
- Skip if conditions are poor
- Optional "skip if rain" flag
- Useful for outdoor work

### Linked Tasks
Tasks can be linked to:
- Specific plants
- Specific animals
- Equipment or vehicles

### Completion Tracking
- Mark complete with timestamp
- Undo completion if needed
- Completed tasks shown with strikethrough
- Stays on calendar for reference

## Automatic Reminders

The system automatically creates tasks for:

### Animal Care
- Worming due dates
- Vaccination due dates
- Hoof trim appointments
- Dental checkups
- Vet visits
- Slaughter dates

### Plant Care
- Watering schedules
- Fertilizing schedules
- Pruning reminders
- Harvest times

### Maintenance
- Vehicle service (by miles, hours, or date)
- Equipment maintenance
- Home maintenance tasks
- Farm area maintenance

## Navigation

| View | Prev/Next | Today Button |
|------|-----------|--------------|
| Month | Previous/Next month | Current month |
| Week | Previous/Next 7 days | Current week |
| Day | Previous/Next day | Today |

## Calendar Sync

Sync with external calendars via CalDAV:
- Bi-directional sync
- Works with iCloud, Nextcloud, Radicale, Proton Calendar
- Events sync as VEVENT
- Reminders sync as VTODO
- Deletions from phone are respected

See [Integrations](Integrations.md) for setup details.
