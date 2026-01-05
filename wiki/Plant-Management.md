# Plant Management

Isaac provides comprehensive plant tracking for your garden, orchard, and farm.

## Plant Database

Each plant record can include:

### Basic Information
- Name, Latin name, variety
- Source (where acquired)
- Location on property
- Date added
- Tags for organization

### Growing Requirements
- USDA grow zones
- Sun requirement (full sun, partial shade, full shade)
- Soil requirements and pH preferences
- Spacing and row spacing
- Size when full grown
- Growth rate

### Temperature Tolerance
- Minimum temperature tolerance
- Frost sensitivity (yes/no)
- Cold cover threshold (when to protect)
- Heat tolerance
- Drought tolerance
- Salt tolerance

### Care Schedules
- **Watering** - Frequency in days, last watered, next due
- **Fertilizing** - Frequency in days, last fertilized, next due
- **Pruning** - Frequency and preferred months

### Production
- Harvest months
- Harvest frequency
- Harvest methods
- Uses (culinary, medicinal, ornamental)

### Additional Info
- Propagation methods
- Known hazards
- Special considerations
- Notes and references

## Care Logging

Record care activities with full history:

| Care Type | What's Recorded |
|-----------|-----------------|
| Watering | Date, notes |
| Fertilizing | Date, product, quantity, notes |
| Pruning | Date, notes |
| Treatment/Spray | Date, product, notes |

Care logs automatically update the plant's "last cared" dates and recalculate next due dates.

## Automated Reminders

Based on care schedules, Isaac automatically:
- Calculates next watering/fertilizing dates
- Creates calendar reminders
- Sends email notifications (if configured)
- Shows due items on dashboard

Reminders are season-aware and can have different schedules per season.

## Tags

Organize plants with custom tags:
- Create tags with custom colors
- Filter plant list by tags
- Examples: "Front Yard", "Fruit Trees", "Native", "Needs Attention"

## Plant Import

Import plant data from reference databases:

### Supported Sources
- **PFAF** (Plants for a Future) - pfaf.org
- **Permapeople** - permapeople.org

### Import Process
1. Paste the URL of a plant page
2. Preview extracted data
3. Review and edit if needed
4. Create plant record

### Auto-Extracted Fields
- Name and Latin name
- Grow zones
- Sun and soil requirements
- Size and growth rate
- Minimum temperature
- Frost sensitivity
- Uses and hazards
- Propagation methods

## Frost Protection

Plants marked as frost-sensitive are tracked for cold weather:
- Dashboard widget shows plants needing protection
- Based on forecast low temperatures
- Uses configurable buffer for forecast error
- Integrates with weather alerts

## Harvest Tracking

Record harvests with:
- Date
- Quantity and unit (lbs, kg, count, bushels, etc.)
- Quality rating (excellent, good, fair, poor)
- Notes

Harvest history is viewable per plant and in production reports.

## Quick Actions

From the plant list:
- Filter by tag, sun requirement, water needs
- Search by name
- View frost-sensitive plants
- See plants needing water today
- See plants needing fertilizer
