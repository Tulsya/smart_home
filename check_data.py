# -*- coding: utf-8 -*-
from influxdb_client import InfluxDBClient

client = InfluxDBClient(url='http://localhost:8086', token='grafana-token-123', org='smart_home')
query_api = client.query_api()
result = query_api.query('from(bucket:"sensors") |> range(start:-7d) |> last()')

print('Last values:')
for table in result:
    for r in table.records:
        sensor = r.tags['sensor_id']
        value = r.get_value()
        print(f'  {sensor}: {value}')
client.close()
