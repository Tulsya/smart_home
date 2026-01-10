from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timezone

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

p = Point("test").tag("room", "1").field("temp", 22.5).time(datetime.now(timezone.utc))
write_api.write(bucket="sensors", record=p)
print("✅ Одна точка записана")
client.close()
