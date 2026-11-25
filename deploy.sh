#!/bin/bash

# Deployment script for Near Insanity Digital Cartoons
# Run this on your production server

set -e

echo "🚀 Deploying Near Insanity..."

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Build and start Docker container
echo "🐳 Building and starting Docker container..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Check if container is running
echo "✅ Checking container status..."
docker ps | grep nearinsanity-web

echo "🎉 Deployment complete!"
echo "Website should be accessible at http://localhost:8084"
echo ""
echo "Next steps:"
echo "1. Test locally: curl http://localhost:8084"
echo "2. Setup SSL: sudo certbot --nginx -d nearinsanity.com -d www.nearinsanity.com"
echo "3. Reload Nginx: sudo nginx -t && sudo systemctl reload nginx"