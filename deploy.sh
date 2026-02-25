#!/bin/bash

# Universal Deployment script for Arzesh ERP
# Supports both Docker and Native (PM2) deployment
# Run this script on your Ubuntu server

set -e

# Refuse to run as root — running as root creates a root PM2 daemon that
# hijacks ports 3000/3001 and conflicts with the app-user PM2 instance.
if [ "$(id -u)" -eq 0 ]; then
    echo "❌ Do not run this script as root or with sudo."
    echo "   Run as the application user (e.g. mahdi): bash deploy.sh"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

urlencode() {
    local raw="$1"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$raw"
    else
        echo "$raw"
    fi
}

configure_env_files() {
    print_status "⚙️  Configuring environment files..."

    local server_ip domain_name db_host db_port db_name db_user db_password jwt_secret encoded_db_password api_url cors_origin

    # Hardcoded deployment values
    server_ip="91.92.181.146"
    domain_name="erp.arzesh.net"
    db_host="172.17.100.12"
    db_port="5432"
    db_name="arzesh_erp"
    db_user="postgres"
    db_password="123m123M"
    jwt_secret="ArzeshERP_JWT_Secret_2025_Production_Key"

    encoded_db_password=$(urlencode "$db_password")

    # choose api_url based on whether domain resolves and cert will be used
    if [ -n "$domain_name" ]; then
        # prefer http; upgrade to https later if certificate is obtained
        api_url="http://${domain_name}/api"
    else
        api_url="http://${server_ip}/api"
    fi

    # by default only http origins are listed; https schemes can be added by
    # setting CORS_INCLUDE_HTTPS=1 in the environment before running deploy.
    cors_origin="http://${server_ip}:3000,http://${server_ip},http://localhost:3000,http://${domain_name}"
    if [ "${CORS_INCLUDE_HTTPS}" = "1" ]; then
        cors_origin+=",https://${domain_name}"
    fi

    cat > apps/backend/.env.production <<EOF
DATABASE_URL=postgresql://${db_user}:${encoded_db_password}@${db_host}:${db_port}/${db_name}?schema=public
DIRECT_URL=postgresql://${db_user}:${encoded_db_password}@${db_host}:${db_port}/${db_name}
PORT=3001
JWT_SECRET=${jwt_secret}
NODE_ENV=production

# File upload settings
MAX_FILE_SIZE=10485760
UPLOAD_DIRECTORY=uploads

# CORS settings
CORS_ORIGIN=${cors_origin}

# Security settings
BCRYPT_ROUNDS=12
JWT_EXPIRATION=24h
REFRESH_TOKEN_EXPIRATION=7d
EOF

    cp apps/backend/.env.production apps/backend/.env

    cat > apps/frontend/.env.production <<EOF
NEXT_PUBLIC_API_URL=${api_url}
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# PWA settings
NEXT_PUBLIC_PWA_ENABLED=true

# Application settings
NEXT_PUBLIC_APP_NAME=Arzesh ERP
NEXT_PUBLIC_APP_VERSION=1.0.0
EOF

    cp apps/frontend/.env.production apps/frontend/.env

    print_success "Environment files updated: apps/backend/.env(.production), apps/frontend/.env(.production)"
}

