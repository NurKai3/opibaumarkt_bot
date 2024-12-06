# update-bot.sh
#!/bin/bash

echo "Pulling latest changes from GitHub..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Restarting AFK bot..."
pm2 restart OPIBot  # Stelle sicher, dass du PM2 benutzt, um den Bot zu verwalten