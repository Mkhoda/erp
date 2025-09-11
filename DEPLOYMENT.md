# Arzesh ERP - Production Deployment

## Quick Start

1. **Connect to your server:**
   ```bash
   ssh -p 45 mahdi@91.92.181.146
   ```

2. **Run the auto-setup:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/your-repo/erp/main/deploy.sh -o deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

## What Gets Deployed

### Services
- **PostgreSQL Database** (Port 5432)
- **Backend API** (NestJS on Port 3001)
- **Frontend** (Next.js on Port 3000)
- **Nginx Reverse Proxy** (Port 80)

### Network Ports
- **80**: Main application (via Nginx)
- **3000**: Frontend (direct access)
- **3001**: Backend API (direct access)
- **5432**: PostgreSQL database
- **443**: HTTPS (when SSL is configured)

### URLs After Deployment
- **Main App**: http://91.92.181.146
- **Frontend**: http://91.92.181.146:3000
- **API**: http://91.92.181.146:3001
- **Health Check**: http://91.92.181.146/health

## Database Configuration

### Connection Details
- **Host**: localhost (from server) or 91.92.181.146 (external)
- **Port**: 5432
- **Database**: arzesh_erp
- **Username**: postgres
- **Password**: ArzeshERP2025!

### Initial Setup
The deployment script automatically:
1. Creates the database
2. Runs Prisma migrations
3. Sets up the schema

## File Structure After Deployment

```
/opt/arzesh-erp/
├── docker-compose.prod.yml
├── nginx/
│   └── nginx.conf
├── apps/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── .env.production
│   │   └── uploads/
│   └── frontend/
│       ├── Dockerfile
│       └── .env.production
├── logs/
└── backups/
```

## Management Commands

### Start/Stop Services
```bash
cd /opt/arzesh-erp

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart a specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f db
```

### Database Operations
```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U postgres -d arzesh_erp

# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres arzesh_erp > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres arzesh_erp < backup.sql

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Application Updates
```bash
cd /opt/arzesh-erp

# Pull latest code (if using git)
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## Security Considerations

### Firewall Rules
The deployment opens these ports:
- 22/45: SSH
- 80: HTTP
- 443: HTTPS
- 3000: Frontend
- 3001: Backend API
- 5432: PostgreSQL

### Default Passwords
**Change these immediately after deployment:**
- Database password: `ArzeshERP2025!`
- JWT Secret: `ArzeshERP_JWT_Secret_2025_Production_Key`

### SSL Certificate (Recommended)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get free SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## Monitoring

### Health Checks
- **Application**: http://91.92.181.146/health
- **Database**: `docker-compose -f docker-compose.prod.yml exec db pg_isready`
- **Services**: `docker-compose -f docker-compose.prod.yml ps`

### Resource Usage
```bash
# System resources
htop
df -h
free -h

# Docker resources
docker stats
```

## Backup Strategy

### Automated Backup Script
```bash
#!/bin/bash
# Add to crontab: 0 2 * * * /opt/arzesh-erp/backup.sh

BACKUP_DIR="/opt/arzesh-erp/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
docker-compose -f /opt/arzesh-erp/docker-compose.prod.yml exec -T db pg_dump -U postgres arzesh_erp > $BACKUP_DIR/db_$DATE.sql

# Uploads backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/arzesh-erp/apps/backend/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.prod.yml logs
   
   # Check system resources
   df -h
   free -h
   ```

2. **Database connection issues**
   ```bash
   # Check if database is running
   docker-compose -f docker-compose.prod.yml exec db pg_isready
   
   # Check database logs
   docker-compose -f docker-compose.prod.yml logs db
   ```

3. **High resource usage**
   ```bash
   # Restart services
   docker-compose -f docker-compose.prod.yml restart
   
   # Clean up Docker
   docker system prune -a
   ```

### Reset Everything
```bash
cd /opt/arzesh-erp
docker-compose -f docker-compose.prod.yml down -v
docker system prune -a
./deploy.sh
```

## Support

For issues or questions:
1. Check the logs first
2. Verify all services are running
3. Check system resources
4. Review the troubleshooting section
