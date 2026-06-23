# Isaac - Docker Deployment

Run Isaac using Docker Compose. This is the easiest way to get started.

## Quick Start

```bash
cd docker

# Create your environment file
cp .env.example .env
# Edit .env with your settings (at minimum, set SECRET_KEY)

# Build and start
docker compose up -d --build

# Open https://localhost in your browser (accept the self-signed cert warning)
# Complete the setup wizard to create your admin account
```

## Environment Variables

See `.env.example` for all available options. Key settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Encryption key for sensitive data |
| `TIMEZONE` | No | Your timezone (default: America/New_York) |
| `LATITUDE` / `LONGITUDE` | No | Your location for weather/sunrise data |
| `ISAAC_PORT` | No | HTTPS port for the web UI (default: 443) |

## Data Persistence

All data is stored in Docker volumes:

- **isaac-data** — Database, photos, uploads
- **isaac-logs** — Application logs

Data persists across container restarts and rebuilds.

### Backup

```bash
# Backup the database
docker compose exec backend cp data/levi.db data/levi.db.backup
docker compose cp backend:/app/backend/data/levi.db.backup ./backup-$(date +%Y%m%d).db

# Backup the entire data volume
docker run --rm -v isaac-data:/data -v $(pwd):/backup alpine tar czf /backup/isaac-data-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore

```bash
# Restore database from backup
docker compose cp ./backup-20260224.db backend:/app/backend/data/levi.db
docker compose restart backend
```

## Updating

```bash
cd docker
git pull
docker compose up -d --build
```

The database auto-migrates on startup — no manual migration steps needed.

## Stopping

```bash
docker compose down        # Stop containers (data preserved)
docker compose down -v     # Stop and DELETE all data
```

## Architecture

```
Browser → nginx:443 (frontend container, self-signed TLS)
            ├── /api/* → proxy to backend:8000
            └── /* → serve React SPA

Backend container (port 8000)
    └── /app/backend/data/ (Docker volume)
            ├── levi.db          (SQLite database)
            ├── plant_photos/    (uploaded photos)
            ├── animal_photos/
            └── ...
```
