const API_BASE = 'http://localhost:8082/api';
const API_AUTH = `${API_BASE}/auth`;
const API_USER_SETUP = `${API_BASE}/user/setup`;

// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
let currentUser = null;
let userSetupData = {
    paymentType: null,
    floorplan: null,
    rooms: {
        livingroom: 0,
        bedroom: 0,
        kitchen: 0,
        hallway: 0,
        balcony: 0,
        bathroom: 0
    },
    devices: []
};

// ============ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ============
window.addEventListener('load', () => {
    console.log('🔄 Инициализация приложения...');
    
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            console.log('👤 Пользователь найден в localStorage:', user.username, 'Роль:', user.role);
            
            // КРИТИЧНО: Проверка роли и редирект
            if (user.role === 'admin') {
                console.log('🔐 Редирект на админ-панель...');
                window.location.href = 'admin3.html';
                return;
            } else if (user.role === 'worker') {
                console.log('🔧 Редирект на worker-панель...');
                window.location.href = 'worker.html';
                return;
            }
            
            // Если обычный user - показать dashboard
            console.log('📊 Загрузка user dashboard...');
            showUserPage(user);
            
        } catch (error) {
            console.error('❌ Ошибка при парсинге пользователя:', error);
            localStorage.removeItem('user');
            // Показать страницу авторизации
        }
    } else {
        console.log('ℹ️ Пользователь не авторизован, показываем форму входа');
    }
    
    // Инициализация обработчика загрузки файла
    initializeFileUpload();
});

// ============ ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ФОРМАМИ ============
function toggleForms() {
    document.getElementById('registerCard').classList.toggle('hidden');
    document.getElementById('loginCard').classList.toggle('hidden');
    document.getElementById('registerAlert').innerHTML = '';
    document.getElementById('loginAlert').innerHTML = '';
}