free_port() {
    local port="$1"
    print_status "🧹 Releasing port ${port} if occupied..."

    # Try graceful kill (non-root processes)
    fuser -k "${port}/tcp" 2>/dev/null || true

    # Use sudo lsof to catch root-owned processes (invisible to fuser without sudo)
    local root_pids
    root_pids=$(sudo lsof -ti ":${port}" 2>/dev/null || true)
    if [ -n "$root_pids" ]; then
        echo "$root_pids" | xargs -r sudo kill -9 2>/dev/null || true
    fi

    # Force kill any remaining listener PID from ss (fallback)
    local pids
    pids=$(ss -ltnp 2>/dev/null | awk "/:${port} / {print \$NF}" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs -r sudo kill -9 2>/dev/null || true
    fi

    sleep 1
}

free_port_3000() { free_port 3000; }

# Ask deployment method
print_status "🚀 Arzesh ERP Deployment Script"
echo ""
echo "Choose deployment method:"
echo "1) Native (PM2 + Nginx) - Recommended"
echo "2) Docker Compose"
echo ""
read -p "Enter your choice (1 or 2): " DEPLOY_METHOD

if [ "$DEPLOY_METHOD" != "1" ] && [ "$DEPLOY_METHOD" != "2" ]; then
    print_error "Invalid choice. Exiting."
    exit 1
fi

###########################################
# COMMON SETUP
###########################################

print_status "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dos2unix
print_status "📦 Installing dos2unix..."
sudo apt install -y dos2unix

# Fix line endings in .env files
print_status "🔧 Fixing line endings in .env files..."
find . -name "*.env" -type f -exec dos2unix {} \; 2>/dev/null || true

# Create application directory
print_status "📁 Creating application directory..."
sudo mkdir -p /opt/arzesh-erp
sudo chown -R $USER:$USER /opt/arzesh-erp

# Copy application files if not already there
if [ "$(pwd)" != "/opt/arzesh-erp" ]; then
    print_status "📋 Copying application files..."
    cp -r . /opt/arzesh-erp/
    print_success "Application files copied to /opt/arzesh-erp/"
fi

cd /opt/arzesh-erp

# Generate env files automatically for this deployment
configure_env_files

###########################################
# NATIVE DEPLOYMENT (PM2)
###########################################

if [ "$DEPLOY_METHOD" == "1" ]; then
    print_status "🔧 Starting Native Deployment (PM2 + Nginx)..."

    # Install Node.js 20 LTS
    print_status "📦 Installing Node.js 20 LTS and npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Verify Node.js version
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"

    # Configure npm for better network handling
    print_status "⚙️  Configuring npm for network resilience..."
    npm config set fetch-timeout 600000
    npm config set fetch-retries 10
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set maxsockets 10
    
    # Try alternative registry if default fails
    print_status "📝 Setting up npm registry..."
    npm config set registry https://registry.npmjs.org/
    
    # Install PM2 globally if not installed
    if ! command -v pm2 &> /dev/null; then
        print_status "📦 Installing PM2..."
        npm install -g pm2
    fi

    # Clean old installations
    print_status "🧹 Cleaning old node_modules..."
    rm -rf node_modules apps/*/node_modules package-lock.json apps/*/package-lock.json

    # Install backend dependencies
    print_status "📦 Installing backend dependencies..."
    cd apps/backend
    
    # Try with retries
    MAX_RETRIES=3
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if npm install --legacy-peer-deps --no-audit --prefer-offline; then
            print_success "Backend dependencies installed"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                print_warning "Installation failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep 10
                npm cache clean --force
            else
                print_error "Failed to install backend dependencies after $MAX_RETRIES attempts"
                print_warning "Try manually: cd apps/backend && npm install --legacy-peer-deps"
                exit 1
            fi
        fi
    done

    # Run database migrations
    print_status "🗃️  Running database migrations..."
    npx prisma migrate deploy

    # Run seed script (idempotent)
    print_status "🌱 Seeding database..."
    npx prisma db seed || print_warning "Seed script failed or already seeded"

    # Build backend
    print_status "🏗️  Building backend..."
    npm run build

    # Install frontend dependencies
    print_status "📦 Installing frontend dependencies..."
    cd ../frontend
    
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if npm install --legacy-peer-deps --no-audit --prefer-offline; then
            print_success "Frontend dependencies installed"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                print_warning "Installation failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep 10
                npm cache clean --force
            else
                print_error "Failed to install frontend dependencies after $MAX_RETRIES attempts"
                print_warning "Try manually: cd apps/frontend && npm install --legacy-peer-deps"
                exit 1
            fi
        fi
    done

    # Copy production env file BEFORE building so Next.js bakes correct API URL
    if [ -f ".env.production" ]; then
        cp .env.production .env
        print_success "Frontend production environment loaded"
    fi

    # Build frontend
    print_status "🏗️  Building frontend..."
    npm run build

    # Grant nginx (www-data) read access to static assets served via alias
    print_status "🔐 Setting static asset permissions for nginx..."
    sudo chmod -R o+rX /opt/arzesh-erp/apps/frontend/.next/static/ 2>/dev/null || true
    sudo chmod o+rx /opt/arzesh-erp/apps/frontend/.next/ 2>/dev/null || true
    sudo chmod o+rx /opt/arzesh-erp/apps/frontend/ 2>/dev/null || true
    sudo chmod o+rx /opt/arzesh-erp/apps/ 2>/dev/null || true
    sudo chmod o+rx /opt/arzesh-erp/ 2>/dev/null || true

    # Start backend with PM2
    print_status "🚀 Starting backend service..."
    cd ../backend

    # Copy production env file if exists
    if [ -f ".env.production" ]; then
        cp .env.production .env
        print_success "Backend production environment loaded"
    fi

    free_port 3001
    pm2 delete arzesh-backend 2>/dev/null || true
    pm2 start dist/main.js --name "arzesh-backend" --max-memory-restart 4G --node-args="--max-old-space-size=4096"

    # Start frontend with PM2
    print_status "🚀 Starting frontend service..."
    cd ../frontend

    # Kill anything still holding port 3000 (e.g. stale process from previous deploy)
    free_port_3000

    pm2 delete arzesh-frontend 2>/dev/null || true

    # Prefer standalone server produced by output:'standalone' in next.config.js
    STANDALONE_SERVER=".next/standalone/server.js"
    if [ -f "$STANDALONE_SERVER" ]; then
        print_status "Using standalone server (output: standalone)..."
        # Copy public & static assets required by standalone server
        cp -r public .next/standalone/public 2>/dev/null || true
        mkdir -p .next/standalone/.next/static
        cp -r .next/static/. .next/standalone/.next/static/ 2>/dev/null || true
        PORT=3000 HOSTNAME=0.0.0.0 pm2 start "$STANDALONE_SERVER" \
            --name "arzesh-frontend" \
            --max-memory-restart 4G \
            --node-args="--max-old-space-size=4096"
    else
        print_status "Using npm start (no standalone output found)..."
        PORT=3000 HOSTNAME=0.0.0.0 pm2 start npm --name "arzesh-frontend" --max-memory-restart 4G --node-args="--max-old-space-size=4096" -- start
    fi

    # Install Nginx and Certbot
    print_status "📦 Installing Nginx and Certbot..."
    sudo apt install -y nginx certbot python3-certbot-nginx

    DOMAIN="erp.arzesh.net"
    CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    CERT_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

    # allow overriding paths when using self-signed
    export CERT_PATH CERT_KEY

    # Write HTTP-only config first so certbot can complete domain challenge
    print_status "⚙️  Writing initial HTTP config for certificate issuance..."
    sudo mkdir -p /var/www/certbot
    sudo tee /etc/nginx/sites-available/arzesh-erp > /dev/null <<'NGINXEOF'
server {
    listen 80;
    server_name erp.arzesh.net 91.92.181.146 172.17.100.13;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { proxy_pass http://localhost:3000; }
}
NGINXEOF

    sudo ln -sf /etc/nginx/sites-available/arzesh-erp /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx

    # Obtain SSL certificate from Let's Encrypt (skip if already exists or domain doesn't resolve)
    if [ ! -f "$CERT_PATH" ]; then
        # check DNS A/AAAA record
        if ! host "$DOMAIN" >/dev/null 2>&1; then
            print_warning "Domain $DOMAIN does not resolve publicly, skipping Let's Encrypt. Generating self-signed cert instead."
            sudo mkdir -p /etc/ssl/private /etc/ssl/certs
            sudo openssl req -x509 -nodes -days 365 \
              -newkey rsa:2048 \
              -keyout /etc/ssl/private/arzesh.key \
              -out /etc/ssl/certs/arzesh.crt \
              -subj "/CN=$DOMAIN" 2>/dev/null
            CERT_PATH="/etc/ssl/certs/arzesh.crt"
            CERT_KEY="/etc/ssl/private/arzesh.key"
        else
            print_status "🔐 Obtaining SSL certificate for $DOMAIN via Let's Encrypt..."
            if sudo certbot certonly --webroot -w /var/www/certbot \
                -d "$DOMAIN" \
                --non-interactive --agree-tos \
                --email admin@arzesh.net \
                --no-eff-email; then
                print_success "SSL certificate obtained"
            else
                print_warning "Certbot failed — ensure port 80 is open and DNS for $DOMAIN points to this server. HTTP will still work."
            fi
        fi
    else
        print_success "SSL certificate already exists for $DOMAIN"
    fi

    # Write full nginx config: HTTP→HTTPS redirect for domain, direct HTTP for IPs, HTTPS server
    # use DISABLE_HTTP_REDIRECT=1 to keep the domain on plain HTTP
    print_status "⚙️  Writing full Nginx config (HTTP + HTTPS)..."
    if [ "${DISABLE_HTTP_REDIRECT}" = "1" ]; then
        cat <<'NGINXEOF' | sudo tee /etc/nginx/sites-available/arzesh-erp >/dev/null
# HTTP access for domain (redirect disabled)
server {
    listen 80;
    server_name erp.arzesh.net;
    client_max_body_size 100M;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

NGINXEOF
    else
        cat <<'NGINXEOF' | sudo tee /etc/nginx/sites-available/arzesh-erp >/dev/null
# Redirect HTTP → HTTPS for the domain name
server {
    listen 80;
    server_name erp.arzesh.net;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

NGINXEOF
    fi

    # Append HTTP access via IP (no SSL cert issued for raw IPs)
    cat <<'NGINXIP' | sudo tee -a /etc/nginx/sites-available/arzesh-erp >/dev/null
server {
    listen 80;
    server_name 91.92.181.146 172.17.100.13;
    client_max_body_size 100M;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXIP

    # Append HTTPS server block only when a valid certificate exists
    if [ -f "$CERT_PATH" ]; then
        cat <<NGINXHTTPS | sudo tee -a /etc/nginx/sites-available/arzesh-erp >/dev/null
# HTTPS — main secure server for the domain
server {
    listen 443 ssl;
    server_name erp.arzesh.net;
    client_max_body_size 100M;

    ssl_certificate     ${CERT_PATH};
    ssl_certificate_key ${CERT_KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    location /uploads {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
NGINXHTTPS
        print_success "HTTPS server block written (cert: $CERT_PATH)"
    else
        print_warning "No SSL cert found — HTTPS server block skipped; site runs HTTP-only"
    fi

    # Test and reload Nginx
    print_status "🔍 Testing Nginx configuration..."
    if sudo nginx -t; then
        print_success "Nginx configuration is valid"
        print_status "🔄 Restarting Nginx..."
        sudo systemctl restart nginx
        print_success "Nginx restarted successfully"
    else
        print_error "Nginx configuration test failed!"
        exit 1
    fi

    # Set up automatic SSL certificate renewal
    print_status "🔄 Setting up SSL auto-renewal..."
    (crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -
    print_success "SSL auto-renewal scheduled (daily at 3am)"

    # Set up PM2 to start on boot
    print_status "📅 Setting up PM2 startup..."
    sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
    pm2 save

    # Set up cron job for health checks
    print_status "📅 Setting up health check cron job..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/arzesh-erp/healthcheck.sh") | crontab -

    print_success "🎉 Native deployment completed!"
    print_success "🌐 Your application is available at:"
    print_success "   - https://erp.arzesh.net (HTTPS — if SSL cert was issued)"
    print_success "   - http://erp.arzesh.net  (redirects to HTTPS)"
    print_success "   - http://172.17.100.13   (direct IP — HTTP only)"
    echo ""
    print_status "📊 Direct access (for debugging):"
    print_status "   - Frontend: http://localhost:3000"
    print_status "   - Backend API: http://localhost:3001"
    echo ""
    print_status "📋 Useful commands:"
    echo "   View PM2 processes: pm2 list"
    echo "   View logs: pm2 logs"
    echo "   Restart backend: pm2 restart arzesh-backend"
    echo "   Restart frontend: pm2 restart arzesh-frontend"
    echo "   Reload Nginx: sudo systemctl reload nginx"
    echo "   Health check: ./healthcheck.sh"

###########################################
# DOCKER DEPLOYMENT
###########################################

elif [ "$DEPLOY_METHOD" == "2" ]; then
    print_status "🐳 Starting Docker Deployment..."

    # Install Docker if not installed
    if ! command -v docker &> /dev/null; then
        print_status "🐳 Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        print_success "Docker installed successfully"
    else
        print_success "Docker is already installed"
    fi

    # Install Docker Compose if not installed
    if ! command -v docker-compose &> /dev/null; then
        print_status "🐳 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installed successfully"
    else
        print_success "Docker Compose is already installed"
    fi

    # Check if we need to restart
    if ! docker info > /dev/null 2>&1; then
        print_warning "You may need to log out and log back in for Docker group changes to take effect"
        print_warning "Or run: newgrp docker"
    fi

    # Build and start services
    print_status "🏗️  Building and starting Docker services..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml build
    docker-compose -f docker-compose.prod.yml up -d

    print_success "🎉 Docker deployment completed!"
    print_success "🌐 Your application should be available at: http://172.17.100.13"
    echo ""
    print_status "📋 Useful commands:"
    echo "   View containers: docker ps"
    echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Restart services: docker-compose -f docker-compose.prod.yml restart"
    echo "   Stop services: docker-compose -f docker-compose.prod.yml down"
fi
