# Server Setup and Deployment Guide (Native Deployment - No Docker)

## Server Information
- **Internal IP**: 172.17.100.13
- **Public IP**: 91.92.181.146
- **Port**: 45 (SSH)
- **User**: mahdi
- **Password**: Mahdi5614
- **PostgreSQL**: 172.17.100.12:5432

## Step 1: Connect to Your Server

```bash
ssh -p 45 mahdi@91.92.181.146
```

## Step 2: Prepare the Server

### Update the system (Ubuntu/Debian)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nano ufw
```

### Or for CentOS/RHEL
```bash
sudo yum update -y
sudo yum install -y curl wget git nano firewall-cmd
```

## Step 3: Install Docker and Docker Compose

### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Restart session to apply Docker group changes
```bash
newgrp docker
```

## Step 4: Configure Firewall

### For Ubuntu/Debian (UFW)
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 22/tcp
sudo ufw allow 45/tcp   # SSH port
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # Frontend
sudo ufw allow 3001/tcp # Backend API
sudo ufw allow 5432/tcp # PostgreSQL (optional, for external access)
sudo ufw reload
```

### For CentOS/RHEL (firewalld)
```bash
sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-port=45/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

## Step 5: Upload Your Application

### Option A: Using Git (Recommended)
```bash
cd /opt
sudo git clone https://github.com/Mkhoda/erp.git arzesh-erp
sudo chown -R $USER:$USER /opt/arzesh-erp
cd /opt/arzesh-erp
```

### Option B: Using SCP from your local machine
```bash
# From your local machine (Windows):
# First, zip your project
# Then upload using SCP or WinSCP
scp -P 45 arzesh-erp.zip mahdi@91.92.181.146:/tmp/
```

### Then on the server:
```bash
cd /opt
sudo unzip /tmp/arzesh-erp.zip
sudo mv arzesh-erp-main arzesh-erp  # if extracted with -main suffix
sudo chown -R $USER:$USER /opt/arzesh-erp
```

## Step 6: Deploy the Application (Native)

```bash
cd /opt/arzesh-erp
chmod +x deploy-native.sh
./deploy-native.sh
```

## Step 7: Verify Deployment

### Check if containers are running
```bash
docker ps
```

### Check logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Test the application
```bash
curl http://localhost:3000  # Frontend
curl http://localhost:3001/api/health  # Backend (if health endpoint exists)
```

## Step 8: Access Your Application

- **Main App**: http://172.17.100.13
- **Frontend**: http://172.17.100.13:3000
- **Backend API**: http://172.17.100.13:3001

## Database Access

### Connect to PostgreSQL
```bash
# From external tools (PostgreSQL is on separate server)
# Host: 172.17.100.12
# Port: 5432
# Database: arzesh_erp
# Username: postgres
# Password: ArzeshERP2025!
```

### Backup Database
```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres arzesh_erp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres arzesh_erp < backup_file.sql
```

## Maintenance Commands

### Update application
```bash
cd /opt/arzesh-erp
git pull  # if using git
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### View logs
```bash
docker-compose -f docker-compose.prod.yml logs -f [service_name]
```

### Restart services
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Stop services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Clean up Docker
```bash
docker system prune -a
```

## SSL Certificate (Optional)

### Using Let's Encrypt (Certbot)
```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Troubleshooting

### Check system resources
```bash
htop
df -h
free -h
```

### Check Docker logs
```bash
docker logs arzesh_erp_frontend
docker logs arzesh_erp_backend
docker logs arzesh_erp_db
docker logs arzesh_erp_nginx
```

### Reset everything
```bash
cd /opt/arzesh-erp
docker-compose -f docker-compose.prod.yml down -v
docker system prune -a
./deploy.sh
```
