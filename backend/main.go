package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
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

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Token    string `json:"token,omitempty"`
	Message  string `json:"message"`
}

type ChangeRoleRequest struct {
	UserID  int    `json:"user_id"`
	NewRole string `json:"new_role"`
}

type AdminSensorData struct {
	Topic string    `json:"topic"`
	Value float64   `json:"value"`
	Unit  string    `json:"unit"`
	Time  time.Time `json:"time"`
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
	psqlConn           *sql.DB
	influxClient       influxdb2.Client
	mqttClient         mqtt.Client
	cfg                Config
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
		PostgresURL: "host=127.0.0.1 port=5432 user=postgres dbname=postgres password=Masha2002 sslmode=disable",
		HTTPPort:     ":8082",
		MetricsPort:  ":2114",
	}

	initMetrics()
	initPostgres(cfg.PostgresURL)
	defer psqlConn.Close()
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

	_, err = psqlConn.Exec("SET client_encoding = 'UTF8'")
	if err != nil {
		log.Printf("Предупреждение: Ошибка установки кодировки: %v", err)
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Role")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// ============ AUTHENTICATION FUNCTIONS ============

func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

func generateToken(userID int, username string) string {
	token := hashPassword(username + "|" + fmt.Sprintf("%d", userID))
	return token[:32]
}

func registerUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Все поля обязательны", http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		http.Error(w, "Пароль должен быть минимум 6 символов", http.StatusBadRequest)
		return
	}

	hashedPassword := hashPassword(req.Password)

	var userID int
	err := psqlConn.QueryRow(
		"INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
		req.Username, req.Email, hashedPassword, "user").Scan(&userID)

	if err != nil {
		log.Printf("Ошибка при регистрации: %v", err)
		http.Error(w, "Ошибка регистрации: пользователь может уже существовать", http.StatusBadRequest)
		return
	}

	token := generateToken(userID, req.Username)

	response := AuthResponse{
		ID:       userID,
		Username: req.Username,
		Email:    req.Email,
		Token:    token,
		Message:  "Регистрация успешна",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func loginUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username и password обязательны", http.StatusBadRequest)
		return
	}

	var userID int
	var username, email, password, role string

	err := psqlConn.QueryRow(
		"SELECT id, username, email, password, role FROM users WHERE username = $1",
		req.Username,
	).Scan(&userID, &username, &email, &password, &role)

	if err != nil {
		http.Error(w, `{"message":"Неверные учетные данные"}`, http.StatusUnauthorized)
		return
	}

	if hashPassword(req.Password) != password {
		http.Error(w, `{"message":"Неверные учетные данные"}`, http.StatusUnauthorized)
		return
	}

	token := generateToken(userID, username)

	response := AuthResponse{
		ID:       userID,
		Username: username,
		Email:    email,
		Role:     role,
		Token:    token,
		Message:  "Вы успешно вошли",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// ============ ADMIN FUNCTIONS ============

func getAllUsers(w http.ResponseWriter, r *http.Request) {
	role := r.Header.Get("X-User-Role")

	if role != "admin" {
		http.Error(w, `{"message":"Access denied"}`, http.StatusForbidden)
		return
	}

	rows, err := psqlConn.Query("SELECT id, username, email, role, created_at FROM users")
	if err != nil {
		http.Error(w, `{"message":"Database error"}`, http.StatusInternalServerError)
		return
	}

	defer rows.Close()

	type User struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		CreatedAt string `json:"created_at"`
	}

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt); err != nil {
			continue
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func deleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	role := r.Header.Get("X-User-Role")
	if role != "admin" {
		http.Error(w, `{"message":"Access denied"}`, http.StatusForbidden)
		return
	}

	userID := r.URL.Path[len("/api/admin/users/"):]

	result, err := psqlConn.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		http.Error(w, `{"message":"Database error"}`, http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, `{"message":"User not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"User deleted successfully"}`))
}

