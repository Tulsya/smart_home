package main
//02.12
import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// ============ СТРУКТУРЫ ДАННЫХ ============

type Building struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Room struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	BuildingID int    `json:"building_id"`
}

type Device struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	RoomID int    `json:"room_id"`
}

type Controller struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	State    string `json:"state"`
	DeviceID int    `json:"device_id"`
}

type Sensor struct {
	ID       int     `json:"id"`
	Type     string  `json:"type"`
	MinValue float64 `json:"min_value"`
	MaxValue float64 `json:"max_value"`
	InDataID int     `json:"in_data_id"`
}

type UserDevice struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	DeviceID    int       `json:"device_id"`
	PaymentType string    `json:"payment_type"`
	Floorplan   string    `json:"floorplan"`
	CreatedAt   time.Time `json:"created_at"`
}

// type SensorReading struct {
// 	Type   string    `json:"type"`
// 	Number int       `json:"number"`
// 	Value  string    `json:"value"`
// 	Time   time.Time `json:"time"`
// }

type Actuator struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	MinValue  float64 `json:"min_value"`
	MaxValue  float64 `json:"max_value"`
	OutDataID int     `json:"out_data_id"`
}

type Variable struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Value        string `json:"value"`
	ControllerID int    `json:"controller_id"`
}

type InData struct {
	ID          int `json:"id"`
	Number      int `json:"number"`
	VariablesID int `json:"variables_id"`
}

type OutData struct {
	ID          int `json:"id"`
	VariablesID int `json:"variables_id"`
}

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type Worker struct {
	ID       int       `json:"id"`
	FullName string    `json:"full_name"`
	Position string    `json:"position"`
	Phone    string    `json:"phone"`
	Email    string    `json:"email"`
	HiredAt  time.Time `json:"hired_at"`
}

type Config struct {
	MQTTBroker   string
	InfluxURL    string
	InfluxToken  string
	InfluxOrg    string
	InfluxBucket string
	PostgresURL  string
	HTTPPort     string
	MetricsPort  string
}

// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============

var (
	psqlConn     *sql.DB
	influxClient influxdb2.Client
	mqttClient   mqtt.Client
	cfg          Config

	mqttMessagesTotal  *prometheus.CounterVec
	mqttProcessingTime *prometheus.HistogramVec
	influxWriteErrors  *prometheus.CounterVec
)

// ============ MAIN ============

func main() {
	cfg = Config{
		MQTTBroker:   "tcp://localhost:1883",
		InfluxURL:    "http://localhost:8086",
		InfluxToken:  "BJ2IlPds_hVcKrQDD249VSsYnXqENqUuyDc4IdRsntPCDbgBL3-Ie3jLOhiMrb_Psdlo8P2H1u78HO7SF1_Urw==",
		InfluxOrg:    "smart_home",
		InfluxBucket: "sensor_data",
		PostgresURL:  "host=127.0.0.1 port=5433 user=postgres dbname=smart_home_db password=Masha2002 sslmode=disable",
		HTTPPort:     ":8082",
		MetricsPort:  ":2114",
	}

	initMetrics()
	initPostgres(cfg.PostgresURL)
	defer psqlConn.Close()

	// ДОБАВЬТЕ ЭТУ СТРОКУ
	initTables()

	initInfluxDB(cfg.InfluxURL, cfg.InfluxToken)
	defer influxClient.Close()

	initMQTT(cfg)

	go startMetricsServer(cfg.MetricsPort)
	startAPIServer(cfg.HTTPPort)
}

// ============ ИНИЦИАЛИЗАЦИЯ ============

func initMetrics() {
	mqttMessagesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "mqtt_messages_total",
			Help: "Общее количество полученных MQTT сообщений",
		},
		[]string{"topic"},
	)

	mqttProcessingTime = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "mqtt_processing_time_seconds",
			Help:    "Время обработки MQTT сообщений",
			Buckets: []float64{0.001, 0.01, 0.1, 1.0},
		},
		[]string{"topic", "status"},
	)

	influxWriteErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "influx_write_errors_total",
			Help: "Количество ошибок записи в InfluxDB",
		},
		[]string{"reason"},
	)

	prometheus.MustRegister(mqttMessagesTotal)
	prometheus.MustRegister(mqttProcessingTime)
	prometheus.MustRegister(influxWriteErrors)
}

func initPostgres(dsn string) {
	var err error
	psqlConn, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Ошибка подключения к PostgreSQL: %v", err)
	}

	if err := psqlConn.Ping(); err != nil {
		log.Fatalf("Ошибка пинга PostgreSQL: %v", err)
	}

	log.Println("✓ Подключение к PostgreSQL успешно")
}

