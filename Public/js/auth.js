// Authentication Module
// Handles login, logout, and session management

const ADMIN_CREDENTIALS = {
    username: '9163709968',
    password: 'Prominence1146!'
};

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        // Successful login
        sessionStorage.setItem('isLoggedIn', 'true');
        showApp();
    } else {
        // Failed login
        errorElement.textContent = 'Invalid username or password';
        document.getElementById('loginPassword').value = '';
    }
}

function showApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
}

function checkLoginStatus() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        showApp();
    }
}

function logout() {
    sessionStorage.removeItem('isLoggedIn');
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
}
