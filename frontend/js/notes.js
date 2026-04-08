/**
 * Notes Manager — handles creating, editing, listing, and deleting notes.
 */
const NotesManager = {
    notes: [],
    editingNoteId: null,

    init() {
        document.getElementById('newNoteBtn').addEventListener('click', () => this.showEditor());
        document.getElementById('saveNoteBtn').addEventListener('click', () => this.saveNote());
        document.getElementById('cancelNoteBtn').addEventListener('click', () => this.hideEditor());
    },

    showEditor(note = null) {
        this.editingNoteId = note ? note.id : null;
        document.getElementById('noteTitle').value = note ? note.title : '';
        document.getElementById('noteContent').value = note ? note.content : '';
        document.getElementById('noteEditor').style.display = 'block';
        document.getElementById('noteTitle').focus();
    },

    hideEditor() {
        this.editingNoteId = null;
        document.getElementById('noteEditor').style.display = 'none';
    },

    async saveNote() {
        if (!PDFViewer.currentPdfId) {
            Toast.error('Open a PDF first');
            return;
        }

        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').value.trim();

        if (!title && !content) {
            Toast.error('Please add a title or content');
            return;
        }

        try {
            let res;
            if (this.editingNoteId) {
                res = await API.put(`/api/notes/${this.editingNoteId}`, { title, content });
            } else {
                res = await API.post('/api/notes/', {
                    pdf_id: PDFViewer.currentPdfId,
                    page_number: PDFViewer.currentPage,
                    title,
                    content,
                });
            }

            if (res.ok) {
                Toast.success(this.editingNoteId ? 'Note updated' : 'Note created');
                this.hideEditor();
                await this.loadNotes();
            } else {
                const err = await res.json();
                Toast.error(err.detail || 'Failed to save note');
            }
        } catch (err) {
            Toast.error('Failed to save note');
        }
    },

    async loadNotes() {
        if (!PDFViewer.currentPdfId) return;

        try {
            const res = await API.get(`/api/notes/pdf/${PDFViewer.currentPdfId}`);
            if (res.ok) {
                this.notes = await res.json();
                this.renderNoteList();
            }
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    },

    renderNoteList() {
        const container = document.getElementById('noteList');
        if (this.notes.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm" style="text-align:center;padding:20px;">No notes yet</p>';
            return;
        }

        container.innerHTML = this.notes.map(note => `
            <div class="note-item" data-id="${note.id}">
                <div class="flex items-center justify-between">
                    <div class="note-title">${this.escapeHtml(note.title || 'Untitled')}</div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-ghost" onclick="NotesManager.editNote('${note.id}')" title="Edit">✏️</button>
                        <button class="btn btn-sm btn-ghost" onclick="NotesManager.deleteNote('${note.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="note-preview">${this.escapeHtml(note.content.substring(0, 100))}</div>
                <div class="text-muted text-sm mt-2">${note.page_number ? 'Page ' + note.page_number + ' · ' : ''}${formatDate(note.created_at)}</div>
            </div>
        `).join('');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    editNote(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) this.showEditor(note);
    },

    async deleteNote(id) {
        Modal.confirm('Delete Note', 'Are you sure you want to delete this note?', async () => {
            try {
                const res = await API.delete(`/api/notes/${id}`);
                if (res.ok || res.status === 204) {
                    Toast.success('Note deleted');
                    await this.loadNotes();
                }
            } catch (err) {
                Toast.error('Failed to delete');
            }
        });
    },
};
