# Quick Copy Commands for Deployment

## Using SCP from Windows (run from your project directory):

### Copy entire project:
```cmd
scp -P 45 -r . mahdi@91.92.181.146:/tmp/arzesh-erp
```

### Then on server, move to proper location:
```bash
sudo mv /tmp/arzesh-erp /opt/
sudo chown -R mahdi:mahdi /opt/arzesh-erp
```

## Using WinSCP:
1. Host: 91.92.181.146
2. Port: 45
3. Username: mahdi
4. Password: Mahdi5614
5. Upload entire project folder to `/opt/arzesh-erp`

## Using Git (if project is on GitHub):
```bash
cd /opt
sudo git clone https://github.com/Mkhoda/erp.git arzesh-erp
sudo chown -R mahdi:mahdi /opt/arzesh-erp
```

## Essential Files Only (if you want to copy manually):

### Create a zip with only deployment files:
From your project root, create a zip with these files:
- docker-compose.prod.yml
- deploy.sh
- backup.sh
- healthcheck.sh
- setup-env.sh
- nginx/nginx.conf
- apps/backend/ (entire folder)
- apps/frontend/ (entire folder)
- package.json

### Upload command:
```cmd
scp -P 45 deployment.zip mahdi@91.92.181.146:/tmp/
```

### Extract on server:
```bash
cd /opt
sudo unzip /tmp/deployment.zip -d arzesh-erp
sudo chown -R mahdi:mahdi /opt/arzesh-erp
```
