const API_BASE = 'http://localhost:8082/api';
const API_AUTH = `${API_BASE}/auth`;

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

// ============ ИНИЦИАЛИЗАЦИЯ ============
window.addEventListener('load', () => {
    console.log('🔄 Инициализация приложения...');
    
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            
            // ✅ ИСПРАВЛЕНО: Все редиректы в одном месте
            if (user.role === 'admin') {
                console.log('🔐 Редирект: admin → admin3.html');
                window.location.href = 'admin3.html';
                return;
            } else if (user.role === 'worker') {
                console.log('🔧 Редирект: worker → worker.html');
                window.location.href = 'worker.html';
                return;
            }
            
            // Обычный user
            console.log('📊 Загрузка user dashboard');
            showUserPage(user);
        } catch (error) {
            console.error('❌ Ошибка парсинга пользователя:', error);
            localStorage.removeItem('user');
        }
    } else {
        console.log('ℹ️ Показываем форму входа');
    }
    
    initializeFileUpload();
});

// ============ ПЕРЕКЛЮЧЕНИЕ ФОРМ ============
function toggleForms() {
    document.getElementById('registerCard')?.classList.toggle('hidden');
    document.getElementById('loginCard')?.classList.toggle('hidden');
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
    
    // Валидация
    if (!username || !email || !password) {
        showAlert('registerAlert', '❌ Все поля обязательны', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAlert('registerAlert', '❌ Пароль минимум 6 символов', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showAlert('registerAlert', '❌ Некорректный email', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_AUTH}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showAlert('registerAlert', `❌ ${data.message || 'Ошибка'}`, 'error');
            return;
        }
        
        const userToSave = {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role || 'user',
            token: data.token
        };
        
        localStorage.setItem('user', JSON.stringify(userToSave));
        showAlert('registerAlert', '✅ Регистрация успешна! Переход...', 'success');
        
        setTimeout(() => {
            // ✅ ИСПРАВЛЕНО: Все редиректы здесь
            if (userToSave.role === 'admin') {
                window.location.href = 'admin3.html';
            } else if (userToSave.role === 'worker') {
                window.location.href = 'worker.html';
            } else {
                showUserPage(userToSave);
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Ошибка:', error);
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
        const response = await fetch(`${API_AUTH}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showAlert('loginAlert', `❌ ${data.message || 'Ошибка входа'}`, 'error');
            return;
        }
        
        const userToSave = {
            id: data.id,
            username: data.username,
            email: data.email,
            role: data.role || 'user',
            token: data.token
        };
        
        localStorage.setItem('user', JSON.stringify(userToSave));
        showAlert('loginAlert', '✅ Добро пожаловать!', 'success');
        
        setTimeout(() => {
            // ✅ ИСПРАВЛЕНО: Редиректы только здесь
            if (userToSave.role === 'admin') {
                window.location.href = 'admin3.html';
            } else if (userToSave.role === 'worker') {
                window.location.href = 'worker.html';
            } else {
                showUserPage(userToSave);
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Ошибка:', error);
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
    alertDiv.style.display = 'block';
    console.log(`📢 [${type}] ${message}`);
}

// ============ ПОКАЗ СТРАНИЦЫ ПОЛЬЗОВАТЕЛЯ ============
// ✅ ИСПРАВЛЕНО: БЕЗ редиректов (уже в setTimeout выше)
function showUserPage(userData) {
    console.log('📊 Загрузка dashboard для:', userData.username);
    currentUser = userData;
    
    const authPage = document.getElementById('authPage');
    const userPage = document.getElementById('userPage');
    
    if (authPage) authPage.style.display = 'none';
    if (userPage) userPage.style.display = 'block';
    
    const displayName = document.getElementById('userDisplayName');
    if (displayName) displayName.textContent = `👤 ${userData.username}`;
    
    showStep(1);
}

function showStep(step) {
  console.log('showStep called with', step);
}

// ============ ВЫХОД ============
function logout() {
    console.log('🚪 Выход...');
    localStorage.removeItem('user');
    currentUser = null;
    
    const authPage = document.getElementById('authPage');
    const userPage = document.getElementById('userPage');
    
    if (authPage) authPage.style.display = 'flex';
    if (userPage) userPage.style.display = 'none';
    
    document.getElementById('registerForm')?.reset();
    document.getElementById('loginForm')?.reset();
}

// ... остальные функции (selectPayment, incrementRoom и т.д.)