// ============ РЕГИСТРАЦИЯ ============
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Попытка регистрации...');
    
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    
    // Валидация на клиенте
    if (!username || !email || !password) {
        showAlert('registerAlert', '❌ Все поля обязательны', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAlert('registerAlert', '❌ Пароль должен быть минимум 6 символов', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showAlert('registerAlert', '❌ Некорректный email', 'error');
        return;
    }
    
    try {
        console.log('🚀 Отправка запроса на регистрацию...');
        
        const response = await fetch(`${API_AUTH}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                email,
                password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Ошибка сервера:', data);
            showAlert('registerAlert', `❌ ${data.message || 'Ошибка регистрации'}`, 'error');
            return;
        }
        
        // КРИТИЧНО: Сохранить role при регистрации
        const userToSave = {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role || 'user',  // ← ВАЖНО: role должно быть!
            token: data.token
        };
        
        console.log('✅ Регистрация успешна! Роль:', userToSave.role);
        
        localStorage.setItem('user', JSON.stringify(userToSave));
        showAlert('registerAlert', '✅ Регистрация успешна! Переход...', 'success');
        
        setTimeout(() => {
            // Редирект в зависимости от роли
            if (userToSave.role === 'admin') {
                window.location.href = 'admin3.html';
            } else if (userToSave.role === 'worker') {
                window.location.href = 'worker.html';
            } else {
                showUserPage(userToSave);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Сетевая ошибка при регистрации:', error);
        showAlert('registerAlert', `❌ Сетевая ошибка: ${error.message}`, 'error');
    }
});

// ============ ВХОД ============
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('🔐 Попытка входа...');
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAlert('loginAlert', '❌ Введите логин и пароль', 'error');
        return;
    }
    
    try {
        console.log('🚀 Отправка запроса на вход...');
        
        const response = await fetch(`${API_AUTH}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Ошибка входа:', data);
            showAlert('loginAlert', `❌ ${data.message || 'Ошибка входа'}`, 'error');
            return;
        }
        
        // КРИТИЧНО: Сохранить role при входе
        const userToSave = {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role || 'user',  // ← ВАЖНО: role должно быть!
            token: data.token
        };
        
        console.log('✅ Вход успешен! Роль:', userToSave.role);
        
        localStorage.setItem('user', JSON.stringify(userToSave));
        showAlert('loginAlert', '✅ Добро пожаловать! Переход...', 'success');
        
        setTimeout(() => {
            // КРИТИЧНО: Редирект в зависимости от роли
            if (userToSave.role === 'admin') {
                console.log('🔐 Редирект admin → admin3.html');
                window.location.href = 'admin3.html';
            } else if (userToSave.role === 'worker') {
                console.log('🔧 Редирект worker → worker.html');
                window.location.href = 'worker.html';
            } else {
                console.log('📊 Загрузка user dashboard');
                showUserPage(userToSave);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Сетевая ошибка при входе:', error);
        showAlert('loginAlert', `❌ Сетевая ошибка: ${error.message}`, 'error');
    }
});

// ============ ПОКАЗ СООБЩЕНИЙ ============
function showAlert(elementId, message, type) {
    const alertDiv = document.getElementById(elementId);
    if (!alertDiv) {
        console.warn(`⚠️ Element ${elementId} не найден`);
        return;
    }
    
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    console.log(`📢 Сообщение [${type}]: ${message}`);
}

// ============ ПОКАЗ СТРАНИЦЫ ПОЛЬЗОВАТЕЛЯ ============
function showUserPage(userData) {
    console.log('📊 Показываем user dashboard для:', userData.username);
    
    currentUser = userData;
    
    // КРИТИЧНО: Еще раз проверяем роль (на случай если что-то сломалось)
    if (userData.role === 'admin') {
        console.warn('⚠️ Admin попытался открыть user page, редирект...');
        window.location.href = 'admin3.html';
        return;
    } else if (userData.role === 'worker') {
        console.warn('⚠️ Worker попытался открыть user page, редирект...');
        window.location.href = 'worker.html';
        return;
    }
    
    // Показать user dashboard
    const authPage = document.getElementById('authPage');
    const userPage = document.getElementById('userPage');
    
    if (authPage) authPage.style.display = 'none';
    if (userPage) userPage.style.display = 'block';
    
    const displayName = document.getElementById('userDisplayName');
    if (displayName) displayName.textContent = `👤 ${userData.username}`;
    
    showStep(1);
}

// ============ ВЫХОД ============
function logout() {
    console.log('🚪 Выход пользователя...');
    
    localStorage.removeItem('user');
    currentUser = null;
    userSetupData = {
        paymentType: null,
        floorplan: null,
        rooms: { livingroom: 0, bedroom: 0, kitchen: 0, hallway: 0, balcony: 0, bathroom: 0 },
        devices: []
    };
    
    // Очистить формы
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    if (registerForm) registerForm.reset();
    if (loginForm) loginForm.reset();
    
    // Показать страницу авторизации
    const authPage = document.getElementById('authPage');
    const userPage = document.getElementById('userPage');
    if (authPage) authPage.style.display = 'flex';
    if (userPage) userPage.style.display = 'none';
    
    const registerCard = document.getElementById('registerCard');
    const loginCard = document.getElementById('loginCard');
    if (registerCard) registerCard.classList.remove('hidden');
    if (loginCard) loginCard.classList.add('hidden');
    
    console.log('✅ Выход выполнен');
}

// ============ ЭТАПЫ НАСТРОЙКИ ============
function selectPayment(type) {
    console.log(`💳 Выбран тип оплаты: ${type}`);
    userSetupData.paymentType = type;
    
    document.querySelectorAll('#step1 .option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(type));
    });
}

function incrementRoom(roomId) {
    userSetupData.rooms[roomId] = (userSetupData.rooms[roomId] || 0) + 1;
    updateRoomCounts();
    updateJsonFloorplan();
}

function decrementRoom(roomId) {
    if (userSetupData.rooms[roomId] > 0) {
        userSetupData.rooms[roomId]--;
        updateRoomCounts();
        updateJsonFloorplan();
    }
}

function updateRoomCounts() {
    const roomMap = {
        livingroom: 'livingRoomCount',
        bedroom: 'bedroomCount',
        kitchen: 'kitchenCount',
        hallway: 'hallwayCount',
        balcony: 'balconyCount',
        bathroom: 'bathroomCount'
    };
    
    Object.entries(roomMap).forEach(([key, elementId]) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = userSetupData.rooms[key] || 0;
    });
}

function updateJsonFloorplan() {
    const jsonOutput = document.getElementById('jsonFloorplan');
    if (jsonOutput) {
        jsonOutput.textContent = JSON.stringify(
            { rooms: userSetupData.rooms },
            null,
            2
        );
    }
}

// ============ ЗАГРУЗКА ФАЙЛА ПЛАНИРОВКИ ============
function initializeFileUpload() {
    console.log('📂 Инициализация загрузки файлов...');
    
    const floorplanInput = document.getElementById('floorplanFile');
    
    if (!floorplanInput) {
        console.warn('⚠️ Element #floorplanFile не найден');
        return;
    }
    
    floorplanInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (!file) {
            console.log('ℹ️ Файл не выбран');
            return;
        }
        
        console.log('📤 Выбран файл:', file.name);
        
        // Валидация размера (максимум 5MB)
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            showAlert('uploadError', `❌ Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум 5MB`, 'error');
            console.error('❌ Файл слишком большой:', file.size);
            return;
        }
        
        // Валидация типа файла
        if (!file.type.startsWith('image/')) {
            showAlert('uploadError', '❌ Пожалуйста, выберите изображение (JPG, PNG, GIF)', 'error');
            console.error('❌ Неверный тип файла:', file.type);
            return;
        }
        
        // Чтение файла
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const dataUrl = event.target.result;
            userSetupData.floorplan = dataUrl;
            
            const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
            console.log('✅ Фото загружено!');
            console.log('   📄 Название:', file.name);
            console.log('   📊 Размер:', sizeInMB, 'MB');
            console.log('   🎨 Тип:', file.type);
            
            // Показать превью И инфо о файле
            showFloorplanPreview(dataUrl, file);
            
            // Показать сообщение об успехе
            showAlert('uploadError', `✅ Фото загружено: ${file.name} (${sizeInMB}MB)`, 'success');
        };
        
        reader.onerror = function() {
            console.error('❌ Ошибка при чтении файла');
            showAlert('uploadError', '❌ Ошибка при чтении файла', 'error');
        };
        
        reader.readAsDataURL(file);
    });
}

