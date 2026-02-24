FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for lxml, cryptography, etc.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy VERSION and CHANGELOG (referenced by backend as parent.parent from routers/)
COPY VERSION CHANGELOG.md ./

# Create data and logs directories (relative to backend working dir)
RUN mkdir -p /app/backend/data /app/backend/logs

# Create non-root user
RUN groupadd -r isaac && useradd -r -g isaac -d /app isaac
RUN chown -R isaac:isaac /app

USER isaac

EXPOSE 8000

WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
