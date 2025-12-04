# Aurora System

Sistema de gestion empresarial integrado para comida rapida, hotel, piscinas y restaurante.

## Arquitectura

Este proyecto utiliza una arquitectura de microservicios con Docker:

- **auth-service**: Autenticacion y autorizacion centralizada
- **fast-food-service**: Gestion de comida rapida (POS, cocina, reportes)
- **hotel-service**: Gestion hotelera (reservas, habitaciones, check-in/out)
- **pool-service**: Gestion de piscinas (acceso, tarifas, lockers)
- **restaurant-service**: Gestion del restaurante Fortaleza (mesas, reservas, POS)
- **reporting-service**: Reportes consolidados de todos los negocios
- **notification-service**: Notificaciones (email, SMS, push)
- **frontend**: Aplicacion React

## Requisitos

- Docker
- Docker Compose

## Instalacion

1. Clonar el repositorio
2. Levantar los servicios:
```bash
docker-compose up -d
```

3. Ejecutar migraciones (Windows Git Bash o WSL):
```bash
chmod +x scripts/migrate-all.sh
./scripts/migrate-all.sh
```

## Acceso

- **Frontend**: http://localhost:3000
- **Auth Service**: http://localhost:8001
- **Fast Food Service**: http://localhost:8002
- **Hotel Service**: http://localhost:8003
- **Pool Service**: http://localhost:8004
- **Restaurant Service**: http://localhost:8005
- **Reporting Service**: http://localhost:8006
- **Notification Service**: http://localhost:8007

## Licencia

Propietario
