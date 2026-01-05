# Animal Management

Track all your animals - from household pets to farm livestock.

## Animal Types

### Pets
Dogs, cats, birds, rabbits, reptiles, and other companion animals.

### Livestock
- Cattle (beef, dairy)
- Sheep
- Goats
- Pigs
- Horses
- Poultry (chickens, ducks, turkeys, geese)
- Other (alpacas, llamas, etc.)

## Animal Records

Each animal can include:

### Basic Information
- Name
- Type and breed
- Color/markings
- Sex
- Tag number
- Microchip number
- Birth date (auto-calculates age)
- Acquisition date
- Status (active/sold/deceased)
- Photo

### Physical Tracking
- Current weight
- Target weight (for livestock)

### Location
- Farm area assignment
- Pasture
- Barn/shelter

### Cold Sensitivity
- Cold sensitive flag
- Minimum temperature tolerance
- Blanket threshold temperature

## Care Schedules

### For All Animals
- **Worming** - Frequency, last date, next due, overdue indicator
- **Vaccination** - Frequency, last date, next due, overdue indicator
- **Vet Visits** - Last visit, vet notes

### For Horses/Hoofed Animals
- **Hoof Trim/Farrier** - Frequency, last date, next due
- Wormer rotation tracking

### For Pets
- **Dental Care** - Frequency, last date, next due

### Custom Care Schedules
Create unlimited custom care types:
- Name the care type
- Set frequency (days) or manual due date
- Track completion
- Works for any recurring care need

## Care Logging

Record care events with details:

| Care Type | What's Recorded |
|-----------|-----------------|
| Worming | Date, product, dosage, notes |
| Vaccination | Date, vaccine type, administered by, notes |
| Hoof Trim | Date, farrier, notes, cost |
| Dental | Date, vet, procedure, notes |
| Vet Visit | Date, reason, treatment, notes |
| Weight | Date, weight, notes |
| Medication | Date, medication, dosage, duration, notes |
| General | Date, description, notes |

## Feed Management

Track feeding for each animal:
- Feed type (hay, grain, pellets, etc.)
- Amount per feeding
- Frequency (daily, twice daily, etc.)
- Special notes

Multiple feeds per animal supported (e.g., morning grain + evening hay).

The Animal Feed Widget on the dashboard shows all animals with their daily feeding requirements.

## Expense Tracking

Track costs per animal:
- Purchase price
- Feed costs
- Veterinary bills
- Farrier/hoof care
- Medicine
- Equipment
- Other expenses

View total expenses and history per animal.

## Livestock Production

For meat animals:
- Set slaughter date
- Assign processor
- Track pickup date
- Record weights:
  - Live weight
  - Hanging weight
  - Final weight
- Calculate cost per pound
- Archive to production records

## Cold Weather Alerts

Animals marked as cold-sensitive get special attention:
- Dashboard shows animals needing blankets
- Based on forecast low vs. blanket threshold
- Integrates with weather alerts

## Care Due Queries

Quick views for animals needing attention:
- Worming due (within X days)
- Vaccination due (within X days)
- Hoof trim due (within X days)
- Dental due (within X days)
- Livestock approaching slaughter date

## Automatic Reminders

Care schedules automatically generate:
- Dashboard notifications
- Calendar events (with CalDAV sync)
- Email reminders (if configured)

Multiple animals with the same due date are grouped into single reminders (e.g., "Worming: 3 animals due").
