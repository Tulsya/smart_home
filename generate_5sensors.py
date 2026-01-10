# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta, timezone
import random
import math
import time


client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)


print("Generating 6-sensor SMOOTH data...")
now = datetime.now(timezone.utc)


total = 0
for days_ago in range(7, 0, -1):
    for hour in range(24):
        hour_sin = math.sin((hour / 24) * 2 * math.pi)
        
        for minute in range(0, 60, 15):
            timestamp = now - timedelta(days=days_ago, hours=hour, minutes=minute)
            
            temp_bedroom = 20.5 + (hour_sin * 1.5) + random.uniform(-0.2, 0.2)
            temp_kitchen = 21.5 + (hour_sin * 1.5) + random.uniform(-0.2, 0.2)
            humidity_bedroom = 55 + (hour_sin * 3) + random.uniform(-1, 1)
            humidity_kitchen = 60 + (hour_sin * 4) + random.uniform(-1.5, 1.5)
            light_level = 400 + (hour_sin * 300)
            light_level = max(50, min(800, light_level))
            
            # Датчик движения: логика активности по часам
            if 6 <= hour <= 22:
                motion_probability = 0.6 + (abs(hour_sin) * 0.3)
            else:
                motion_probability = 0.1 + (random.uniform(0, 0.15))
            
            motion_detected = float(1 if random.random() < motion_probability else 0)
            
            sensors = [
                ("temperature/bedroom", round(temp_bedroom, 2)),
                ("temperature/kitchen", round(temp_kitchen, 2)),
                ("humidity/bedroom", round(humidity_bedroom, 2)),
                ("humidity/kitchen", round(humidity_kitchen, 2)),
                ("light/living_room", round(light_level, 2)),
                ("motion/hallway", motion_detected),
            ]
            
            for sensor_id, value in sensors:
                point = Point("sensor_data").tag("sensor_id", sensor_id).field("value", value).time(timestamp)
                write_api.write(bucket="sensors", record=point)
                total += 1
            
            if total % 100 == 0:
                print(f"  {total} points...")


print(f"✅ Done! {total} records (6 sensors, smooth data)")
time.sleep(2)
write_api.close()  # ← ЗАКРЫТЬ WRITE API ПЕРЕД CLIENT
time.sleep(1)
client.close()
