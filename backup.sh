#!/bin/bash

# Arzesh ERP Backup Script
# Add to crontab: 0 2 * * * /opt/arzesh-erp/backup.sh

BACKUP_DIR="/opt/arzesh-erp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/arzesh-erp"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Database backup
echo "Backing up database..."
docker-compose -f $APP_DIR/docker-compose.prod.yml exec -T db pg_dump -U postgres arzesh_erp > $BACKUP_DIR/db_$DATE.sql
if [ $? -eq 0 ]; then
    echo "Database backup completed: db_$DATE.sql"
    gzip $BACKUP_DIR/db_$DATE.sql
else
    echo "Database backup failed!"
fi

# Uploads backup
echo "Backing up uploads..."
if [ -d "$APP_DIR/apps/backend/uploads" ]; then
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $APP_DIR/apps/backend uploads
    echo "Uploads backup completed: uploads_$DATE.tar.gz"
fi

# Configuration backup
echo "Backing up configuration..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz -C $APP_DIR \
    docker-compose.prod.yml \
    nginx/nginx.conf \
    apps/backend/.env.production \
    apps/frontend/.env.production

echo "Configuration backup completed: config_$DATE.tar.gz"

# Clean up old backups (keep last 7 days)
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed at $(date)"
echo "Backup files stored in: $BACKUP_DIR"
