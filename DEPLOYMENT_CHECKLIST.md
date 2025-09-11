# Deployment Checklist

## Pre-Deployment
- [ ] Server is accessible via SSH (port 45)
- [ ] Server has sufficient resources (2GB+ RAM, 10GB+ disk)
- [ ] Firewall ports are properly configured

## Files to Copy to Server
Copy the following files to your server at `/opt/arzesh-erp/`:

### Root Directory Files:
- [ ] `docker-compose.prod.yml`
- [ ] `deploy.sh`
- [ ] `backup.sh`
- [ ] `healthcheck.sh`
- [ ] `setup-env.sh`
- [ ] `DEPLOYMENT.md`
- [ ] `SERVER_SETUP.md`
- [ ] `.dockerignore`
- [ ] `package.json`

### Backend Files:
- [ ] `apps/backend/` (entire directory)
  - [ ] `Dockerfile`
  - [ ] `.dockerignore`
  - [ ] `package.json`
  - [ ] `tsconfig.json`
  - [ ] `tsconfig.build.json`
  - [ ] `src/` (entire directory)
  - [ ] `prisma/` (entire directory)
  - [ ] `.env.production`

### Frontend Files:
- [ ] `apps/frontend/` (entire directory)
  - [ ] `Dockerfile`
  - [ ] `.dockerignore`
  - [ ] `package.json`
  - [ ] `next.config.js`
  - [ ] `tailwind.config.js`
  - [ ] `postcss.config.js`
  - [ ] `tsconfig.json`
  - [ ] `middleware.ts`
  - [ ] `app/` (entire directory)
  - [ ] `public/` (entire directory)
  - [ ] `scripts/` (entire directory)
  - [ ] `.env.production`

### Nginx Configuration:
- [ ] `nginx/nginx.conf`

## Deployment Steps
1. [ ] Connect to server: `ssh -p 45 mahdi@91.92.181.146`
2. [ ] Copy files to server
3. [ ] Run: `chmod +x /opt/arzesh-erp/deploy.sh`
4. [ ] Run: `/opt/arzesh-erp/deploy.sh`
5. [ ] Verify deployment

## Post-Deployment Verification
- [ ] Frontend accessible: http://91.92.181.146:3000
- [ ] Backend API accessible: http://91.92.181.146:3001
- [ ] Main app accessible: http://91.92.181.146
- [ ] Database connection working
- [ ] Health check passing: `/opt/arzesh-erp/healthcheck.sh`

## Security Checklist
- [ ] Change default database password
- [ ] Change JWT secret
- [ ] Configure firewall rules
- [ ] Set up SSL certificate (optional)
- [ ] Regular backups scheduled

## Maintenance
- [ ] Backup script is working: `/opt/arzesh-erp/backup.sh`
- [ ] Health monitoring is active
- [ ] Log rotation configured
- [ ] Update procedures documented
