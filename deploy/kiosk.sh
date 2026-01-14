#!/bin/bash
# Levi Kiosk Mode Script
# Launches Chromium in kiosk mode displaying the dashboard

# Wait for X to be ready
sleep 5

# Disable screen blanking and power management
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor when idle
unclutter -idle 0.5 -root &

# Remove old session data
rm -rf ~/.config/chromium/Singleton*

# Start Chromium maximized (not kiosk) so on-screen keyboard can appear above
chromium \
    --app=http://localhost \
    --start-maximized \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --no-first-run \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-component-update \
    --check-for-update-interval=31536000 \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --force-renderer-accessibility \
    http://localhost
