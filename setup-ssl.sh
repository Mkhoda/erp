#!/bin/bash

# SSL Setup Script for Arzesh ERP
# Domain: erp.arzesh.net

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

DOMAIN="erp.arzesh.net"
EMAIL="admin@arzesh.net"  # تغییر بدید به ایمیل واقعی

print_status "🔐 Starting SSL setup for $DOMAIN..."

# Install Certbot
print_status "📦 Installing Certbot..."
sudo apt update
sudo apt install -y certbot

# Create directory for Let's Encrypt verification
print_status "📁 Creating directories..."
sudo mkdir -p /var/www/certbot

# Backup existing Nginx config
print_status "💾 Backing up Nginx config..."
if [ -f /etc/nginx/sites-available/arzesh-erp ]; then
    sudo cp /etc/nginx/sites-available/arzesh-erp /etc/nginx/sites-available/arzesh-erp.backup
    print_success "Backup created"
fi

# Create temporary Nginx config for HTTP only (for initial SSL verification)
print_status "⚙️ Creating temporary Nginx config..."
sudo tee /etc/nginx/sites-available/arzesh-erp > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Temporary proxy to app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site and test Nginx
sudo ln -sf /etc/nginx/sites-available/arzesh-erp /etc/nginx/sites-enabled/
sudo nginx -t

# Reload Nginx
print_status "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# Get SSL certificate
print_status "🔐 Obtaining SSL certificate from Let's Encrypt..."
print_warning "Make sure DNS is pointed to this server!"
echo ""
read -p "Press Enter to continue when DNS is ready..."

sudo certbot certonly --webroot \
    -w /var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal

if [ $? -eq 0 ]; then
    print_success "SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    exit 1
fi

# Copy production Nginx config with SSL
print_status "⚙️ Applying production Nginx config with SSL..."
sudo cp /opt/arzesh-erp/nginx/nginx-production.conf /etc/nginx/sites-available/arzesh-erp

# Test Nginx configuration
sudo nginx -t

if [ $? -eq 0 ]; then
    print_success "Nginx configuration is valid"
    
    # Reload Nginx
    sudo systemctl reload nginx
    print_success "Nginx reloaded with SSL enabled"
else
    print_error "Nginx configuration test failed"
    print_warning "Restoring backup..."
    sudo cp /etc/nginx/sites-available/arzesh-erp.backup /etc/nginx/sites-available/arzesh-erp
    sudo systemctl reload nginx
    exit 1
fi

# Set up auto-renewal
print_status "🔄 Setting up auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run

print_success "🎉 SSL setup completed successfully!"
echo ""
print_success "🌐 Your application is now available at:"
print_success "   https://$DOMAIN"
echo ""
print_status "📋 Useful commands:"
echo "   Renew certificate: sudo certbot renew"
echo "   Check certificate: sudo certbot certificates"
echo "   Reload Nginx: sudo systemctl reload nginx"
echo "   View Nginx logs: sudo tail -f /var/log/nginx/error.log"
