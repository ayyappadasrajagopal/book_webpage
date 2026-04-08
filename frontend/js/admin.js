/**
 * Admin Dashboard — handles user management, PDF management, logs, and stats.
 */
(function () {
    // Auth guard
    if (!Auth.requireAuth()) return;

    const user = Auth.getUser();
    if (!user || user.role !== 'admin') {
        window.location.href = '/dashboard';
        return;
    }

    document.getElementById('adminUserName').textContent = user.full_name;

    // --- Navigation ---
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`section-${item.dataset.section}`).classList.add('active');
        });
    });

    // --- Overview Stats ---
    async function loadStats() {
        try {
            const res = await API.get('/api/admin/stats');
            if (res.ok) {
                const stats = await res.json();
                document.getElementById('statUsers').textContent = stats.total_users;
                document.getElementById('statActiveUsers').textContent = stats.active_users;
                document.getElementById('statPdfs').textContent = stats.total_pdfs;
                document.getElementById('statAnnotations').textContent = stats.total_annotations;
                document.getElementById('statNotes').textContent = stats.total_notes;
                document.getElementById('statStorage').textContent = formatBytes(stats.storage_bytes);
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    // --- Recent Activity ---
    async function loadRecentLogs() {
        try {
            const res = await API.get('/api/admin/logs?limit=10');
            if (res.ok) {
                const logs = await res.json();
                const tbody = document.getElementById('recentLogs');
                tbody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${formatDate(log.created_at)}</td>
                        <td>${escapeHtml(log.user_email)}</td>
                        <td><span class="badge badge-user">${log.action}</span></td>
                        <td>${escapeHtml(log.details)}</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    }

    // --- User Management ---
    let users = [];

    async function loadUsers() {
        try {
            const res = await API.get('/api/users/');
            if (res.ok) {
                users = await res.json();
                renderUsersTable();
            }
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    }

    function renderUsersTable() {
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${escapeHtml(u.full_name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td><span class="badge badge-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-ghost" onclick="editUser('${u.id}')" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="deleteUser('${u.id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    // Add User
    document.getElementById('addUserBtn').addEventListener('click', () => {
        Modal.show('Add User', `
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="newUserName" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="newUserEmail" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="newUserPassword" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="newUserRole">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        `, async (overlay) => {
            const data = {
                full_name: overlay.querySelector('#newUserName').value,
                email: overlay.querySelector('#newUserEmail').value,
                password: overlay.querySelector('#newUserPassword').value,
                role: overlay.querySelector('#newUserRole').value,
            };

            try {
                const res = await API.post('/api/users/', data);
                if (res.ok) {
                    Toast.success('User created');
                    await loadUsers();
                } else {
                    const err = await res.json();
                    Toast.error(err.detail || 'Failed to create user');
                }
            } catch (err) {
                Toast.error('Failed to create user');
            }
        }, 'Create User');
    });

    window.editUser = function (userId) {
        const u = users.find(x => x.id === userId);
        if (!u) return;

        Modal.show('Edit User', `
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="editUserName" value="${escapeHtml(u.full_name)}">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="editUserEmail" value="${escapeHtml(u.email)}">
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="editUserRole">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="editUserActive" ${u.is_active ? 'checked' : ''}> Active
                </label>
            </div>
        `, async (overlay) => {
            const updates = {
                full_name: overlay.querySelector('#editUserName').value,
                email: overlay.querySelector('#editUserEmail').value,
                role: overlay.querySelector('#editUserRole').value,
                is_active: overlay.querySelector('#editUserActive').checked,
            };

            try {
                const res = await API.put(`/api/users/${userId}`, updates);
                if (res.ok) {
                    Toast.success('User updated');
                    await loadUsers();
                } else {
                    const err = await res.json();
                    Toast.error(err.detail || 'Failed to update');
                }
            } catch (err) {
                Toast.error('Failed to update user');
            }
        }, 'Save Changes');
    };

    window.deleteUser = function (userId) {
        Modal.confirm('Delete User', 'Are you sure? This will delete all their data.', async () => {
            try {
                const res = await API.delete(`/api/users/${userId}`);
                if (res.ok || res.status === 204) {
                    Toast.success('User deleted');
                    await loadUsers();
                } else {
                    const err = await res.json();
                    Toast.error(err.detail || 'Failed to delete');
                }
            } catch (err) {
                Toast.error('Failed to delete user');
            }
        });
    };

    // --- PDF Management ---
    async function loadPdfs() {
        try {
            const res = await API.get('/api/pdfs/');
            if (res.ok) {
                const pdfs = await res.json();
                renderPdfsTable(pdfs);
            }
        } catch (err) {
            console.error('Failed to load PDFs:', err);
        }
    }

    function renderPdfsTable(pdfs) {
        const tbody = document.getElementById('pdfsTable');
        tbody.innerHTML = pdfs.map(p => `
            <tr>
                <td>${escapeHtml(p.original_name)}</td>
                <td>${formatBytes(p.file_size)}</td>
                <td>${p.owner_id.substring(0, 8)}...</td>
                <td>${p.is_public ? '✅' : '❌'}</td>
                <td>${formatDate(p.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-ghost" onclick="adminDeletePdf('${p.id}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    window.adminDeletePdf = function (pdfId) {
        Modal.confirm('Delete PDF', 'This will permanently delete this PDF.', async () => {
            try {
                const res = await API.delete(`/api/pdfs/${pdfId}`);
                if (res.ok || res.status === 204) {
                    Toast.success('PDF deleted');
                    await loadPdfs();
                    await loadStats();
                }
            } catch (err) {
                Toast.error('Failed to delete PDF');
            }
        });
    };

    // --- Activity Logs ---
    async function loadLogs(action = '') {
        try {
            let url = '/api/admin/logs?limit=200';
            if (action) url += `&action=${action}`;
            const res = await API.get(url);
            if (res.ok) {
                const logs = await res.json();
                renderLogsTable(logs);
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        }
    }

    function renderLogsTable(logs) {
        const tbody = document.getElementById('logsTable');
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${formatDate(log.created_at)}</td>
                <td>${escapeHtml(log.user_email)}</td>
                <td><span class="badge badge-user">${log.action}</span></td>
                <td>${escapeHtml(log.details)}</td>
                <td>${log.ip_address}</td>
            </tr>
        `).join('');
    }

    document.getElementById('logActionFilter').addEventListener('change', (e) => {
        loadLogs(e.target.value);
    });

    document.getElementById('refreshLogs').addEventListener('click', () => {
        const action = document.getElementById('logActionFilter').value;
        loadLogs(action);
    });

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // --- Initial Load ---
    loadStats();
    loadRecentLogs();
    loadUsers();
    loadPdfs();
    loadLogs();
})();
