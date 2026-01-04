# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta
import random

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

sensors = [
    {"id": "temperature/kitchen", "min": 18, "max": 25},
    {"id": "temperature/bedroom", "min": 16, "max": 22},
    {"id": "humidity/kitchen", "min": 40, "max": 70},
    {"id": "humidity/bedroom", "min": 35, "max": 60},
    {"id": "light/living_room", "min": 100, "max": 1000},
]

print("Generating sensor data...")
now = datetime.utcnow()
points = []

for days_ago in range(7, 0, -1):
    for hour in range(24):
        timestamp = now - timedelta(days=days_ago, hours=hour)
        
        for sensor in sensors:
            base_value = (sensor["min"] + sensor["max"]) / 2
            variation = random.uniform(-5, 5)
            value = base_value + variation
            value = max(sensor["min"], min(sensor["max"], value))
            
            point = Point("sensor_data") \
                .tag("sensor_id", sensor["id"]) \
                .tag("building_id", "1") \
                .field("value", round(value, 2)) \
                .time(timestamp)
            
            points.append(point)

print(f"Writing {len(points)} data points...")
write_api.write(bucket="sensors", records=points)

print(f"Done! Added {len(points)} records")
client.close()
