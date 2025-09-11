@echo off
REM Deployment script for Arzesh ERP on Windows Server
REM Run this script on your Windows server to deploy the application

echo 🚀 Starting Arzesh ERP deployment...

REM Create necessary directories
echo 📁 Creating directories...
if not exist "C:\arzesh-erp" mkdir "C:\arzesh-erp"
if not exist "C:\arzesh-erp\logs" mkdir "C:\arzesh-erp\logs"
if not exist "C:\arzesh-erp\backups" mkdir "C:\arzesh-erp\backups"

REM Copy application files
echo 📋 Copying application files...
xcopy /E /I /Y . "C:\arzesh-erp\"

cd "C:\arzesh-erp"

REM Create environment files
echo ⚙️ Setting up environment...
(
echo DATABASE_URL=postgresql://postgres:ArzeshERP2025!@localhost:5432/arzesh_erp?schema=public
echo DIRECT_URL=postgresql://postgres:ArzeshERP2025!@localhost:5432/arzesh_erp
echo PORT=3001
echo JWT_SECRET=ArzeshERP_JWT_Secret_2025_Production_Key
echo NODE_ENV=production
) > apps\backend\.env

(
echo NEXT_PUBLIC_API_URL=http://91.92.181.146:3001
echo NODE_ENV=production
) > apps\frontend\.env

REM Build and start services
echo 🏗️ Building and starting services...
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 30 /nobreak >nul

REM Run database migrations
echo 🗃️ Running database migrations...
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

REM Check if services are running
echo ✅ Checking services...
timeout /t 10 /nobreak >nul
docker-compose -f docker-compose.prod.yml ps

echo 🎉 Deployment completed!
echo 🌐 Your application should be available at: http://91.92.181.146
echo 📊 Frontend: http://91.92.181.146:3000
echo 🔌 Backend API: http://91.92.181.146:3001
echo 🗄️ PostgreSQL: localhost:5432
echo.
echo 📋 To view logs:
echo    docker-compose -f docker-compose.prod.yml logs -f
echo.
echo 🔄 To restart services:
echo    docker-compose -f docker-compose.prod.yml restart

pause
