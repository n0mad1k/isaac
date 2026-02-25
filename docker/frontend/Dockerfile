# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ .
RUN npm run build

# Stage 2: Serve with nginx + TLS
FROM nginx:1.25-alpine

# Install openssl for self-signed cert generation
RUN apk add --no-cache openssl

# Generate self-signed certificate (matches Pi path: /etc/nginx/ssl/levi.*)
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/levi.key \
      -out /etc/nginx/ssl/levi.crt \
      -subj "/C=US/ST=Local/L=Local/O=Isaac/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,DNS:isaac.local,IP:127.0.0.1"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