func initTables() {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS user_devices (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            payment_type VARCHAR(50) NOT NULL,
            floorplan TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

		// `CREATE TABLE IF NOT EXISTS sensor_data (
		//     id SERIAL PRIMARY KEY,
		//     type VARCHAR(50) NOT NULL,
		//     number INTEGER NOT NULL,
		//     value TEXT NOT NULL,
		//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		// )`,
	}

	for _, table := range tables {
		_, err := psqlConn.Exec(table)
		if err != nil {
			log.Printf("Ошибка создания таблицы: %v\n", err)
		} else {
			log.Printf("✓ Таблица создана или уже существует")
		}
	}
}

func initInfluxDB(url, token string) {
	client := influxdb2.NewClient(url, token)

	ok, pingErr := client.Ping(context.Background())
	if !ok || pingErr != nil {
		log.Fatalf("Ошибка подключения к InfluxDB: %v", pingErr)
	}

	influxClient = client
	log.Println("✓ Подключение к InfluxDB успешно")
}

func initMQTT(cfg Config) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(cfg.MQTTBroker)
	opts.SetClientID("smart-home-module")
	opts.SetAutoReconnect(true)
	opts.SetOnConnectHandler(onMQTTConnect)
	opts.SetConnectionLostHandler(onMQTTConnectionLost)

	mqttClient = mqtt.NewClient(opts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		log.Fatalf("Ошибка подключения к MQTT: %v", token.Error())
	}

	topics := []string{
		"sensors/temperature/#",
		"sensors/humidity/#",
		"sensors/motion/#",
		"controllers/status/#",
	}

	for _, topic := range topics {
		if token := mqttClient.Subscribe(topic, 1, onMQTTMessage); token.Wait() && token.Error() != nil {
			log.Printf("Ошибка подписки на тему %s: %v\n", topic, token.Error())
		}
	}

	log.Println("✓ MQTT подписка установлена")
}

// ============ MQTT HANDLERS ============

func onMQTTConnect(client mqtt.Client) {
	log.Println("[MQTT] Подключение к брокеру установлено")
}

func onMQTTConnectionLost(client mqtt.Client, err error) {
	log.Printf("[MQTT] Потеряно подключение: %v\n", err)
}

func onMQTTMessage(client mqtt.Client, msg mqtt.Message) {
	startTime := time.Now()
	topic := msg.Topic()

	var sensorData map[string]interface{}
	if err := json.Unmarshal(msg.Payload(), &sensorData); err != nil {
		log.Printf("[MQTT] Ошибка парсинга JSON: %v\n", err)
		influxWriteErrors.WithLabelValues("json_parse_error").Inc()
		return
	}

	point := influxdb2.NewPointWithMeasurement("sensor_data").
		AddField("value", sensorData["value"]).
		AddTag("topic", topic).
		AddTag("sensor_id", fmt.Sprintf("%v", sensorData["sensor_id"])).
		SetTime(time.Now())

	writeAPI := influxClient.WriteAPIBlocking(cfg.InfluxOrg, cfg.InfluxBucket)
	if err := writeAPI.WritePoint(context.Background(), point); err != nil {
		log.Printf("[InfluxDB] Ошибка записи: %v\n", err)
		mqttProcessingTime.WithLabelValues(topic, "error").Observe(time.Since(startTime).Seconds())
		influxWriteErrors.WithLabelValues("write_failed").Inc()
	} else {
		mqttMessagesTotal.WithLabelValues(topic).Inc()
		mqttProcessingTime.WithLabelValues(topic, "success").Observe(time.Since(startTime).Seconds())
		log.Printf("[OK] Сообщение из %s обработано за %.3f мс\n", topic, time.Since(startTime).Seconds()*1000)
	}
}

// ============ REST API - CORS MIDDLEWARE ============

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ============ REST API HANDLERS - BUILDINGS ============

func getBuildings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	rows, err := psqlConn.Query("SELECT id, name FROM building")
	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	buildings := []Building{}
	for rows.Next() {
		var b Building
		if err := rows.Scan(&b.ID, &b.Name); err != nil {
			continue
		}
		buildings = append(buildings, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(buildings)
}

func createBuilding(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var building Building
	if err := json.NewDecoder(r.Body).Decode(&building); err != nil {
		http.Error(w, "Неверный JSON", http.StatusBadRequest)
		return
	}

	err := psqlConn.QueryRow(
		"INSERT INTO building (name) VALUES ($1) RETURNING id",
		building.Name).Scan(&building.ID)

	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(building)
}

func updateBuilding(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID не указан", http.StatusBadRequest)
		return
	}

	var building Building
	if err := json.NewDecoder(r.Body).Decode(&building); err != nil {
		http.Error(w, "Неверный JSON", http.StatusBadRequest)
		return
	}

	_, err := psqlConn.Exec(
		"UPDATE building SET name = $1 WHERE id = $2",
		building.Name, id)

	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}

