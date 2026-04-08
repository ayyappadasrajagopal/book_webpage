/**
 * Toast notification utility.
 */
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 3000) {
        this.init();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error', 5000); },
    info(msg) { this.show(msg, 'info'); },
};

/**
 * API helper with auth.
 */
const API = {
    async request(url, options = {}) {
        const defaults = {
            headers: Auth.authHeaders(),
        };
        const config = { ...defaults, ...options };
        if (options.headers) {
            config.headers = { ...defaults.headers, ...options.headers };
        }

        const res = await fetch(url, config);

        if (res.status === 401) {
            Auth.logout();
            return;
        }

        return res;
    },

    async get(url) {
        return this.request(url);
    },

    async post(url, body) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    async put(url, body) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    async delete(url) {
        return this.request(url, { method: 'DELETE' });
    },

    async uploadFile(url, file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
            body: formData,
        });
    },
};

/**
 * Modal helper.
 */
const Modal = {
    show(title, contentHTML, onConfirm, confirmText = 'Confirm') {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <h2>${title}</h2>
                <div class="modal-body">${contentHTML}</div>
                <div class="modal-actions">
                    <button class="btn btn-secondary modal-cancel">Cancel</button>
                    <button class="btn btn-primary modal-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        if (onConfirm) {
            overlay.querySelector('.modal-confirm').addEventListener('click', () => {
                onConfirm(overlay);
                overlay.remove();
            });
        }

        document.body.appendChild(overlay);
        return overlay;
    },

    confirm(title, message, onConfirm) {
        return this.show(title, `<p>${message}</p>`, onConfirm, 'Confirm');
    },
};

/**
 * Format bytes to human-readable.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format date to locale string.
 */
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString();
}