// Функция для отображения превью фото + информация
function showFloorplanPreview(dataUrl, file) {
    let preview = document.getElementById('floorplanPreview');
    
    // Создать контейнер превью если его нет
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'floorplanPreview';
        preview.style.cssText = `
            margin: 20px 0;
            border: 2px solid #28a745;
            border-radius: 8px;
            overflow: hidden;
            background: #f0fff4;
        `;
        
        const stepCard = document.getElementById('step2');
        if (stepCard) {
            const button = stepCard.querySelector('button[class="btn btn-primary"]');
            if (button) {
                button.parentNode.insertBefore(preview, button.nextSibling.nextSibling);
            }
        }
    }
    
    // Форматировать размер файла
    const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
    
    // Обновить превью с информацией о файле
    preview.innerHTML = `
        <div style="padding: 20px;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 10px;">✅</span>
                <div>
                    <p style="color: #28a745; font-weight: bold; margin: 0 0 5px 0;">Фото квартиры загружено</p>
                    <p style="color: #666; font-size: 12px; margin: 0;">
                        📄 ${file.name} • ${sizeInMB}MB • ${file.type}
                    </p>
                </div>
            </div>
            <img src="${dataUrl}" style="
                width: 100%;
                max-height: 300px;
                border-radius: 6px;
                object-fit: contain;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            " alt="Превью планировки квартиры">
        </div>
    `;
    
    console.log('🖼️ Превью отображено с информацией о файле');
}

// ============ УПРАВЛЕНИЕ УСТРОЙСТВАМИ ============
let deviceCounter = 0;

function addDevice() {
    deviceCounter++;
    const deviceId = `device-${deviceCounter}`;
    
    userSetupData.devices.push({
        id: deviceId,
        name: '',
        type: '',
        room: ''
    });
    
    console.log(`➕ Добавлено устройство: ${deviceId}`);
    renderDevices();
}

function removeDevice(deviceId) {
    userSetupData.devices = userSetupData.devices.filter(d => d.id !== deviceId);
    console.log(`➖ Удалено устройство: ${deviceId}`);
    renderDevices();
}

function updateDevice(deviceId, field, value) {
    const device = userSetupData.devices.find(d => d.id === deviceId);
    if (device) {
        device[field] = value;
        console.log(`✏️ Обновлено ${field} для ${deviceId}: ${value}`);
    }
}

function renderDevices() {
    const deviceList = document.getElementById('deviceList');
    if (!deviceList) return;
    
    if (userSetupData.devices.length === 0) {
        deviceList.innerHTML = '<p style="color: #999; text-align: center;">Нет добавленных устройств</p>';
        return;
    }
    
    deviceList.innerHTML = userSetupData.devices.map(device => `
        <div class="device-item">
            <input 
                type="text" 
                placeholder="Название устройства"
                value="${device.name}"
                onchange="updateDevice('${device.id}', 'name', this.value)"
            >
            <select onchange="updateDevice('${device.id}', 'type', this.value)">
                <option value="">Тип</option>
                <option value="sensor" ${device.type === 'sensor' ? 'selected' : ''}>Датчик</option>
                <option value="actuator" ${device.type === 'actuator' ? 'selected' : ''}>Исполнитель</option>
                <option value="controller" ${device.type === 'controller' ? 'selected' : ''}>Контроллер</option>
            </select>
            <select onchange="updateDevice('${device.id}', 'room', this.value)">
                <option value="">Помещение</option>
                <option value="livingroom" ${device.room === 'livingroom' ? 'selected' : ''}>Гостиная</option>
                <option value="bedroom" ${device.room === 'bedroom' ? 'selected' : ''}>Спальня</option>
                <option value="kitchen" ${device.room === 'kitchen' ? 'selected' : ''}>Кухня</option>
                <option value="hallway" ${device.room === 'hallway' ? 'selected' : ''}>Коридор</option>
                <option value="balcony" ${device.room === 'balcony' ? 'selected' : ''}>Балкон</option>
                <option value="bathroom" ${device.room === 'bathroom' ? 'selected' : ''}>Ванная</option>
            </select>
            <button type="button" class="device-item-btn" onclick="removeDevice('${device.id}')">
                🗑️ Удалить
            </button>
        </div>
    `).join('');
}