func deleteBuilding(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "ID не указан", http.StatusBadRequest)
		return
	}

	_, err := psqlConn.Exec("DELETE FROM building WHERE id = $1", id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============ REST API HANDLERS - USER SETUP ============

func createUserSetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var setup UserDevice
	if err := json.NewDecoder(r.Body).Decode(&setup); err != nil {
		log.Printf("Ошибка декодирования JSON: %v", err)
		http.Error(w, "Неверный JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Получены данные для сохранения: %+v", setup)

	// Проверяем обязательные поля
	if setup.UserID == 0 || setup.DeviceID == 0 || setup.PaymentType == "" {
		http.Error(w, "Отсутствуют обязательные поля: user_id, device_id, payment_type", http.StatusBadRequest)
		return
	}

	// Вставляем данные в БД
	err := psqlConn.QueryRow(
		"INSERT INTO user_devices (user_id, device_id, payment_type, floorplan) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
		setup.UserID, setup.DeviceID, setup.PaymentType, setup.Floorplan).
		Scan(&setup.ID, &setup.CreatedAt)

	if err != nil {
		log.Printf("Ошибка при вставке в БД: %v", err)
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("Успешно сохранено с ID: %d", setup.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(setup)
}

func getUserDevices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	rows, err := psqlConn.Query("SELECT id, user_id, device_id, payment_type, floorplan, created_at FROM user_devices")
	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var devices []UserDevice
	for rows.Next() {
		var ud UserDevice
		if err := rows.Scan(&ud.ID, &ud.UserID, &ud.DeviceID, &ud.PaymentType, &ud.Floorplan, &ud.CreatedAt); err != nil {
			log.Printf("Ошибка сканирования строки: %v", err)
			continue
		}
		devices = append(devices, ud)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(devices)
}

// ============ ОСТАЛЬНЫЕ HANDLERS (с проверкой методов) ============

func getRooms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	rows, err := psqlConn.Query("SELECT id, name, building_id FROM room")
	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rooms := []Room{}
	for rows.Next() {
		var rm Room
		if err := rows.Scan(&rm.ID, &rm.Name, &rm.BuildingID); err != nil {
			continue
		}
		rooms = append(rooms, rm)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

func createRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var room Room
	if err := json.NewDecoder(r.Body).Decode(&room); err != nil {
		http.Error(w, "Неверный JSON", http.StatusBadRequest)
		return
	}

	err := psqlConn.QueryRow(
		"INSERT INTO room (name, building_id) VALUES ($1, $2) RETURNING id",
		room.Name, room.BuildingID).Scan(&room.ID)

	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(room)
}

// ... остальные handlers с аналогичной проверкой методов ...

// ============ HEALTH CHECK ============

func getHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	okInflux, _ := influxClient.Ping(context.Background())
	health := map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now(),
		"mqtt":      mqttClient.IsConnected(),
		"postgres":  psqlConn.Ping() == nil,
		"influxdb":  okInflux,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// ============ СЕРВЕРЫ ============

func startMetricsServer(port string) {
	http.Handle("/metrics", promhttp.Handler())
	log.Printf("Метрики доступны на http://localhost%s/metrics\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}

func startAPIServer(port string) {
	mux := http.NewServeMux()
	handler := corsMiddleware(mux)

	// Регистрируем обработчики
	mux.HandleFunc("/api/buildings", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getBuildings(w, r)
		case http.MethodPost:
			createBuilding(w, r)
		case http.MethodPut:
			updateBuilding(w, r)
		case http.MethodDelete:
			deleteBuilding(w, r)
		default:
			http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getRooms(w, r)
		case http.MethodPost:
			createRoom(w, r)
		default:
			http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		}
	})

	// НОВЫЕ МАРШРУТЫ ДЛЯ USER SETUP
	mux.HandleFunc("/api/user/setup", createUserSetup)
	mux.HandleFunc("/api/user/devices", getUserDevices)

	mux.HandleFunc("/api/health", getHealth)

	log.Printf("REST API запущен на http://localhost%s\n", port)

	// Используем HTTP/1.1 явно
	server := &http.Server{
		Addr:         port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(server.ListenAndServe())
}
