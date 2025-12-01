import paho.mqtt.client as mqtt
import time
import json
import random

BROKER = "localhost"
PORT = 1883
TOPICS = [
    "sensors/temperature/room1",
    "sensors/humidity/room1",
    "sensors/temperature/room2",
    "sensors/humidity/room2",
]

def on_connect(client, userdata, flags, rc):
    print(f"✓ Подключение к брокеру: {rc}")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"Отключение от брокера: {rc}")

client = mqtt.Client(client_id="mqtt-test-publisher")
client.on_connect = on_connect
client.on_disconnect = on_disconnect

try:
    print(f"🔗 Попытка подключения к {BROKER}:{PORT}...")
    client.connect(BROKER, PORT, 60)
    client.loop_start()

    print("✓ Отправка тестовых сообщений (Ctrl+C для выхода)...")

    message_count = 0
    while True:
        for topic in TOPICS:
            if "temperature" in topic:
                value = round(20 + random.uniform(-5, 5), 2)
            else:
                value = round(40 + random.uniform(-10, 10), 2)

            payload = json.dumps({
                "sensor_id": topic.split("/")[-1],
                "value": value,
                "timestamp": int(time.time())
            })

            client.publish(topic, payload, qos=1)
            message_count += 1
            print(f"[{message_count}] {topic}: {payload}")
        time.sleep(5)

except KeyboardInterrupt:
    print("\nОстановка...")
finally:
    client.disconnect()
    client.loop_stop()
    print("✓ Отключено")
