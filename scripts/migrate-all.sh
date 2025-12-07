#!/bin/bash

echo "Migrando auth-service..."
docker-compose exec auth-service python manage.py migrate

echo "Migrando fast-food-service..."
docker-compose exec fast-food-service python manage.py migrate

echo "Migrando hotel-service..."
docker-compose exec hotel-service python manage.py migrate

echo "Migrando pool-service..."
docker-compose exec pool-service python manage.py migrate

echo "Migrando restaurant-service..."
docker-compose exec restaurant-service python manage.py migrate

echo "Migrando reporting-service..."
docker-compose exec reporting-service python manage.py migrate

echo "Migrando notification-service..."
docker-compose exec notification-service python manage.py migrate

echo "Todas las migraciones completadas!"
