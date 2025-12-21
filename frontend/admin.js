const API_URL = 'http://localhost:8082/api';

// Глобальные переменные
let currentBuilding = null;
let currentApartment = null;
let currentRoom = null;
let allDevices = [];
let allBuildings = [];

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Загрузка админ панели...');
    loadUserInfo();
    loadBuildings();
    loadUsers();
    loadAllDevices();
    loadDashboard();
    loadAdminSensors();
    setInterval(loadDeviceData, 5000);
    setInterval(loadAdminSensors, 5000);
});

// Получить информацию о текущем пользователе
function loadUserInfo() {
    const username = localStorage.getItem('username') || 'admin';
    const role = localStorage.getItem('role') || 'admin';
    
    document.getElementById('username').textContent = username;
    document.getElementById('userRole').textContent = role;
}

// ============ РАБОТА СО ЗДАНИЯМИ ============

async function loadBuildings() {
    try {
        console.log('📡 Запрос зданий:', `${API_URL}/buildings`);
        const response = await fetch(`${API_URL}/buildings`);
        const data = await response.json();
        console.log('✅ Получены здания:', data);
        
        allBuildings = data || [];
        
        const container = document.getElementById('buildings-container');
        if (!allBuildings || allBuildings.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">Нет зданий</p>';
            return;
        }
        
        container.innerHTML = allBuildings.map(building => `
            <div class="building-card" onclick="showBuildingApartments(${building.id}, '${building.name}')">
                <h3>🏢 ${building.name}</h3>
                <div class="building-info">
                    <div><strong>ID:</strong> ${building.id}</div>
                    <div><strong>Адрес:</strong> ${building.name}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки зданий:', error);
        document.getElementById('buildings-container').innerHTML =
            `<div class="error">Ошибка загрузки зданий: ${error.message}</div>`;
    }
}

async function showBuildingApartments(buildingId, buildingName) {
    console.log(`🏢 Показываем квартиры для здания ${buildingId}`);
    currentBuilding = { id: buildingId, name: buildingName };
    
    // Скрыть список зданий, показать квартиры
    document.getElementById('buildings-view').classList.add('hidden');
    document.getElementById('apartments-view').classList.remove('hidden');
    
    // Загрузить квартиры
    try {
        const response = await fetch(`${API_URL}/rooms?building_id=${buildingId}`);
        const apartments = await response.json();
        console.log('✅ Получены квартиры:', apartments);
        
        const container = document.getElementById('apartments-container');
        if (!apartments || apartments.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">Нет квартир в этом здании</p>';
            return;
        }
        
        container.innerHTML = apartments.map(apt => `
            <div class="apartment-card" onclick="showApartmentRooms(${apt.id}, '${apt.name}')">
                <h4>🏠 ${apt.name}</h4>
                <div class="building-info">
                    <div><strong>ID:</strong> ${apt.id}</div>
                    <div><strong>Здание:</strong> ${buildingName}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки квартир:', error);
        document.getElementById('apartments-container').innerHTML =
            `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

async function showApartmentRooms(apartmentId, apartmentName) {
    console.log(`🏠 Показываем помещения для квартиры ${apartmentId}`);
    currentApartment = { id: apartmentId, name: apartmentName };
    
    // Скрыть квартиры, показать помещения
    document.getElementById('apartments-view').classList.add('hidden');
    document.getElementById('rooms-view').classList.remove('hidden');
    
    // Загрузить помещения (детальная планировка)
    try {
        // Пока мокаем данные о помещениях
        const mockRooms = [
            { id: 1, name: 'Гостиная', type: 'livingroom', devices_count: 3 },
            { id: 2, name: 'Спальня', type: 'bedroom', devices_count: 2 },
            { id: 3, name: 'Кухня', type: 'kitchen', devices_count: 4 },
            { id: 4, name: 'Ванная', type: 'bathroom', devices_count: 1 },
            { id: 5, name: 'Балкон', type: 'balcony', devices_count: 1 }
        ];
        
        const container = document.getElementById('rooms-container');
        container.innerHTML = mockRooms.map(room => `
            <div class="room-card" onclick="showRoomDevices(${room.id}, '${room.name}', '${room.type}')">
                <h4>🚪 ${room.name}</h4>
                <div class="room-info">
                    <div><strong>Тип:</strong> ${room.type}</div>
                    <div><strong>Устройств:</strong> ${room.devices_count}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки помещений:', error);
        document.getElementById('rooms-container').innerHTML =
            `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

async function showRoomDevices(roomId, roomName, roomType) {
    console.log(`🚪 Показываем устройства для помещения ${roomId}`);
    currentRoom = { id: roomId, name: roomName, type: roomType };
    
    // Скрыть помещения, показать устройства
    document.getElementById('rooms-view').classList.add('hidden');
    document.getElementById('room-devices-view').classList.remove('hidden');
    
    // Загрузить устройства для этого помещения
    try {
        const response = await fetch(`${API_URL}/devices?room_id=${roomId}`);
        const devices = await response.json();
        console.log('✅ Получены устройства помещения:', devices);
        
        const container = document.getElementById('room-devices-container');
        if (!devices || devices.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">Нет устройств в этом помещении</p>';
            return;
        }
        
        container.innerHTML = devices.map(device => `
            <div class="device-card">
                <div class="device-header">
                    <span class="device-name">💡 ${device.name}</span>
                    <span class="device-type">${roomName}</span>
                </div>
                <div class="device-data">
                    <div class="data-item">
                        <div class="data-label">ID</div>
                        <div class="data-value">${device.id}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Статус</div>
                        <div class="device-status online">● Online</div>
                    </div>
                </div>
                <div class="debug-info">ID: ${device.id} | Room: ${device.room_id}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки устройств помещения:', error);
        document.getElementById('room-devices-container').innerHTML =
            `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

// Навигация назад
function backToBuildings() {
    document.getElementById('apartments-view').classList.add('hidden');
    document.getElementById('buildings-view').classList.remove('hidden');
    currentBuilding = null;
}

function backToApartments() {
    document.getElementById('rooms-view').classList.add('hidden');
    document.getElementById('apartments-view').classList.remove('hidden');
    currentApartment = null;
}

function backToRooms() {
    document.getElementById('room-devices-view').classList.add('hidden');
    document.getElementById('rooms-view').classList.remove('hidden');
    currentRoom = null;
}

// ============ ВСЕ УСТРОЙСТВА (отдельная вкладка) ============

async function loadAllDevices() {
    try {
        console.log('📡 Запрос всех устройств:', `${API_URL}/devices`);
        const response = await fetch(`${API_URL}/devices`);
        const data = await response.json();
        console.log('✅ Получены все устройства:', data);
        
        allDevices = data || [];
        
        const container = document.getElementById('devices-container');
        if (!allDevices || allDevices.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">Нет устройств</p>';
            return;
        }
        
        container.innerHTML = allDevices.map(device => `
            <div class="device-card">
                <div class="device-header">
                    <span class="device-name">💡 ${device.name}</span>
                    <span class="device-type">Комната ${device.room_id}</span>
                </div>
                <div class="device-data">
                    <div class="data-item">
                        <div class="data-label">ID</div>
                        <div class="data-value">${device.id}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Статус</div>
                        <div class="device-status online">● Online</div>
                    </div>
                </div>
                <div class="debug-info">ID: ${device.id} | Room: ${device.room_id}</div>
            </div>
        `).join('');
        
        loadDeviceData();
    } catch (error) {
        console.error('❌ Ошибка загрузки всех устройств:', error);
        document.getElementById('devices-container').innerHTML =
            `<div class="error">Ошибка загрузки устройств: ${error.message}</div>`;
    }
}

async function loadDeviceData() {
    try {
        const mockData = {
            5: { temperature: 22.5, humidity: 45, status: 'online' },
            6: { temperature: 21.8, humidity: 50, status: 'online' },
        };
        console.log('📊 Обновлены данные устройств');
    } catch (error) {
        console.error('❌ Ошибка загрузки данных устройств:', error);
    }
}

// ============ ПОЛЬЗОВАТЕЛИ ============

async function loadUsers() {
    try {
        console.log('📡 Запрос пользователей:', `${API_URL}/admin/users`);
        const response = await fetch(`${API_URL}/admin/users`, {
            headers: { 'X-User-Role': 'admin' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const users = await response.json();
        console.log('✅ Получены пользователи:', users);
        
        const tbody = document.getElementById('users-tbody');
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Нет пользователей</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td>
                    <div class="actions">
                        <button class="btn btn-secondary" onclick="editUserRole(${user.id})">Изменить</button>
                        <button class="btn btn-danger" onclick="deleteUser(${user.id})">Удалить</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        document.getElementById('users-tbody').innerHTML =
            `<tr><td colspan="5"><div class="error">Ошибка: ${error.message}</div></td></tr>`;
    }
}

async function addUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    
    if (!username || !email || !password) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        if (response.ok) {
            closeAddUserModal();
            loadUsers();
            alert('✅ Пользователь добавлен');
        } else {
            alert('❌ Ошибка при добавлении пользователя');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при добавлении пользователя: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Вы уверены?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'X-User-Role': 'admin' }
        });
        
        if (response.ok) {
            loadUsers();
            alert('✅ Пользователь удален');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при удалении пользователя');
    }
}

async function editUserRole(userId) {
    const newRole = prompt('Введите новую роль (user/worker/admin):');
    if (!newRole) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/users/role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'admin'
            },
            body: JSON.stringify({ user_id: userId, new_role: newRole })
        });
        
        if (response.ok) {
            loadUsers();
            alert('✅ Роль изменена');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при изменении роли');
    }
}

// ============ DASHBOARD ============

async function loadDashboard() {
    try {
        const statsHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Устройств</h3>
                    <p>${allDevices.length}</p>
                </div>
                <div class="stat-card" style="background: #f3e5f5;">
                    <h3 style="color: #7b1fa2;">Online</h3>
                    <p style="color: #7b1fa2;">${allDevices.length}</p>
                </div>
                <div class="stat-card" style="background: #e8f5e9;">
                    <h3 style="color: #388e3c;">Статус</h3>
                    <p style="color: #388e3c;">✓ OK</p>
                </div>
            </div>
        `;
        
        const statsContainer = document.getElementById('stats-info');
        if (statsContainer) {
            statsContainer.innerHTML = statsHTML;
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки dashboard:', error);
    }
}

async function loadAdminSensors() {
    try {
        const response = await fetch(`${API_URL}/admin/sensors`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const readings = await response.json();
        const tbody = document.getElementById('sensorsBody');
        
        if (!readings || readings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">Нет данных</td></tr>';
            return;
        }
        
        tbody.innerHTML = readings.map(r => `
            <tr>
                <td>${r.topic}</td>
                <td>${r.value.toFixed(2)}</td>
                <td>${r.unit}</td>
                <td>${new Date(r.time).toLocaleString('ru-RU')}</td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('sensorsBody').innerHTML =
            '<tr><td colspan="4" style="color:#c00;padding:20px;text-align:center;">Ошибка загрузки данных датчиков</td></tr>';
    }
}

// ============ МОДАЛЬНЫЕ ОКНА ============

function openAddBuildingModal() {
    document.getElementById('addBuildingModal').classList.add('show');
}

function closeAddBuildingModal() {
    document.getElementById('addBuildingModal').classList.remove('show');
}

function openAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
}

async function addBuilding() {
    const address = document.getElementById('newBuildingAddress').value;
    const apartments = document.getElementById('newBuildingApartments').value;
    
    if (!address) {
        alert('Введите адрес здания');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/buildings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: address })
        });
        
        if (response.ok) {
            closeAddBuildingModal();
            loadBuildings();
            alert('✅ Здание добавлено');
        } else {
            alert('❌ Ошибка при добавлении здания');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при добавлении здания: ' + error.message);
    }
}

// ============ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ============

function switchTab(event, tabName) {
    if (event) event.preventDefault();
    
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));
    
    const panel = document.getElementById(tabName);
    if (panel) {
        panel.classList.add('active');
    }
    
    // Активировать кнопку
    document.querySelectorAll('.nav-tabs button').forEach((btn) => {
        if (btn.textContent.toLowerCase().includes(tabName.split('-')[0])) {
            btn.classList.add('active');
        }
    });
    
    // Сбросить навигацию при переключении вкладок
    if (tabName === 'buildings') {
        backToBuildings();
        document.getElementById('apartments-view').classList.add('hidden');
        document.getElementById('rooms-view').classList.add('hidden');
        document.getElementById('room-devices-view').classList.add('hidden');
        document.getElementById('buildings-view').classList.remove('hidden');
    }
}

// ============ ПРОЧЕЕ ============

function logout() {
    console.log('🚪 Выход пользователя...');
    localStorage.clear();
    window.location.href = 'index.html';
}

// Закрыть модальное окно при клике вне его
window.onclick = function (event) {
    const addUserModal = document.getElementById('addUserModal');
    const addBuildingModal = document.getElementById('addBuildingModal');
    
    if (event.target === addUserModal) {
        addUserModal.classList.remove('show');
    }
    if (event.target === addBuildingModal) {
        addBuildingModal.classList.remove('show');
    }
}
