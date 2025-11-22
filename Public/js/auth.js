// Authentication Module
// Handles login, logout, and session management

// API endpoint
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : ''; // Empty string means same origin (works on Render)

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    const loginButton = event.target.querySelector('button[type="submit"]');

    // Clear previous errors
    errorElement.textContent = '';

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            // Successful login
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('username', username);
            sessionStorage.setItem('isLoggedIn', 'true');

            showApp();
        } else {
            // Failed login
            throw new Error(data.msg || 'Invalid username or password');
        }

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message || 'Login failed. Please try again.';
        document.getElementById('loginPassword').value = '';

        // Re-enable button
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
}

function showApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';

    // Initialize the app
    if (typeof init === 'function') {
        init();
    }
}

function checkLoginStatus() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const token = localStorage.getItem('authToken');

    if (isLoggedIn === 'true' && token) {
        showApp();
    }
}

function logout() {
    // Clear session
    sessionStorage.removeItem('isLoggedIn');
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');

    // Reset UI
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
}