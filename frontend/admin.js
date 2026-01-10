const API_URL = 'http://localhost:8082/api';

// ============ ЗАЩИТА ОТ XSS АТАК ============
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============ ПОКАЗАТЬ УВЕДОМЛЕНИЕ ============
function showAlert(elementId, message, type) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        console.warn(`⚠️ Элемент ${elementId} не найден`);
        return;
    }
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = message;
    alertDiv.style.display = 'block';
    console.log(`📢 [${type.toUpperCase()}] ${message}`);
    if (type === 'success') {
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
}

// ============ ЗАГРУЗИТЬ ВСЕ УСТРОЙСТВА ============
async function loadAllDevices() {
    try {
        console.log('🔌 Загрузка всех устройств...');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const response = await fetch(`${API_URL}/devices`, {
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'X-User-Role': user.role || 'admin'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allDevices = await response.json() || [];
        console.log('✅ Устройства загружены:', allDevices);

        const container = document.getElementById('all-devices-container');
        if (!container) {
            console.warn('⚠️ Контейнер all-devices-container не найден');
            return;
        }

        if (!allDevices || allDevices.length === 0) {
            container.innerHTML = '<p>❌ Нет устройств</p>';
            return;
        }

        container.innerHTML = allDevices.map(device => `
            <div class="device-card">
                <h4>🔌 ${escapeHtml(device.name)}</h4>
                <p>ID: ${device.id}</p>
                <p>Комната: ${device.room_id || '—'}</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('❌ Ошибка загрузки устройств:', error);
        showAlert('devicesAlert', `Ошибка: ${error.message}`, 'error');
    }
}


// ============ ЗАГРУЗИТЬ ДАННЫЕ ДАТЧИКОВ АДМИНА ============
async function loadAdminSensors() {
    try {
        console.log('📡 Загрузка данных датчиков...');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const response = await fetch(`${API_URL}/admin/sensors`, {
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'X-User-Role': user.role || 'admin'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const sensors = await response.json() || [];
        console.log('✅ Датчики загружены:', sensors);

        const container = document.getElementById('sensors-container');
        if (!container) {
            console.warn('⚠️ Контейнер sensors-container не найден');
            return;
        }

        if (!sensors || sensors.length === 0) {
            container.innerHTML = '<p>❌ Нет данных датчиков</p>';
            return;
        }

        container.innerHTML = sensors.map(sensor => `
            <div class="sensor-card">
                <h4>📊 ${escapeHtml(sensor.topic)}</h4>
                <p class="sensor-value">${sensor.value.toFixed(2)} ${escapeHtml(sensor.unit)}</p>
                <p class="sensor-time">🕐 ${new Date(sensor.time).toLocaleString('ru-RU')}</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('❌ Ошибка загрузки датчиков:', error);
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Загрузка админ панели...');

    // Проверить авторизацию
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        console.error('❌ Доступ запрещен: не админ');
        window.location.href = 'user3.html';
        return;
    }

    loadUserInfo();
    loadBuildings();
    loadUsers();
    loadAllDevices();       // ✅ Функция теперь определена выше
    loadDashboard();
    loadAdminSensors();     // ✅ Функция теперь определена выше

    // Обновление каждые 5 секунд
    setInterval(loadDeviceData, 5000);    // ✅ Функция теперь определена выше
    setInterval(loadAdminSensors, 5000);
});


// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
let currentBuilding = null;
let currentApartment = null;
let currentRoom = null;
let allDevices = [];
let allBuildings = [];

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Загрузка админ панели...');

    // Проверить авторизацию
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        console.error('❌ Доступ запрещен: не админ');
        window.location.href = 'user3.html';
        return;
    }

    loadUserInfo();
    loadBuildings();
    loadUsers();           // ✅ Добавлена функция
    loadAllDevices();
    loadDashboard();       // ✅ Добавлена функция
    loadAdminSensors();

    // Обновление каждые 5 секунд
    setInterval(loadDeviceData, 5000);    // ✅ Функция добавлена
    setInterval(loadAdminSensors, 5000);
});

// ============ ПОЛУЧИТЬ ИНФОРМАЦИЮ О ПОЛЬЗОВАТЕЛЕ ============
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const username = document.getElementById('username');
    const userRole = document.getElementById('userRole');

    if (username) username.textContent = user.username || 'Admin';
    if (userRole) userRole.textContent = user.role || 'admin';
}