func changeUserRole(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	role := r.Header.Get("X-User-Role")
	if role != "admin" {
		http.Error(w, `{"message":"Access denied"}`, http.StatusForbidden)
		return
	}

	var req ChangeRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"message":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	validRoles := map[string]bool{"user": true, "admin": true, "worker": true}
	if !validRoles[req.NewRole] {
		http.Error(w, `{"message":"Invalid role"}`, http.StatusBadRequest)
		return
	}

	_, err := psqlConn.Exec("UPDATE users SET role = $1 WHERE id = $2", req.NewRole, req.UserID)
	if err != nil {
		http.Error(w, `{"message":"Database error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Role updated successfully",
	})
}

func getAdminSensors(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	queryAPI := influxClient.QueryAPI(cfg.InfluxOrg)

	query := `from(bucket: "sensor_data")
        |> range(start: -24h)`

	result, err := queryAPI.Query(context.Background(), query)
	if err != nil {
		log.Printf("[ADMIN] InfluxDB error: %v", err)
		http.Error(w, "InfluxDB error", http.StatusInternalServerError)
		return
	}

	var data []AdminSensorData

	for result.Next() {
		rec := result.Record()

		topic := fmt.Sprintf("%v", rec.ValueByKey("topic"))

		var value float64
		switch v := rec.Value().(type) {
		case float64:
			value = v
		case int64:
			value = float64(v)
		case int:
			value = float64(v)
		default:
			continue
		}

		unit := "value"
		if strings.Contains(topic, "temperature") {
			unit = "°C"
		} else if strings.Contains(topic, "humidity") {
			unit = "%"
		}

		data = append(data, AdminSensorData{
			Topic: topic,
			Value: value,
			Unit:  unit,
			Time:  rec.Time(),
		})
	}

	if err := result.Err(); err != nil {
		log.Printf("[ADMIN] Influx iterate error: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	if data == nil {
		data = []AdminSensorData{}
	}
	json.NewEncoder(w).Encode(data)
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

// ============ REST API HANDLERS - ROOMS ============

func getRooms(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	buildingID := r.URL.Query().Get("building_id")
	
	var rows *sql.Rows
	var err error
	
	if buildingID != "" {
		rows, err = psqlConn.Query("SELECT id, name, building_id FROM room WHERE building_id = $1", buildingID)
	} else {
		rows, err = psqlConn.Query("SELECT id, name, building_id FROM room")
	}
	
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

// ============ REST API HANDLERS - DEVICES ============

func createDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	var d Device
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "Неверный JSON", http.StatusBadRequest)
		return
	}

	err := psqlConn.QueryRow(
		"INSERT INTO device (name, room_id) VALUES ($1, $2) RETURNING id",
		d.Name, d.RoomID,
	).Scan(&d.ID)
	if err != nil {
		log.Printf("Ошибка при вставке в БД: %v", err)
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(d)
}

func getDevices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		return
	}

	roomID := r.URL.Query().Get("room_id")
	
	var rows *sql.Rows
	var err error
	
	if roomID != "" {
		rows, err = psqlConn.Query("SELECT id, name, room_id FROM device WHERE room_id = $1", roomID)
	} else {
		rows, err = psqlConn.Query("SELECT id, name, room_id FROM device")
	}
	
	if err != nil {
		http.Error(w, fmt.Sprintf("Ошибка БД: %v", err), http.StatusInternalServerError)
		return
	}

	defer rows.Close()
	devices := []Device{}
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.Name, &d.RoomID); err != nil {
			continue
		}
		devices = append(devices, d)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(devices)
}

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

	// Аутентификация
	mux.HandleFunc("/api/auth/register", registerUser)
	mux.HandleFunc("/api/auth/login", loginUser)

	// Админ-панель
	mux.HandleFunc("/api/admin/users", getAllUsers)
	mux.HandleFunc("/api/admin/users/", deleteUser)
	mux.HandleFunc("/api/admin/users/role", changeUserRole)
	mux.HandleFunc("/api/admin/sensors", getAdminSensors)

	// Здания
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

	// Комнаты
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

	// Устройства
	mux.HandleFunc("/api/devices", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			getDevices(w, r)
		case http.MethodPost:
			createDevice(w, r)
		default:
			http.Error(w, "Метод не поддерживается", http.StatusMethodNotAllowed)
		}
	})

	// Health Check
	mux.HandleFunc("/api/health", getHealth)

	log.Printf("REST API запущен на http://localhost%s\n", port)

	server := &http.Server{
		Addr:         port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(server.ListenAndServe())
}
