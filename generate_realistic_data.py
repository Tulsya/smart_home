# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta
import random

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

print("Generating realistic sensor data...")
now = datetime.utcnow()
points = []

# Базовые значения (реалистичные)
base_temp_room1 = 20.5
base_temp_room2 = 19.0
base_humidity_room1 = 55
base_humidity_room2 = 50

for days_ago in range(7, 0, -1):
    for hour in range(24):
        for minute in range(0, 60, 15):  # Каждые 15 минут
            timestamp = now - timedelta(days=days_ago, hours=hour, minutes=minute)
            
            # Температура меняется плавно (±0.5°C)
            temp1 = base_temp_room1 + random.uniform(-0.5, 0.5)
            temp2 = base_temp_room2 + random.uniform(-0.5, 0.5)
            
            # Влажность меняется плавно (±3%)
            humidity1 = base_humidity_room1 + random.uniform(-3, 3)
            humidity2 = base_humidity_room2 + random.uniform(-3, 3)
            
            # Свет случайный
            light = random.uniform(200, 800)
            
            points.append(Point("sensor_data").tag("sensor_id", "temperature/room1").field("value", round(temp1, 2)).time(timestamp))
            points.append(Point("sensor_data").tag("sensor_id", "temperature/room2").field("value", round(temp2, 2)).time(timestamp))
            points.append(Point("sensor_data").tag("sensor_id", "humidity/room1").field("value", round(humidity1, 2)).time(timestamp))
            points.append(Point("sensor_data").tag("sensor_id", "humidity/room2").field("value", round(humidity2, 2)).time(timestamp))
            points.append(Point("sensor_data").tag("sensor_id", "light/living_room").field("value", round(light, 2)).time(timestamp))

print(f"Writing {len(points)} data points...")
write_api.write(bucket="sensors", records=points)
print(f"Done! Added {len(points)} records")
client.close()
