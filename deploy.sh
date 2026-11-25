#!/bin/bash

# Deployment script for Near Insanity Digital Cartoons
# Run this on your production server

set -e

echo "🚀 Deploying Near Insanity..."

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Build and start Docker containers (frontend + backend)
echo "🐳 Building and starting Docker containers..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Apply any pending Django migrations
echo "🗄️  Applying Django migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

# Check containers are running
echo "✅ Checking container status..."
docker ps | grep nearinsanity

echo "🎉 Deployment complete!"
echo "Website should be accessible at http://localhost:8084"
echo ""
echo "Next steps:"
echo "1. Test locally: curl http://localhost:8084"
echo "2. Setup SSL: sudo certbot --nginx -d nearinsanity.com -d www.nearinsanity.com"
echo "3. Reload Nginx: sudo nginx -t && sudo systemctl reload nginx"