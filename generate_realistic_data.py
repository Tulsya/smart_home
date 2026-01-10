# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timedelta, timezone
import random

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

print("Generating realistic sensor data...")
now = datetime.now(timezone.utc)
base_temp_room1, base_temp_room2 = 20.5, 19.0
base_humidity_room1, base_humidity_room2 = 55, 50

total_points = 0
for days_ago in range(7, 0, -1):
    for hour in range(24):
        for minute in range(0, 60, 15):
            timestamp = now - timedelta(days=days_ago, hours=hour, minutes=minute)
            
            temp1 = base_temp_room1 + random.uniform(-0.5, 0.5)
            temp2 = base_temp_room2 + random.uniform(-0.5, 0.5)
            humidity1 = base_humidity_room1 + random.uniform(-3, 3)
            humidity2 = base_humidity_room2 + random.uniform(-3, 3)
            light = random.uniform(200, 800)
            
            # ✅ Запись ПОЧТЕННОЙ ТОЧКИ ЗА РАЗ
            sensors = [
                ("temperature/room1", round(temp1, 2)),
                ("temperature/room2", round(temp2, 2)),
                ("humidity/room1", round(humidity1, 2)),
                ("humidity/room2", round(humidity2, 2)),
                ("light/living_room", round(light, 2))
            ]
            
            for sensor_id, value in sensors:
                point = Point("sensor_data").tag("sensor_id", sensor_id).field("value", value).time(timestamp)
                write_api.write(bucket="sensors", record=point)
                total_points += 1
                
            if total_points % 100 == 0:
                print(f"Записано {total_points} точек...")

print(f"✅ Готово! Всего записано {total_points} точек")
client.close()
