-- Clean PostgreSQL initialization script for Smart Home IoT System
-- All tables properly defined with foreign keys and constraints

SET search_path TO public;

-- Drop all tables if they exist (in correct order to avoid FK conflicts)
DROP TABLE IF EXISTS user_profile_history CASCADE;
DROP TABLE IF EXISTS device_logs CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS state CASCADE;
DROP TABLE IF EXISTS actuators CASCADE;
DROP TABLE IF EXISTS sensor CASCADE;
DROP TABLE IF EXISTS in_data CASCADE;
DROP TABLE IF EXISTS out_data CASCADE;
DROP TABLE IF EXISTS variables CASCADE;
DROP TABLE IF EXISTS controller CASCADE;
DROP TABLE IF EXISTS device CASCADE;
DROP TABLE IF EXISTS room CASCADE;
DROP TABLE IF EXISTS building CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- Create tables
-- ============================================

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    house_status VARCHAR(50) DEFAULT 'День',
    payment_type VARCHAR(50) DEFAULT 'Базовый',
    floorplan_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Buildings table
CREATE TABLE building (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Rooms table
CREATE TABLE room (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    building_id INTEGER NOT NULL REFERENCES building(id) ON DELETE CASCADE
);

-- Devices table
CREATE TABLE device (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    room_id INTEGER REFERENCES room(id) ON DELETE CASCADE
);

-- Controllers table
CREATE TABLE controller (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(50),
    device_id INTEGER NOT NULL REFERENCES device(id) ON DELETE CASCADE
);

-- Variables table
CREATE TABLE variables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(255),
    controller_id INTEGER NOT NULL REFERENCES controller(id) ON DELETE CASCADE
);

-- Input data table
CREATE TABLE in_data (
    id SERIAL PRIMARY KEY,
    number INTEGER NOT NULL,
    variables_id INTEGER NOT NULL REFERENCES variables(id) ON DELETE CASCADE
);

-- Output data table
CREATE TABLE out_data (
    id SERIAL PRIMARY KEY,
    variables_id INTEGER NOT NULL REFERENCES variables(id) ON DELETE CASCADE
);

-- Sensors table
CREATE TABLE sensor (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    in_data_id INTEGER NOT NULL REFERENCES in_data(id) ON DELETE CASCADE
);

-- Actuators table
CREATE TABLE actuators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    out_data_id INTEGER NOT NULL REFERENCES out_data(id) ON DELETE CASCADE
);

-- Settings table
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    value TEXT,
    controller_id INTEGER NOT NULL REFERENCES controller(id) ON DELETE CASCADE
);

-- State table
CREATE TABLE state (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(255),
    controller_id INTEGER NOT NULL REFERENCES controller(id) ON DELETE CASCADE
);

-- Workers table
CREATE TABLE workers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    "position" VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    hired_at DATE
);

-- User-Devices junction table
CREATE TABLE user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES device(id) ON DELETE CASCADE,
    payment_type VARCHAR(50),
    floorplan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device logs table
CREATE TABLE device_logs (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES device(id) ON DELETE CASCADE,
    action VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data TEXT
);

-- User profile history table
CREATE TABLE user_profile_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Create indexes for better query performance
-- ============================================

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_room_building ON room(building_id);
CREATE INDEX idx_device_room ON device(room_id);
CREATE INDEX idx_controller_device ON controller(device_id);
CREATE INDEX idx_variables_controller ON variables(controller_id);
CREATE INDEX idx_user_devices_user ON user_devices(user_id);
CREATE INDEX idx_user_devices_device ON user_devices(device_id);
CREATE INDEX idx_device_logs_device ON device_logs(device_id);
CREATE INDEX idx_user_profile_history_user ON user_profile_history(user_id);

-- ============================================
-- Insert test data
-- ============================================

-- Insert test users
INSERT INTO users (username, email, password, role, house_status, payment_type) VALUES 
('admin', 'admin@test.com', 'admin123', 'admin', 'День', 'Максимум'),
('user1', 'user1@test.com', 'password123', 'user', 'День', 'Базовый'),
('worker1', 'worker@test.com', 'worker123', 'worker', 'День', 'Базовый');

-- Insert test building
INSERT INTO building (name) VALUES ('Квартира');

-- Insert test rooms
INSERT INTO room (name, building_id) VALUES 
('Гостиная', 1),
('Спальня', 1),
('Кухня', 1);

-- Insert test devices
INSERT INTO device (name, room_id) VALUES 
('Люстра', 1),
('Кондиционер', 1),
('Светильник', 2),
('Плита', 3);

-- Insert test controllers
INSERT INTO controller (name, state, device_id) VALUES 
('Контроллер 1', 'off', 1),
('Контроллер 2', 'off', 2),
('Контроллер 3', 'off', 3),
('Контроллер 4', 'off', 4);

-- Insert test workers
INSERT INTO workers (full_name, "position", phone, email, hired_at) VALUES 
('Иван Петров', 'Инженер', '+7-999-123-45-67', 'ivan@company.com', '2023-01-15'),
('Мария Сидорова', 'Техник', '+7-999-234-56-78', 'maria@company.com', '2023-02-20');

-- Insert user-devices relationships
INSERT INTO user_devices (user_id, device_id, payment_type) VALUES 
(1, 1, 'Максимум'),
(1, 2, 'Максимум'),
(1, 3, 'Максимум'),
(1, 4, 'Максимум'),
(2, 1, 'Базовый'),
(2, 3, 'Базовый'),
(3, 2, 'Базовый'),
(3, 4, 'Базовый');
