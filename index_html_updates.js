<!-- ОБНОВИТЬ index.html - ДОБАВИТЬ ПРОВЕРКУ ROLE И РЕДИРЕКТ -->

<!-- В конце JavaScript, в функции showUserPage добавить: -->

function showUserPage(userData) {
    currentUser = userData;
    
    // ===== НОВОЕ: ПРОВЕРКА РОЛИ И РЕДИРЕКТ =====
    if (userData.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    } else if (userData.role === 'worker') {
        window.location.href = 'worker.html';
        return;
    }
    // Только если role === 'user', показываем обычный dashboard
    // ===========================================
    
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('userPage').style.display = 'block';
    document.getElementById('userDisplayName').textContent = `👤 ${userData.username}`;
    showStep(1);
}

<!-- ТАКЖЕ: В window.addEventListener('load') обновить: -->

window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        
        // ===== НОВОЕ: ПРОВЕРКА РОЛИ СРАЗУ ПРИ ЗАГРУЗКЕ =====
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        } else if (user.role === 'worker') {
            window.location.href = 'worker.html';
            return;
        }
        // ===================================================
        
        showUserPage(user);
    }
});

<!-- И обновить fetch запросы добавить заголовок X-User-Role: -->

// В registerForm submit обновить localStorage:
localStorage.setItem('user', JSON.stringify(data));
// ↓
localStorage.setItem('user', JSON.stringify({
    ...data,
    role: data.role || 'user'  // Убедиться что role есть
}));

// В saveConfiguration добавить заголовок:
const response = await fetch(API_USER_SETUP, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': currentUser.role  // ← ДОБАВИТЬ
    },
    // ... остальное ...
});