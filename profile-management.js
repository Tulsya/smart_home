// ============================================
// ФУНКЦИИ УПРАВЛЕНИЯ ПРОФИЛЕМ ПОЛЬЗОВАТЕЛЯ
// ============================================

// Глобальные переменные профиля
let userProfile = {
    id: null,
    username: '',
    email: '',
    houseStatus: 'День',
    paymentType: 'Базовый',
    floorplanImage: null
};

const HOUSE_STATUSES = ['День', 'Ночь', 'Вне дома', 'Отпуск'];
const PAYMENT_TYPES = ['Максимум', 'Базовый', 'Экономный'];
const API_BASE = 'http://localhost:8082/api';

// ============ ЗАГРУЗКА ПРОФИЛЯ ============

async function loadUserProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.id) {
            console.log('User not found in localStorage');
            return null;
        }

        const response = await fetch(`${API_BASE}/user/profile?id=${user.id}`);
        if (!response.ok) {
            console.error('Failed to load profile');
            return null;
        }

        const profile = await response.json();
        userProfile = {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            houseStatus: profile.house_status || 'День',
            paymentType: profile.payment_type || 'Базовый',
            floorplanImage: profile.floorplan_image
        };

        console.log('✓ Profile loaded:', userProfile);
        return userProfile;
    } catch (error) {
        console.error('Error loading profile:', error);
        return null;
    }
}

// ============ ОБНОВЛЕНИЕ ПРОФИЛЯ ============

async function updateUserProfile(houseStatus, paymentType) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.id) {
            showAlert('profileAlert', 'Ошибка: пользователь не авторизован', 'error');
            return false;
        }

        // Валидация
        if (!HOUSE_STATUSES.includes(houseStatus)) {
            showAlert('profileAlert', 'Неверный статус дома', 'error');
            return false;
        }
        if (!PAYMENT_TYPES.includes(paymentType)) {
            showAlert('profileAlert', 'Неверный тип оплаты', 'error');
            return false;
        }

        const response = await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',  // ← Правильный метод!
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`  // ← Добавить!
            },
            body: JSON.stringify({
                id: user.id,
                house_status: houseStatus,
                payment_type: paymentType
            })
        });


        if (!response.ok) {
            const error = await response.json();
            showAlert('profileAlert', error.message || 'Ошибка обновления профиля', 'error');
            return false;
        }

        const updatedProfile = await response.json();
        userProfile.houseStatus = updatedProfile.house_status;
        userProfile.paymentType = updatedProfile.payment_type;

        showAlert('profileAlert', '✓ Профиль успешно обновлён', 'success');
        console.log('✓ Profile updated:', userProfile);
        return true;
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('profileAlert', 'Ошибка сервера: ' + error.message, 'error');
        return false;
    }
}

// ============ ЗАГРУЗКА ФОТО ПЛАНИРОВКИ ============

async function uploadFloorplan(file) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.id) {
            showAlert('floorplanAlert', 'Ошибка: пользователь не авторизован', 'error');
            return false;
        }

        // Валидация файла
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showAlert('floorplanAlert', 'Поддерживаются только JPEG, PNG, WebP', 'error');
            return false;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            showAlert('floorplanAlert', 'Файл слишком большой (макс 10MB)', 'error');
            return false;
        }

        // Создаём FormData для отправки файла
        const formData = new FormData();
        formData.append('floorplan', file);

        const response = await fetch(`${API_BASE}/user/floorplan?id=${user.id}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            showAlert('floorplanAlert', error.message || 'Ошибка загрузки', 'error');
            return false;
        }

        // Читаем файл в base64 для локального отображения
        const reader = new FileReader();
        reader.onload = (e) => {
            userProfile.floorplanImage = e.target.result;
            displayFloorplan(e.target.result);
        };
        reader.readAsDataURL(file);

        showAlert('floorplanAlert', '✓ Планировка успешно загружена', 'success');
        return true;
    } catch (error) {
        console.error('Error uploading floorplan:', error);
        showAlert('floorplanAlert', 'Ошибка сервера: ' + error.message, 'error');
        return false;
    }
}

// ============ ОТОБРАЖЕНИЕ ПРОФИЛЯ ============

function displayUserProfile(profile) {
    const container = document.getElementById('profileContainer');
    if (!container) return;

    const html = `
        <div class="profile-card">
            <div class="profile-header">
                <h2>Мой Профиль</h2>
                <button class="btn-edit" onclick="editProfile()">✏️ Редактировать</button>
            </div>

            <div class="profile-info">
                <div class="info-row">
                    <span class="label">Имя пользователя:</span>
                    <span class="value">${profile.username}</span>
                </div>
                <div class="info-row">
                    <span class="label">Email:</span>
                    <span class="value">${profile.email}</span>
                </div>
                <div class="info-row">
                    <span class="label">Статус дома:</span>
                    <span class="value status" data-status="${profile.houseStatus}">
                        ${getStatusEmoji(profile.houseStatus)} ${profile.houseStatus}
                    </span>
                </div>
                <div class="info-row">
                    <span class="label">Тип оплаты:</span>
                    <span class="value payment" data-payment="${profile.paymentType}">
                        ${getPaymentEmoji(profile.paymentType)} ${profile.paymentType}
                    </span>
                </div>
            </div>

            ${profile.floorplanImage ? `
                <div class="floorplan-section">
                    <h3>Планировка квартиры</h3>
                    <img src="${profile.floorplanImage}" alt="Планировка" class="floorplan-img">
                    <button class="btn-change" onclick="changeFloorplan()">Изменить фото</button>
                </div>
            ` : `
                <div class="no-floorplan">
                    <p>Планировка квартиры не загружена</p>
                </div>
            `}
        </div>
    `;

    container.innerHTML = html;
}