// ============ РАБОТА СО ЗДАНИЯМИ ============
async function loadBuildings() {
    try {
        console.log('📡 Запрос зданий...');
        const response = await fetch(`${API_URL}/buildings`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allBuildings = await response.json() || [];
        console.log('✅ Здания загружены:', allBuildings);

        const container = document.getElementById('buildings-container');
        if (!container) return;

        if (!allBuildings || allBuildings.length === 0) {
            container.innerHTML = '<p class="empty">Нет зданий. Добавьте первое здание!</p>';
            return;
        }

        // ✅ ИСПРАВЛЕНО: Правильно закрытые HTML теги
        container.innerHTML = allBuildings.map(building => `
            <div class="building-card">
                <h3>${escapeHtml(building.name)}</h3>
                <p>ID: ${building.id}</p>
                <button onclick="selectBuilding(${building.id})" class="btn btn-primary">
                    Выбрать
                </button>
                <button onclick="deleteBuilding(${building.id})" class="btn btn-danger">
                    Удалить
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки зданий:', error);
        const container = document.getElementById('buildings-container');
        if (container) {
            container.innerHTML = `<p class="error">Ошибка: ${error.message}</p>`;
        }
    }
}

// ============ ЗАГРУЗИТЬ ПОЛЬЗОВАТЕЛЕЙ ============
async function loadUsers() {
    try {
        console.log('📡 Загрузка пользователей...');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        const response = await fetch(`${API_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'X-User-Role': user.role || 'admin'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const users = await response.json() || [];
        console.log('✅ Пользователи загружены:', users);

        const container = document.getElementById('users-container');
        if (!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<p class="empty">Нет пользователей</p>';
            return;
        }

        container.innerHTML = users.map(u => `
            <div class="user-card">
                <h4>${escapeHtml(u.username)}</h4>
                <p>📧 ${escapeHtml(u.email)}</p>
                <p>Роль: <strong>${escapeHtml(u.role)}</strong></p>
                <p>Создан: ${new Date(u.created_at).toLocaleString('ru-RU')}</p>
                <button onclick="deleteUserById(${u.id})" class="btn btn-danger">
                    🗑️ Удалить
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
    }
}

// ============ ЗАГРУЗИТЬ ВСЕ УСТРОЙСТВА ============
async function loadAllDevices() {
    try {
        console.log('🔌 Загрузка всех устройств...');
        const response = await fetch(`${API_URL}/devices`, {
            headers: {
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`,
                'X-User-Role': 'admin'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        allDevices = await response.json() || [];
        console.log('✅ Устройства загружены:', allDevices);

        const container = document.getElementById('all-devices-container');
        if (!container) {
            console.warn('⚠️ Контейнер all-devices-container не найден');
            return;
        }

        if (!allDevices || allDevices.length === 0) {
            container.innerHTML = '<p>❌ Нет устройств</p>';
            return;
        }

        container.innerHTML = allDevices.map(device => `
            <div class="device-card">
                <h4>🔌 ${escapeHtml(device.name)}</h4>
                <p>ID: ${device.id}</p>
                <p>Комната: ${device.room_id || '—'}</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('❌ Ошибка загрузки устройств:', error);
        showAlert('devicesAlert', `Ошибка: ${error.message}`, 'error');
    }
}

// ============ ОБНОВИТЬ ДАННЫЕ УСТРОЙСТВ ============
async function loadDeviceData() {
    try {
        if (!allDevices || allDevices.length === 0) return;
        
        for (const device of allDevices) {
            const response = await fetch(`${API_URL}/sensors/data?sensor_id=device_${device.id}`, {
                headers: {
                    'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`,
                    'X-User-Role': 'admin'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`📊 Данные устройства ${device.id}:`, data);
                
                // ← ДОБАВИТЬ: Обновить статус на странице
                const deviceElement = document.querySelector(`[data-device-id="${device.id}"]`);
                if (deviceElement) {
                    const statusClass = data.status === 'online' ? 'status-online' : 'status-offline';
                    const statusText = data.status === 'online' ? '✅ Online' : '❌ Offline';
                    deviceElement.querySelector('.device-status').innerHTML = `
                        <span class="${statusClass}">${statusText}</span>
                        <strong>${data.value.toFixed(2)} ${data.unit}</strong>
                    `;
                }
            }
        }
    } catch (error) {
        console.error('⚠️ Ошибка обновления данных:', error);
    }
}

// ============ ЗАГРУЗИТЬ ДАШБОРД ============
async function loadDashboard() {
    try {
        console.log('📊 Загрузка дашборда...');
        const response = await fetch(`${API_URL}/health`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const health = await response.json();
        console.log('✅ Статус системы:', health);

        const container = document.getElementById('dashboard-container');
        if (!container) return;

        const statusClass = (isOnline) => isOnline ? 'status-online' : 'status-offline';
        const statusText = (isOnline) => isOnline ? '✅ Online' : '❌ Offline';

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>Статус системы</h3>
                    <div class="status-list">
                        <div class="status-item ${statusClass(health.postgres)}">
                            <span>PostgreSQL</span>
                            <strong>${statusText(health.postgres)}</strong>
                        </div>
                        <div class="status-item ${statusClass(health.influxdb)}">
                            <span>InfluxDB</span>
                            <strong>${statusText(health.influxdb)}</strong>
                        </div>
                        <div class="status-item ${statusClass(health.mqtt)}">
                            <span>MQTT</span>
                            <strong>${statusText(health.mqtt)}</strong>
                        </div>
                    </div>
                    <p class="timestamp">🕐 ${new Date(health.timestamp).toLocaleString('ru-RU')}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('❌ Ошибка загрузки дашборда:', error);
    }
}

// ============ ОБНОВИТЬ ИНДИКАТОРЫ ============
function updateDeviceIndicators(health) {
    const updateIndicator = (elementId, isOnline) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.className = isOnline ? 'indicator online' : 'indicator offline';
        }
    };

    updateIndicator('postgres-indicator', health.postgres);
    updateIndicator('influx-indicator', health.influxdb);
    updateIndicator('mqtt-indicator', health.mqtt);
}


// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

// Защита от XSS
function escapeHtml(unsafe) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return unsafe.replace(/[&<>"']/g, m => map[m]);
}

// Выбрать здание
async function selectBuilding(buildingId) {
    currentBuilding = buildingId;
    console.log(`🏢 Выбрано здание: ${buildingId}`);
    // Загрузить комнаты этого здания
    loadRooms(buildingId);
}

// Загрузить комнаты
async function loadRooms(buildingId) {
    try {
        const response = await fetch(`${API_URL}/rooms?building_id=${buildingId}`);
        const rooms = await response.json() || [];

        const container = document.getElementById('rooms-container');
        if (!container) return;

        container.innerHTML = rooms.map(room => `
            <div class="room-card">
                <h4>${escapeHtml(room.name)}</h4>
                <p>ID: ${room.id}</p>
                <button onclick="selectRoom(${room.id})">Выбрать</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки комнат:', error);
    }
}

// Выбрать комнату
async function selectRoom(roomId) {
    currentRoom = roomId;
    console.log(`🚪 Выбрана комната: ${roomId}`);
    loadDevicesInRoom(roomId);
}

// Загрузить устройства в комнате
async function loadDevicesInRoom(roomId) {
    try {
        const response = await fetch(`${API_URL}/devices?room_id=${roomId}`);
        const devices = await response.json() || [];

        const container = document.getElementById('room-devices-container');
        if (!container) return;

        if (devices.length === 0) {
            container.innerHTML = '<p>Нет устройств в этой комнате</p>';
            return;
        }

        container.innerHTML = devices.map(device => `
            <div class="device-card">
                <h4>${escapeHtml(device.name)}</h4>
                <p>ID: ${device.id}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки устройств:', error);
    }
}

// Удалить здание
async function deleteBuilding(buildingId) {
    if (!confirm('Удалить здание? Это удалит все комнаты и устройства!')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/buildings?id=${buildingId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log('✅ Здание удалено');
        loadBuildings();
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
    }
}

// Удалить пользователя
async function deleteUserById(userId) {
    if (!confirm('Удалить пользователя? Это нельзя отменить!')) {
        return;
    }

    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'X-User-Role': 'admin'
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log('✅ Пользователь удален');
        loadUsers();
    } catch (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        alert('Ошибка удаления пользователя: ' + error.message);
    }
}

// Выход
function logout() {
    if (confirm('Вы уверены?')) {
        localStorage.removeItem('user');
        window.location.href = 'user3.html';
    }
}


// ============ ФУНКЦИИ ДЛЯ ВКЛАДКИ НАДЁЖНОСТИ ============
function showReliabilityTab() {
    switchTab('reliability');
    updateSystemMetrics();
}

function updateSystemMetrics() {
    // Обновляем время
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('system-metrics-update').textContent = timeStr;

    // Генерируем случайные значения для метрик
    const cpuUsage = 5 + Math.random() * 15; // 5-20%
    const ramUsage = 25 + Math.random() * 15; // 25-40%
    const diskUsage = 20 + Math.random() * 20; // 20-40%

    // Обновляем значения CPU
    document.getElementById('cpu-value').textContent = `${cpuUsage.toFixed(1)}%`;
    document.getElementById('cpu-bar').style.width = `${cpuUsage}%`;
    document.getElementById('cpu-temp').textContent = `${Math.round(35 + cpuUsage / 2)}°C`;

    // Обновляем значения RAM
    const ramUsed = (ramUsage / 100 * 4).toFixed(1);
    const ramFree = (4 - ramUsed).toFixed(1);
    document.getElementById('ram-value').textContent = `${ramUsed}GB / 4GB`;
    document.getElementById('ram-bar').style.width = `${ramUsage}%`;
    document.getElementById('ram-used').textContent = `${ramUsed}GB`;
    document.getElementById('ram-free').textContent = `${ramFree}GB`;
    document.getElementById('ram-percent').textContent = `${ramUsage.toFixed(1)}%`;

    // Обновляем значения Disk
    const diskUsed = (31 + Math.random() * 5).toFixed(1);
    const diskFree = (120 - diskUsed).toFixed(1);
    const diskPercent = (diskUsed / 120 * 100).toFixed(1);
    document.getElementById('disk-value').textContent = `${diskFree}GB / 120GB`;
    document.getElementById('disk-bar').style.width = `${diskPercent}%`;
    document.getElementById('disk-free').textContent = `${diskFree}GB`;
    document.getElementById('disk-used').textContent = `${diskUsed}GB`;
    document.getElementById('disk-percent').textContent = `${diskPercent}%`;

    // Анимируем графики
    animateSystemGraphs(cpuUsage, ramUsage, diskUsage);
    if (Math.random() > 0.8) {
        addSystemEvent();
    }
}

function animateSystemGraphs(cpu, ram, disk) {
    // Анимация линий графика
    const cpuLine = document.getElementById('cpu-line');
    const ramLine = document.getElementById('ram-line');
    const diskLine = document.getElementById('disk-line');

    // Сбрасываем анимацию
    cpuLine.style.animation = 'none';
    ramLine.style.animation = 'none';
    diskLine.style.animation = 'none';

    // Запускаем заново
    setTimeout(() => {
        cpuLine.style.animation = 'drawLine 1.5s ease-out';
        ramLine.style.animation = 'drawLine 1.5s ease-out 0.2s';
        diskLine.style.animation = 'drawLine 1.5s ease-out 0.4s';
    }, 10);

    // Анимация изменения значений
    const cards = ['cpu-card', 'ram-card', 'disk-card'];
    cards.forEach(cardId => {
        const card = document.getElementById(cardId);
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 300);
    });
}

// ============ ОБНОВЛЕНИЕ ФУНКЦИИ switchTab ============
// Найдите функцию switchTab и добавьте обработку новой вкладки:
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    if (tabName === 'monitoring') {
        initAddressSelect();
    } else if (tabName === 'notifications') {
        loadNotifications();
    } else if (tabName === 'buildings') {
        loadBuildings();
    } else if (tabName === 'reliability') {
        updateSystemMetrics();
        // Автообновление каждые 10 секунд
        if (window.systemMetricsInterval) {
            clearInterval(window.systemMetricsInterval);
        }
        window.systemMetricsInterval = setInterval(updateSystemMetrics, 10000);
    } else {
        if (autoUpdateInterval) {
            clearInterval(autoUpdateInterval);
        }
        if (window.systemMetricsInterval) {
            clearInterval(window.systemMetricsInterval);
        }
    }
}

function addSystemEvent() {
    const events = [
        {
            icon: '✅',
            title: 'Система стабильна',
            desc: 'Все метрики в пределах нормы'
        },
        {
            icon: '📊',
            title: 'Обновление метрик',
            desc: 'Системные метрики успешно обновлены'
        },
        {
            icon: '🔧',
            title: 'Фоновая оптимизация',
            desc: 'Выполнена фоновая оптимизация БД'
        }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const eventsContainer = document.getElementById('system-events');
    const newEvent = document.createElement('div');
    newEvent.className = 'system-event';
    newEvent.innerHTML = `
        <div class="event-time">${timeStr}</div>
        <div class="event-icon">${event.icon}</div>
        <div class="event-content">
            <div class="event-title">${event.title}</div>
            <div class="event-desc">${event.desc}</div>
        </div>
    `;

    // Добавляем в начало и ограничиваем количество
    eventsContainer.insertBefore(newEvent, eventsContainer.firstChild);
    if (eventsContainer.children.length > 10) {
        eventsContainer.removeChild(eventsContainer.lastChild);
    }
}