#!/bin/bash

# Universal Deployment script for Arzesh ERP
# Supports both Docker and Native (PM2) deployment
# Run this script on your Ubuntu server

set -e

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

    # Start backend with PM2
    print_status "🚀 Starting backend service..."
    cd ../backend

    # Copy production env file if exists
    if [ -f ".env.production" ]; then
        cp .env.production .env
        print_success "Backend production environment loaded"
    fi

    pm2 delete arzesh-backend 2>/dev/null || true
    pm2 start dist/main.js --name "arzesh-backend" --max-memory-restart 4G --node-args="--max-old-space-size=4096"

    # Start frontend with PM2
    print_status "🚀 Starting frontend service..."
    cd ../frontend

    pm2 delete arzesh-frontend 2>/dev/null || true

    # Use npm start (standard Next.js production mode)
    print_status "Using npm start..."
    pm2 start npm --name "arzesh-frontend" --max-memory-restart 4G --node-args="--max-old-space-size=4096" -- start

    # Install Nginx
    print_status "📦 Installing Nginx..."
    sudo apt install -y nginx

    # Configure Nginx
    print_status "⚙️  Configuring Nginx..."
    sudo tee /etc/nginx/sites-available/arzesh-erp > /dev/null <<'EOF'
server {
    listen 80;
    server_name erp.arzesh.net 172.17.100.13;

    # Frontend
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

    # Backend API
    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

    # Enable site and remove default if exists
    sudo ln -sf /etc/nginx/sites-available/arzesh-erp /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test and restart Nginx
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

    # Set up PM2 to start on boot
    print_status "📅 Setting up PM2 startup..."
    sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
    pm2 save

    # Set up cron job for health checks
    print_status "📅 Setting up health check cron job..."
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/arzesh-erp/healthcheck.sh") | crontab -

    print_success "🎉 Native deployment completed!"
    print_success "🌐 Your application is available at:"
    print_success "   - http://erp.arzesh.net (without port - through Nginx)"
    print_success "   - http://172.17.100.13 (through Nginx)"
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
