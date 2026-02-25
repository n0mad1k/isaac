#!/bin/bash
# Isaac Kiosk - Minimal X11 + Chromium
# Displays the dashboard in fullscreen kiosk mode

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide cursor after 0.5 seconds of inactivity
unclutter -idle 0.5 -root &

# Start window manager in background (required for minimal X11 setup)
openbox &

# Wait for backend to be ready
sleep 5

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --enable-features=OverlayScrollbar \
    --start-fullscreen \
    --ignore-certificate-errors \
    --disable-translate \
    --disable-features=TranslateUI \
    --disk-cache-dir=/tmp/chromium-cache \
    https://localhost || \
chromium \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --enable-features=OverlayScrollbar \
    --start-fullscreen \
    --ignore-certificate-errors \
    --disable-translate \
    --disable-features=TranslateUI \
    --disk-cache-dir=/tmp/chromium-cache \
    https://localhost
