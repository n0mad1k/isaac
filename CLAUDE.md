# Claude Code Instructions for Isaac/Levi Project

## Deployment

**ALWAYS use the deploy script to deploy changes:**
```bash
/home/n0mad1k/Tools/levi/deploy.sh
```

**NEVER run rsync manually** - the deploy script properly excludes:
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

- `backend/routers/tasks.py` - Task completion updates source entities
- `backend/services/auto_reminders.py` - Auto-generated task notes format: `auto:source_type:source_id`
- `frontend/src/components/TaskList.jsx` - Task display with collapsible completed items

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
