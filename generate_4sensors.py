# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta, timezone
import random

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

print("Generating 4-sensor data (7 days)...")
now = datetime.now(timezone.utc)

sensors_config = {
    "temperature/bedroom": 20.5,
    "temperature/kitchen": 21.5,
    "humidity/bedroom": 55,
    "humidity/kitchen": 60,
}

total = 0
for days_ago in range(7, 0, -1):
    for hour in range(24):
        for minute in range(0, 60, 15):
            timestamp = now - timedelta(days=days_ago, hours=hour, minutes=minute)
            
            for sensor_id, base_value in sensors_config.items():
                if "temperature" in sensor_id:
                    variation = random.uniform(-0.5, 0.5)
                else:
                    variation = random.uniform(-3, 3)
                
                value = base_value + variation
                point = Point("sensor_data").tag("sensor_id", sensor_id).field("value", round(value, 2)).time(timestamp)
                write_api.write(bucket="sensors", record=point)
                total += 1
            
            if total % 100 == 0:
                print(f"  {total} points...")

print(f"✅ Done! {total} records added")
client.close()
