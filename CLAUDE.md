# Levi Project - Development Guidelines

## Critical Rules

### 1. NEVER Strip Trailing Slashes
The FastAPI backend uses trailing slashes on all routes. The frontend API calls MUST include trailing slashes.
- `/api/plants/` - CORRECT
- `/api/plants` - WRONG (causes 422 errors when routes like `/plants/tags/` get mismatched to `/plants/{id}`)

### 2. NEVER Delete Files Without Backup
Before deleting any file, always:
1. Create a backup first
2. Confirm with user if deleting important files

### 3. Database Location
- Production DB: `/opt/levi/backend/data/levi.db`
- Backups: `/opt/levi/backups/`
- Config uses relative path `./data/levi.db` from WorkingDirectory `/opt/levi/backend`

### 4. Deployment Process
```bash
# 1. Sync frontend source
rsync -avz --exclude 'node_modules' --exclude 'dist' -e "ssh -i /home/n0mad1k/.ssh/levi" /home/n0mad1k/Tools/levi/frontend/ n0mad1k@levi.local:/home/n0mad1k/levi/frontend/

# 2. Build on server
ssh -i /home/n0mad1k/.ssh/levi n0mad1k@levi.local "cd /home/n0mad1k/levi/frontend && npm run build"

# 3. Deploy
ssh -i /home/n0mad1k/.ssh/levi n0mad1k@levi.local "sudo rm -rf /opt/levi/frontend/dist && sudo cp -r /home/n0mad1k/levi/frontend/dist /opt/levi/frontend/ && sudo chown -R www-data:www-data /opt/levi/frontend/dist"

# 4. Sync backend source
rsync -avz --exclude '__pycache__' --exclude 'venv' --exclude 'data' --exclude 'logs' -e "ssh -i /home/n0mad1k/.ssh/levi" /home/n0mad1k/Tools/levi/backend/ n0mad1k@levi.local:/home/n0mad1k/levi/backend/

# 5. Deploy backend
ssh -i /home/n0mad1k/.ssh/levi n0mad1k@levi.local "sudo rsync -av --exclude 'venv' --exclude 'data' --exclude 'logs' --exclude '__pycache__' /home/n0mad1k/levi/backend/ /opt/levi/backend/"

# 6. Restart backend
ssh -i /home/n0mad1k/.ssh/levi n0mad1k@levi.local "sudo systemctl restart levi-backend"
```

### 5. Backend Service
- Service: `levi-backend.service`
- User: `n0mad1k`
- WorkingDirectory: `/opt/levi/backend`
- Logs: `/opt/levi/logs/backend.log` and `/opt/levi/logs/backend-error.log`

### 6. API Structure
- All API endpoints have trailing slashes
- Frontend axios calls to `/api/...` get proxied to backend `http://localhost:8000/...`
- Nginx strips `/api` prefix when proxying

### 7. Testing API Endpoints
```bash
# Via nginx (as frontend sees it)
curl -sLk 'https://localhost/api/plants/'

# Direct to backend
curl -sL 'http://localhost:8000/plants/'
```

## Common Issues

### Plants/Animals not showing
Check if `/api/X/tags/` is returning 422 - means trailing slash was stripped and route mismatched.

### 307 Redirects
The backend's TrailingSlashMiddleware redirects requests without trailing slashes. The frontend should NOT strip trailing slashes - let the backend handle the redirect if needed.

## Session Rules

### 8. Add User Rules to CLAUDE.md
When the user provides new rules or guidelines, add them to this file immediately.

### 9. Add Tasks to Plan File
When the user adds new tasks to the queue, add them to the active plan file so they are tracked and not forgotten.

## Pending Features / Task Queue

### Plant Data Import Feature (In Progress)
- Import plant data from PFAF (pfaf.org) URLs
- User submits URL, backend scrapes and parses data
- Maps to Plant model fields automatically
- Primary source: PFAF, Secondary: Permapeople API
