// Authentication Module
// Handles login, logout, and session management
// FULLY DATABASE-DRIVEN - requires users to be created in MongoDB

// API endpoint
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : ''; // Empty string means same origin (works on Render)

// Passcode to username mapping (for frontend validation only)
// User 1 (ginaa.lee) uses passcode: 9163709968
// User 2 (lawrence) uses passcode: 9254454907
const PASSCODE_TO_USER = {
    '9163709968': 'ginaa.lee',
    '9254454907': 'lawrence'
};

async function handleLogin(event) {
    event.preventDefault();

    const passcode = document.getElementById('loginPasscode').value.trim();
    const errorElement = document.getElementById('loginError');
    const loginButton = event.target.querySelector('button[type="submit"]');

    // Clear previous errors
    errorElement.textContent = '';

    if (!passcode) {
        errorElement.textContent = 'Please enter your passcode';
        return;
    }

    // Find username by passcode
    const username = PASSCODE_TO_USER[passcode];

    if (!username) {
        errorElement.textContent = 'Invalid passcode';
        document.getElementById('loginPasscode').value = '';
        return;
    }

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Logging in...';

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password: passcode })
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
            throw new Error(data.msg || 'Invalid passcode');
        }

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message || 'Login failed. Please check your connection and try again.';
        document.getElementById('loginPasscode').value = '';

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
    document.getElementById('loginPasscode').value = '';
    document.getElementById('loginError').textContent = '';
}