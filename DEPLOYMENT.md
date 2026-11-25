# Deployment Guide for Near Insanity

## Prerequisites

- Domain: nearinsanity.com pointed to your VPS IP
- Docker and Docker Compose installed on server
- Nginx installed and configured
- Certbot installed for SSL certificates

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

Uses GitHub Actions to automatically deploy when you push to the `main` branch.

**Setup:**
1. Configure GitHub Secrets (see mavicc's `.github/SETUP_SECRETS.md` pattern):
   - `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`
2. Push to `main` — the workflow builds, then SSHes to the server and runs:
   ```bash
   cd /root/src/nearinsanity
   git pull origin main
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

### Method 2: Manual Deployment

Run `./deploy.sh` on the server (pulls `main` and rebuilds the container),
or run the compose commands directly.

The production container (`nearinsanity-web`) serves the built app on host
port **8084**.

## Initial Setup Steps

### 1. Update Nginx Configuration

Add the following to `/etc/nginx/conf.d/apps.conf` on your server:

```nginx
# Near Insanity - HTTP
server {
    listen 80;
    server_name nearinsanity.com www.nearinsanity.com;

    # ACME challenge for Let's Encrypt
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Near Insanity - HTTPS
server {
    listen 443 ssl http2;
    server_name nearinsanity.com www.nearinsanity.com;

    ssl_certificate /etc/letsencrypt/live/nearinsanity.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nearinsanity.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:8084;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Get SSL

```bash
sudo certbot --nginx -d nearinsanity.com -d www.nearinsanity.com
```

### 3. Verify

```bash
sudo nginx -t && sudo systemctl reload nginx
curl https://nearinsanity.com
```