#!/bin/bash

echo "Iniciando Aurora System en modo desarrollo..."
docker-compose up -d

echo "Esperando a que los servicios esten listos..."
sleep 10

echo "Ejecutando migraciones..."
./scripts/migrate-all.sh

echo "Aurora System esta listo!"
echo "Frontend: http://localhost:3000"
echo "Auth Service: http://localhost:8001"
echo "Fast Food Service: http://localhost:8002"
echo "Hotel Service: http://localhost:8003"
echo "Pool Service: http://localhost:8004"
echo "Restaurant Service: http://localhost:8005"
echo "Reporting Service: http://localhost:8006"
echo "Notification Service: http://localhost:8007"
