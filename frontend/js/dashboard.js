/**
 * Dashboard — main initialization and orchestration script.
 */
(function () {
    // Auth guard
    if (!Auth.requireAuth()) return;

    const user = Auth.getUser();

    // Set user name
    document.getElementById('userName').textContent = user ? user.full_name : '';

    // Show admin link for admins
    if (user && user.role === 'admin') {
        document.getElementById('adminLink').style.display = 'inline-flex';
    }

    // Initialize modules
    PDFViewer.init();
    AnnotationManager.init();
    NotesManager.init();
    DrawingPad.init();

    // --- PDF Library ---
    let pdfs = [];
    let activePdfId = null;

    async function loadPdfList() {
        try {
            const res = await API.get('/api/pdfs/');
            if (res.ok) {
                pdfs = await res.json();
                renderPdfList();
            }
        } catch (err) {
            console.error('Failed to load PDFs:', err);
        }
    }

    function renderPdfList() {
        const container = document.getElementById('pdfList');
        const emptyEl = document.getElementById('noPdfs');

        if (pdfs.length === 0) {
            emptyEl.style.display = 'flex';
            container.innerHTML = '';
            container.appendChild(emptyEl);
            return;
        }

        emptyEl.style.display = 'none';
        container.innerHTML = pdfs.map(pdf => `
            <div class="pdf-item ${pdf.id === activePdfId ? 'active' : ''}" data-id="${pdf.id}">
                <div class="pdf-icon">PDF</div>
                <div class="pdf-info">
                    <div class="pdf-name" title="${escapeHtml(pdf.original_name)}">${escapeHtml(pdf.original_name)}</div>
                    <div class="pdf-meta">${formatBytes(pdf.file_size)}</div>
                </div>
                <div class="pdf-actions">
                    <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); deletePdf('${pdf.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');

        // Click to open
        container.querySelectorAll('.pdf-item').forEach(item => {
            item.addEventListener('click', () => openPdf(item.dataset.id));
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function openPdf(pdfId) {
        activePdfId = pdfId;
        renderPdfList();
        await PDFViewer.loadPdf(pdfId);
        await NotesManager.loadNotes();
    }

    window.deletePdf = async function (pdfId) {
        Modal.confirm('Delete PDF', 'This will permanently delete this PDF and all its annotations and notes.', async () => {
            try {
                const res = await API.delete(`/api/pdfs/${pdfId}`);
                if (res.ok || res.status === 204) {
                    Toast.success('PDF deleted');
                    if (activePdfId === pdfId) {
                        PDFViewer.close();
                        activePdfId = null;
                    }
                    await loadPdfList();
                }
            } catch (err) {
                Toast.error('Failed to delete PDF');
            }
        });
    };

    // --- Upload ---
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            const res = await API.uploadFile('/api/pdfs/upload', file);
            if (res.ok) {
                Toast.success('PDF uploaded successfully');
                await loadPdfList();
                const newPdf = await res.json();
                openPdf(newPdf.id);
            } else {
                const err = await res.json();
                Toast.error(err.detail || 'Upload failed');
            }
        } catch (err) {
            Toast.error('Upload failed');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '+ Upload';
            fileInput.value = '';
        }
    });

    // --- Sidebar Tabs ---
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`panel-${tab.dataset.panel}`).classList.add('active');
        });
    });

    // --- Global Search ---
    let searchTimeout;
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        searchTimeout = setTimeout(() => performSearch(q), 300);
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => { searchResults.style.display = 'none'; }, 200);
    });

    async function performSearch(query) {
        try {
            const res = await API.get(`/api/search/?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                renderSearchResults(data);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    }

    function renderSearchResults(data) {
        let html = '';

        if (data.pdfs && data.pdfs.length > 0) {
            html += '<h4 style="padding:8px 12px;color:var(--text-muted);font-size:0.75rem;">PDFs</h4>';
            data.pdfs.forEach(p => {
                html += `<div class="pdf-item" style="padding:8px 12px;cursor:pointer;" onclick="openPdf('${p.id}')">
                    <div class="pdf-icon">PDF</div>
                    <div class="pdf-info"><div class="pdf-name">${escapeHtml(p.name)}</div></div>
                </div>`;
            });
        }

        if (data.annotations && data.annotations.length > 0) {
            html += '<h4 style="padding:8px 12px;color:var(--text-muted);font-size:0.75rem;">Annotations</h4>';
            data.annotations.forEach(a => {
                html += `<div style="padding:8px 12px;font-size:0.85rem;cursor:pointer;" onclick="openPdf('${a.pdf_id}')">
                    <span class="badge badge-admin">${a.type}</span> ${escapeHtml(a.content)}
                </div>`;
            });
        }

        if (data.notes && data.notes.length > 0) {
            html += '<h4 style="padding:8px 12px;color:var(--text-muted);font-size:0.75rem;">Notes</h4>';
            data.notes.forEach(n => {
                html += `<div style="padding:8px 12px;font-size:0.85rem;cursor:pointer;" onclick="openPdf('${n.pdf_id}')">
                    <strong>${escapeHtml(n.title)}</strong> ${escapeHtml(n.content)}
                </div>`;
            });
        }

        if (!html) {
            html = '<p style="padding:16px;text-align:center;color:var(--text-muted);">No results found</p>';
        }

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
    }

    // Make openPdf available globally for search results
    window.openPdf = openPdf;

    // --- Initial load ---
    loadPdfList();
})();
