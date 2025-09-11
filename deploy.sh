#!/bin/bash

# Deployment script for Arzesh ERP
# Run this script on your server to deploy the application

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

print_status "🚀 Starting Arzesh ERP deployment..."

# Create necessary directories
print_status "📁 Creating directories..."
mkdir -p /opt/arzesh-erp
mkdir -p /opt/arzesh-erp/logs
mkdir -p /opt/arzesh-erp/backups
mkdir -p /opt/arzesh-erp/apps/backend/uploads

# Set permissions
print_status "🔐 Setting permissions..."
sudo chown -R $USER:$USER /opt/arzesh-erp

# Install Docker and Docker Compose if not installed
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

if ! command -v docker-compose &> /dev/null; then
    print_status "🐳 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed successfully"
else
    print_success "Docker Compose is already installed"
fi

# Check if we need to restart to apply Docker group changes
if ! docker info > /dev/null 2>&1; then
    print_warning "You may need to log out and log back in for Docker group changes to take effect"
    print_warning "Or run: newgrp docker"
fi

# Copy application files
print_status "📋 Copying application files..."
if [ "$(pwd)" != "/opt/arzesh-erp" ]; then
    cp -r . /opt/arzesh-erp/
    print_success "Application files copied to /opt/arzesh-erp/"
fi

cd /opt/arzesh-erp

# Set up environment
print_status "⚙️ Setting up environment..."
chmod +x setup-env.sh
./setup-env.sh

# Make scripts executable
chmod +x deploy.sh backup.sh healthcheck.sh setup-env.sh

# Build and start services
print_status "🏗️ Building and starting services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
print_status "⏳ Waiting for database to be ready..."
sleep 30

# Check if database is ready
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; then
        print_success "Database is ready!"
        break
    fi
    print_status "Waiting for database... ($i/30)"
    sleep 2
done

# Run database migrations
print_status "🗃️ Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# Check if services are running
print_status "✅ Checking services..."
sleep 10
docker-compose -f docker-compose.prod.yml ps

# Set up cron job for backups
print_status "📅 Setting up backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/arzesh-erp/backup.sh") | crontab -

# Set up cron job for health checks
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/arzesh-erp/healthcheck.sh") | crontab -

print_success "🎉 Deployment completed!"
print_success "🌐 Your application should be available at: http://91.92.181.146"
print_success "📊 Frontend: http://91.92.181.146:3000"
print_success "🔌 Backend API: http://91.92.181.146:3001"
print_success "🗄️ PostgreSQL: localhost:5432"
echo ""
print_status "📋 Useful commands:"
echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   Restart:   docker-compose -f docker-compose.prod.yml restart"
echo "   Stop:      docker-compose -f docker-compose.prod.yml down"
echo "   Backup:    ./backup.sh"
echo "   Health:    ./healthcheck.sh"
