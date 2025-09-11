#!/bin/bash

# Health Check Script for Arzesh ERP
# Checks if all services are running properly

APP_DIR="/opt/arzesh-erp"
LOG_FILE="/opt/arzesh-erp/logs/healthcheck.log"

echo "$(date): Starting health check..." >> $LOG_FILE

cd $APP_DIR

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "$(date): ERROR - Docker is not running!" >> $LOG_FILE
    exit 1
fi

# Check container status
CONTAINERS=$(docker-compose -f docker-compose.prod.yml ps -q)
if [ -z "$CONTAINERS" ]; then
    echo "$(date): ERROR - No containers are running!" >> $LOG_FILE
    exit 1
fi

# Check each service
SERVICES=("db" "backend" "frontend" "nginx")
ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
    STATUS=$(docker-compose -f docker-compose.prod.yml ps $service | grep "Up" | wc -l)
    if [ $STATUS -eq 0 ]; then
        echo "$(date): ERROR - $service is not running!" >> $LOG_FILE
        ALL_HEALTHY=false
    else
        echo "$(date): OK - $service is running" >> $LOG_FILE
    fi
done

# Check frontend response
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" != "200" ]; then
    echo "$(date): ERROR - Frontend not responding (HTTP $FRONTEND_STATUS)" >> $LOG_FILE
    ALL_HEALTHY=false
else
    echo "$(date): OK - Frontend responding" >> $LOG_FILE
fi

# Check backend response
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api)
if [ "$BACKEND_STATUS" != "200" ] && [ "$BACKEND_STATUS" != "404" ]; then
    echo "$(date): WARNING - Backend may not be responding (HTTP $BACKEND_STATUS)" >> $LOG_FILE
else
    echo "$(date): OK - Backend responding" >> $LOG_FILE
fi

# Check database connection
DB_STATUS=$(docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres)
if [[ $DB_STATUS == *"accepting connections"* ]]; then
    echo "$(date): OK - Database accepting connections" >> $LOG_FILE
else
    echo "$(date): ERROR - Database not accepting connections" >> $LOG_FILE
    ALL_HEALTHY=false
fi

if [ "$ALL_HEALTHY" = true ]; then
    echo "$(date): Health check PASSED - All services healthy" >> $LOG_FILE
    exit 0
else
    echo "$(date): Health check FAILED - Some services have issues" >> $LOG_FILE
    exit 1
fi