// ============ НАВИГАЦИЯ ПО ЭТАПАМ ============
function showStep(stepNum) {
    console.log(`📍 Переход на этап ${stepNum}`);
    
    document.getElementById('step1').classList.toggle('hidden', stepNum !== 1);
    document.getElementById('step2').classList.toggle('hidden', stepNum !== 2);
    document.getElementById('step3').classList.toggle('hidden', stepNum !== 3);
    
    const currentStepEl = document.getElementById('currentStep');
    if (currentStepEl) currentStepEl.textContent = stepNum;
}

function nextStep(currentStep) {
    console.log(`⏭️ Следующий этап от ${currentStep}`);
    
    if (currentStep === 1) {
        if (!userSetupData.paymentType) {
            showAlert('step1Alert', '❌ Пожалуйста, выберите тип оплаты', 'error');
            return;
        }
    }
    
    if (currentStep < 3) {
        showStep(currentStep + 1);
    }
}

function prevStep(currentStep) {
    console.log(`⏮️ Предыдущий этап от ${currentStep}`);
    
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// ============ СОХРАНЕНИЕ КОНФИГУРАЦИИ ============
async function saveConfiguration() {
    console.log('💾 Сохранение конфигурации пользователя...');
    
    if (!currentUser) {
        console.error('❌ Пользователь не авторизован');
        alert('❌ Ошибка: пользователь не авторизован');
        return;
    }
    
    if (userSetupData.devices.length === 0) {
        showAlert('step3Alert', '❌ Пожалуйста, добавьте хотя бы одно устройство', 'error');
        return;
    }
    
    // Проверить все устройства заполнены
    const allValid = userSetupData.devices.every(d => d.name && d.type && d.room);
    if (!allValid) {
        showAlert('step3Alert', '❌ Все устройства должны иметь название, тип и помещение', 'error');
        return;
    }
    
    try {
        const payload = {
            userid: currentUser.id,
            deviceid: 1,
            paymenttype: userSetupData.paymentType,
            floorplan: userSetupData.floorplan,  // ← ФОТО ЗДЕСЬ
            rooms: userSetupData.rooms,
            devices: userSetupData.devices
        };
        
        console.log('📤 Отправка данных:', {
            userid: currentUser.id,
            paymenttype: userSetupData.paymentType,
            floorplan_size: userSetupData.floorplan ? userSetupData.floorplan.length : 0,
            rooms_count: Object.values(userSetupData.rooms).reduce((a, b) => a + b, 0),
            devices_count: userSetupData.devices.length
        });
        
        const response = await fetch(API_USER_SETUP, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': currentUser.role || 'user'  // ← ДОБАВИТЬ РОЛЬ
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Конфигурация сохранена:', data);
        
        // Показать успешное сообщение
        const successMsg = document.getElementById('successMessage');
        if (successMsg) {
            successMsg.classList.add('show');
            setTimeout(() => successMsg.classList.remove('show'), 3000);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при сохранении:', error);
        showAlert('step3Alert', `❌ Ошибка: ${error.message}`, 'error');
    }
}
async function loadAdminSensors() {
    console.log('📊 Загрузка данных датчиков (admin)...');

    const tbody = document.getElementById('sensorsBody');
    if (!tbody) {
        console.warn('⚠️ sensorsBody не найден');
        return;
    }

    // Показать «Загрузка…»
    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align:center;padding:20px;color:#999;">
                Загрузка данных датчиков...
            </td>
        </tr>
    `;

    try {
        const res = await fetch('http://localhost:8082/api/admin/sensors');
        const data = await res.json();

        console.log('✅ Получены датчики:', data);

        tbody.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;padding:20px;color:#999;">
                        Нет данных
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="border:1px solid #ddd;padding:8px;">${item.topic}</td>
                <td style="border:1px solid #ddd;padding:8px;">${Number(item.value).toFixed(2)}</td>
                <td style="border:1px solid #ddd;padding:8px;">${item.unit}</td>
                <td style="border:1px solid #ddd;padding:8px;">${new Date(item.time).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('❌ Ошибка загрузки датчиков:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;padding:20px;color:#c00;">
                    Ошибка загрузки данных датчиков
                </td>
            </tr>
        `;
    }
}
