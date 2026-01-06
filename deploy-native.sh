#!/bin/bash

# Native Deployment script for Arzesh ERP (without Docker)
# Run this script on your Ubuntu server to deploy the application natively

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
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status "🚀 Starting Arzesh ERP native deployment..."

# Update system
print_status "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js and npm
print_status "📦 Installing Node.js and npm..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dos2unix to fix line endings
print_status "📦 Installing dos2unix..."
sudo apt install -y dos2unix

# Fix line endings in .env files
print_status "🔧 Fixing line endings in .env files..."
find . -name "*.env" -type f -exec dos2unix {} \;

# Install Nginx
print_status "📦 Installing Nginx..."
sudo apt install -y nginx

# Create application directory
print_status "📁 Creating application directory..."
sudo mkdir -p /opt/arzesh-erp
sudo chown -R $USER:$USER /opt/arzesh-erp

# Copy application files (assuming they are already cloned)
if [ "$(pwd)" != "/opt/arzesh-erp" ]; then
    cp -r . /opt/arzesh-erp/
    print_success "Application files copied to /opt/arzesh-erp/"
fi

cd /opt/arzesh-erp

# Install backend dependencies
print_status "📦 Installing backend dependencies..."
cd apps/backend
npm install

# Run database migrations
print_status "🗃️ Running database migrations..."
npx prisma migrate deploy

# Run seed script
print_status "🌱 Seeding database..."
npx prisma db seed || print_warning "Seed script failed or already seeded"

# Build backend
print_status "🏗️ Building backend..."
npm run build

# Install frontend dependencies
print_status "📦 Installing frontend dependencies..."
cd ../frontend
npm install

# Build frontend
print_status "🏗️ Building frontend..."
npm run build

# Copy public and static files to standalone output
print_status "📋 Copying static assets for standalone build..."
if [ -d ".next/standalone" ]; then
    mkdir -p .next/standalone/public
    mkdir -p .next/standalone/.next/static
    cp -r public/* .next/standalone/public/ 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
    print_success "Static assets copied successfully"
fi

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

# Start frontend with PM2 (Next.js production)
print_status "🚀 Starting frontend service..."
cd ../frontend

# Copy production env file if exists
if [ -f ".env.production" ]; then
    cp .env.production .env
    print_success "Frontend production environment loaded"
fi

pm2 delete arzesh-frontend 2>/dev/null || true

# Use standalone server if available, otherwise use npm start
if [ -f ".next/standalone/server.js" ]; then
    print_status "Using Next.js standalone server..."
    pm2 start .next/standalone/server.js --name "arzesh-frontend" --max-memory-restart 4G --node-args="--max-old-space-size=4096"
else
    print_status "Using npm start..."
    pm2 start npm --name "arzesh-frontend" --max-memory-restart 4G --node-args="--max-old-space-size=4096" -- start
fi

# Configure Nginx
print_status "⚙️ Configuring Nginx..."
sudo tee /etc/nginx/sites-available/arzesh-erp > /dev/null <<EOF
server {
    listen 80;
    server_name 172.17.100.13;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/arzesh-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Set up PM2 to start on boot
print_status "📅 Setting up PM2 startup..."
sudo env PATH=\$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u \$USER --hp /home/\$USER
pm2 save

# Set up cron job for health checks
print_status "📅 Setting up health check cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/arzesh-erp/healthcheck.sh") | crontab -

print_success "🎉 Native deployment completed!"
print_success "🌐 Your application should be available at: http://172.17.100.13"
print_success "📊 Frontend: http://172.17.100.13:3000"
print_success "🔌 Backend API: http://172.17.100.13:3001"
echo ""
print_status "📋 Useful commands:"
echo "   View PM2 processes: pm2 list"
echo "   View logs: pm2 logs"
echo "   Restart backend: pm2 restart arzesh-backend"
echo "   Restart frontend: pm2 restart arzesh-frontend"
echo "   Reload Nginx: sudo systemctl reload nginx"
echo "   Health check: ./healthcheck.sh"