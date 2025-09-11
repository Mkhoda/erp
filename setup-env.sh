#!/bin/bash

# Environment Setup Script for Arzesh ERP
# This script sets up the production environment files

APP_DIR="/opt/arzesh-erp"

echo "Setting up production environment..."

# Create backend .env file
cat > $APP_DIR/apps/backend/.env << EOF
DATABASE_URL=postgresql://postgres:ArzeshERP2025!@db:5432/arzesh_erp?schema=public
DIRECT_URL=postgresql://postgres:ArzeshERP2025!@db:5432/arzesh_erp
PORT=3001
JWT_SECRET=ArzeshERP_JWT_Secret_2025_Production_Key
NODE_ENV=production

# File upload settings
MAX_FILE_SIZE=10485760
UPLOAD_DIRECTORY=uploads

# CORS settings
CORS_ORIGIN=http://91.92.181.146:3000,http://91.92.181.146,http://localhost:3000

# Security settings
BCRYPT_ROUNDS=12
JWT_EXPIRATION=24h
REFRESH_TOKEN_EXPIRATION=7d
EOF

# Create frontend .env file
cat > $APP_DIR/apps/frontend/.env << EOF
NEXT_PUBLIC_API_URL=http://91.92.181.146:3001
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# PWA settings
NEXT_PUBLIC_PWA_ENABLED=true

# Application settings
NEXT_PUBLIC_APP_NAME=Arzesh ERP
NEXT_PUBLIC_APP_VERSION=1.0.0
EOF

echo "Environment files created successfully!"
echo "Backend .env: $APP_DIR/apps/backend/.env"
echo "Frontend .env: $APP_DIR/apps/frontend/.env"

# Set proper permissions
chmod 600 $APP_DIR/apps/backend/.env
chmod 600 $APP_DIR/apps/frontend/.env

echo "Environment setup completed!"
