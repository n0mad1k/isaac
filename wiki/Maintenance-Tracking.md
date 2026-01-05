# Maintenance Tracking

Track maintenance for vehicles, equipment, home, and farm areas.

## Vehicles

### Supported Types
- Cars and trucks
- Tractors
- Trailers
- ATVs/UTVs
- Motorcycles
- Other

### Vehicle Records
- Name and type
- Make, model, year
- VIN number
- License plate
- Color
- Purchase date and price
- Current mileage
- Current hours (for tractors/equipment)
- Photo
- Notes

### Maintenance Schedules

Create maintenance tasks based on:

| Trigger Type | Example |
|--------------|---------|
| Miles | Oil change every 5,000 miles |
| Hours | Service every 100 hours |
| Days | Inspection every 365 days |

Each maintenance task tracks:
- Description
- Frequency (miles/hours/days)
- Last completed (date, mileage, hours)
- Next due (calculated automatically)
- Status (on-time, due soon, overdue)
- Notification preferences

### Common Vehicle Maintenance
- Oil changes
- Tire rotation
- Brake service
- Filter replacements (air, fuel, cabin)
- Fluid checks
- Annual inspection
- Registration renewal
- Battery replacement

### Maintenance Logging

When completing maintenance:
- Date performed
- Mileage at service
- Hours at service
- Cost
- Notes

History is kept for each vehicle.

---

## Equipment

### Supported Types
- Tractors
- Implements (plows, mowers, tillers)
- Tools (power and hand)
- Structures (greenhouses, sheds)
- Sensors and monitors
- Other

### Equipment Records
- Name and type
- Make, model, year
- Serial number
- Purchase date and price
- Current hours
- Photo
- Notes

### Maintenance Schedules

Based on:
- Hours of use
- Days/calendar interval

Each task tracks:
- Description
- Frequency
- Last completed
- Next due
- Status
- Notifications

### Common Equipment Maintenance
- Grease points
- Blade sharpening
- Belt replacement
- Filter cleaning
- Fluid changes
- Calibration
- Winter preparation

---

## Home Maintenance

Track maintenance for your house and structures.

### Categories
- General
- Roof
- Plumbing
- Electrical
- HVAC
- Exterior
- Interior
- Appliances
- Other

### Maintenance Tasks
- Task name and description
- Category
- Frequency (days) or manual due date
- Frequency label (e.g., "Quarterly", "Annual")
- Last completed
- Next due
- Notification preferences

### Common Home Maintenance
- HVAC filter replacement
- Gutter cleaning
- Smoke detector batteries
- Water heater flush
- Septic pumping
- Roof inspection
- Exterior painting
- Weatherstripping

### Completion Logging
- Date completed
- Cost
- Notes

---

## Farm Areas

Track and maintain farm plots and structures.

### Area Types
- Field
- Pasture
- Garden
- Greenhouse
- Orchard
- Barn
- Shelter
- Fence
- Pond
- Road
- Other

### Area Records
- Name and description
- Type
- Location notes
- Size (acres and/or sq ft)
- Soil type
- Irrigation type
- Notes

### Plant/Animal Assignment
- Assign plants to areas
- Assign animals to pastures
- View what's in each area

### Area Maintenance
- Grazing rotation
- Soil amendment
- Irrigation maintenance
- Fence repair
- Seasonal cleanup
- Mowing schedules

Each maintenance task can have:
- Frequency or manual scheduling
- Active months (seasonal)
- Notification preferences

---

## Status Indicators

All maintenance uses consistent status:

| Status | Meaning | Display |
|--------|---------|---------|
| On Time | Not yet due | Green |
| Due Soon | Coming up | Yellow |
| Overdue | Past due | Red |

## Notifications

Each maintenance item can notify via:
- Dashboard (always shows on main screen)
- Calendar (syncs to CalDAV)
- Email (sends reminder)

Configure per-item which channels to use.

## Cost Tracking

All maintenance logs include optional cost field:
- Track spending per vehicle/equipment
- View maintenance cost history
- Calculate total maintenance costs