function displayFloorplan(imageData) {
    const floorplanContainer = document.getElementById('floorplanDisplay');
    if (!floorplanContainer) return;

    floorplanContainer.innerHTML = `
        <img src="${imageData}" alt="Планировка квартиры" style="max-width:100%; border-radius:8px;">
    `;
}

function getStatusEmoji(status) {
    const emojis = {
        'День': '☀️',
        'Ночь': '🌙',
        'Вне дома': '🚗',
        'Отпуск': '✈️'
    };
    return emojis[status] || '📍';
}

function getPaymentEmoji(payment) {
    const emojis = {
        'Максимум': '💎',
        'Базовый': '💰',
        'Экономный': '🏦'
    };
    return emojis[payment] || '💳';
}

// ============ РЕДАКТИРОВАНИЕ ПРОФИЛЯ ============

function editProfile() {
    const container = document.getElementById('profileContainer');
    if (!container) return;

    const html = `
        <div class="profile-edit-card">
            <div class="profile-header">
                <h2>Редактировать Профиль</h2>
                <button class="btn-close" onclick="cancelEditProfile()">✕</button>
            </div>

            <div id="profileAlert"></div>

            <form onsubmit="saveProfileChanges(event)">
                <!-- Статус дома -->
                <div class="form-group">
                    <label for="houseStatus">Статус дома:</label>
                    <select id="houseStatus" class="form-control">
                        ${HOUSE_STATUSES.map(status => `
                            <option value="${status}" ${status === userProfile.houseStatus ? 'selected' : ''}>
                                ${getStatusEmoji(status)} ${status}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Тип оплаты -->
                <div class="form-group">
                    <label for="paymentType">Тип оплаты ЖКХ:</label>
                    <select id="paymentType" class="form-control">
                        ${PAYMENT_TYPES.map(payment => `
                            <option value="${payment}" ${payment === userProfile.paymentType ? 'selected' : ''}>
                                ${getPaymentEmoji(payment)} ${payment}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Загрузка планировки -->
                <div class="form-group">
                    <label>Планировка квартиры:</label>
                    <input type="file" id="floorplanInput" accept="image/*" style="display:none" onchange="handleFloorplanChange(event)">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('floorplanInput').click()">
                        📸 Выбрать фото
                    </button>
                    <div id="floorplanPreviewContainer" style="margin-top:15px;"></div>
                </div>

                <div id="floorplanAlert"></div>

                <!-- Кнопки действий -->
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                    <button type="button" class="btn btn-secondary" onclick="cancelEditProfile()">Отмена</button>
                </div>
            </form>
        </div>
    `;

    container.innerHTML = html;
}

function handleFloorplanChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const container = document.getElementById('floorplanPreviewContainer');
        container.innerHTML = `
            <div style="position:relative;">
                <img src="${e.target.result}" alt="Preview" style="max-width:200px; border-radius:8px;">
                <button type="button" class="btn-small" onclick="uploadFloorplancFile(this.files[0])" style="margin-top:10px;">
                    Загрузить это фото
                </button>
            </div>
        `;
        // Сохраняем данные файла глобально
        window.floorplanFileToUpload = file;
    };
    reader.readAsDataURL(file);
}

async function uploadFloorplancFile(file) {
    const fileInput = document.getElementById('floorplanInput');
    const fileToUpload = window.floorplanFileToUpload || fileInput.files[0];

    if (!fileToUpload) {
        showAlert('floorplanAlert', 'Выберите файл', 'error');
        return;
    }

    const success = await uploadFloorplan(fileToUpload);
    if (success) {
        // После успешной загрузки обновляем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('floorplanPreviewContainer').innerHTML = `
                <img src="${e.target.result}" alt="Preview" style="max-width:200px; border-radius:8px; border: 2px solid #28a745;">
            `;
        };
        reader.readAsDataURL(fileToUpload);
    }
}

async function saveProfileChanges(event) {
    event.preventDefault();

    const houseStatus = document.getElementById('houseStatus').value;
    const paymentType = document.getElementById('paymentType').value;

    const success = await updateUserProfile(houseStatus, paymentType);

    if (success) {
        setTimeout(() => {
            displayUserProfile(userProfile);
        }, 1500);
    }
}

function changeFloorplan() {
    editProfile();
    setTimeout(() => {
        document.getElementById('floorplanInput').click();
    }, 300);
}

function cancelEditProfile() {
    displayUserProfile(userProfile);
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

function showAlert(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = `alert alert-${type}`;
    element.textContent = message;
    element.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// Инициализация при загрузке страницы
async function initializeProfile() {
    const profile = await loadUserProfile();
    if (profile) {
        displayUserProfile(profile);
    }
}

// Запустить при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProfile);
} else {
    initializeProfile();
}
