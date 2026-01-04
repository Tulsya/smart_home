from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime

client = InfluxDBClient(url="http://localhost:8086", token="grafana-token-123", org="smart_home")
write_api = client.write_api(write_client=SYNCHRONOUS)

point = Point("sensor_data") \
    .tag("sensor_id", "temperature/kitchen") \
    .tag("building_id", "1") \
    .field("value", 22.5) \
    .time(datetime.utcnow())

write_api.write(bucket="sensors", record=point)
print("✓ Data written to InfluxDB")

client.close()
