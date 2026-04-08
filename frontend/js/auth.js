/**
 * Authentication module — handles login, token storage, and redirects.
 */
const Auth = {
    TOKEN_KEY: 'book_platform_token',
    USER_KEY: 'book_platform_user',

    async login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Login failed');
        }

        const data = await res.json();
        localStorage.setItem(Auth.TOKEN_KEY, data.access_token);

        // Fetch user profile
        const profile = await Auth.fetchProfile();
        localStorage.setItem(Auth.USER_KEY, JSON.stringify(profile));

        // Redirect based on role
        window.location.href = '/dashboard';
    },

    async fetchProfile() {
        const res = await fetch('/api/auth/me', {
            headers: Auth.authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        return await res.json();
    },

    getToken() {
        return localStorage.getItem(Auth.TOKEN_KEY);
    },

    getUser() {
        const u = localStorage.getItem(Auth.USER_KEY);
        return u ? JSON.parse(u) : null;
    },

    authHeaders() {
        return {
            'Authorization': `Bearer ${Auth.getToken()}`,
            'Content-Type': 'application/json',
        };
    },

    logout() {
        localStorage.removeItem(Auth.TOKEN_KEY);
        localStorage.removeItem(Auth.USER_KEY);
        window.location.href = '/';
    },

    requireAuth() {
        if (!Auth.getToken()) {
            window.location.href = '/';
            return false;
        }
        return true;
    },
};
