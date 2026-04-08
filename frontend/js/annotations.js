/**
 * Annotation Manager — handles drawing annotations on the canvas overlay,
 * saving/loading from the API, and managing annotation tools.
 */
const AnnotationManager = {
    currentTool: 'select',
    annotations: [],
    isDrawing: false,
    startX: 0,
    startY: 0,
    freehandPath: [],
    currentColor: '#FFFF00',
    currentStroke: 2,

    init() {
        const canvas = document.getElementById('annotationCanvas');

        // Tool selection
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
            });
        });

        // Color and stroke
        document.getElementById('annotColor').addEventListener('input', (e) => {
            this.currentColor = e.target.value;
        });
        document.getElementById('strokeWidth').addEventListener('change', (e) => {
            this.currentStroke = parseFloat(e.target.value);
        });

        // Canvas events
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', () => { this.isDrawing = false; });
    },

    onMouseDown(e) {
        if (this.currentTool === 'select') return;
        const rect = e.target.getBoundingClientRect();
        this.startX = e.clientX - rect.left;
        this.startY = e.clientY - rect.top;
        this.isDrawing = true;
        this.freehandPath = [{ x: this.startX, y: this.startY }];
    },

    onMouseMove(e) {
        if (!this.isDrawing) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool === 'freehand') {
            this.freehandPath.push({ x, y });
            this.redrawAnnotations();
            this.drawFreehandPreview();
        } else {
            this.redrawAnnotations();
            this.drawShapePreview(x, y);
        }
    },

    async onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const rect = e.target.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        if (this.currentTool === 'text_note') {
            const content = prompt('Enter note text:');
            if (!content) return;
            await this.saveAnnotation({
                annotation_type: 'text_note',
                content: content,
                position_x: this.startX,
                position_y: this.startY,
                width: 0,
                height: 0,
            });
        } else if (this.currentTool === 'freehand') {
            await this.saveAnnotation({
                annotation_type: 'freehand',
                path_data: JSON.stringify(this.freehandPath),
                position_x: this.startX,
                position_y: this.startY,
                width: 0,
                height: 0,
            });
        } else {
            const w = endX - this.startX;
            const h = endY - this.startY;
            if (Math.abs(w) < 3 && Math.abs(h) < 3) return;

            await this.saveAnnotation({
                annotation_type: this.currentTool,
                position_x: Math.min(this.startX, endX),
                position_y: Math.min(this.startY, endY),
                width: Math.abs(w),
                height: Math.abs(h),
            });
        }

        this.freehandPath = [];
    },

    async saveAnnotation(data) {
        if (!PDFViewer.currentPdfId) return;

        const payload = {
            pdf_id: PDFViewer.currentPdfId,
            page_number: PDFViewer.currentPage,
            color: this.currentColor,
            stroke_width: this.currentStroke,
            content: '',
            path_data: '',
            ...data,
        };

        try {
            const res = await API.post('/api/annotations/', payload);
            if (res.ok) {
                Toast.success('Annotation saved');
                await this.loadAnnotations();
            } else {
                const err = await res.json();
                Toast.error(err.detail || 'Failed to save');
            }
        } catch (err) {
            Toast.error('Failed to save annotation');
        }
    },

    async loadAnnotations() {
        if (!PDFViewer.currentPdfId) return;

        try {
            const res = await API.get(`/api/annotations/pdf/${PDFViewer.currentPdfId}?page=${PDFViewer.currentPage}`);
            if (res.ok) {
                this.annotations = await res.json();
                this.redrawAnnotations();
                this.renderAnnotationList();
            }
        } catch (err) {
            console.error('Failed to load annotations:', err);
        }
    },

    onPageRendered(pageNum) {
        this.loadAnnotations();
    },

    redrawAnnotations() {
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const ann of this.annotations) {
            if (!ann.is_visible) continue;
            this.drawAnnotation(ctx, ann);
        }
    },

    drawAnnotation(ctx, ann) {
        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color + '40';
        ctx.lineWidth = ann.stroke_width;

        switch (ann.annotation_type) {
            case 'highlight':
                ctx.fillStyle = ann.color + '50';
                ctx.fillRect(ann.position_x, ann.position_y, ann.width, ann.height);
                break;

            case 'rectangle':
                ctx.strokeRect(ann.position_x, ann.position_y, ann.width, ann.height);
                break;

            case 'circle':
                ctx.beginPath();
                ctx.ellipse(
                    ann.position_x + ann.width / 2,
                    ann.position_y + ann.height / 2,
                    ann.width / 2,
                    ann.height / 2,
                    0, 0, Math.PI * 2
                );
                ctx.stroke();
                break;

            case 'arrow':
                this.drawArrow(ctx, ann.position_x, ann.position_y,
                    ann.position_x + ann.width, ann.position_y + ann.height);
                break;

            case 'freehand':
                if (ann.path_data) {
                    try {
                        const points = JSON.parse(ann.path_data);
                        if (points.length > 1) {
                            ctx.beginPath();
                            ctx.moveTo(points[0].x, points[0].y);
                            for (let i = 1; i < points.length; i++) {
                                ctx.lineTo(points[i].x, points[i].y);
                            }
                            ctx.stroke();
                        }
                    } catch (e) { /* skip invalid */ }
                }
                break;

            case 'text_note':
                // Draw marker
                ctx.fillStyle = ann.color;
                ctx.beginPath();
                ctx.arc(ann.position_x, ann.position_y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('N', ann.position_x, ann.position_y + 3.5);
                break;
        }
    },

    drawArrow(ctx, x1, y1, x2, y2) {
        const headLen = 12;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    },

    drawShapePreview(x, y) {
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = this.currentColor;
        ctx.fillStyle = this.currentColor + '30';
        ctx.lineWidth = this.currentStroke;
        ctx.setLineDash([5, 5]);

        const w = x - this.startX;
        const h = y - this.startY;

        switch (this.currentTool) {
            case 'highlight':
                ctx.fillStyle = this.currentColor + '50';
                ctx.fillRect(this.startX, this.startY, w, h);
                break;
            case 'rectangle':
                ctx.strokeRect(this.startX, this.startY, w, h);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.ellipse(
                    this.startX + w / 2, this.startY + h / 2,
                    Math.abs(w / 2), Math.abs(h / 2),
                    0, 0, Math.PI * 2
                );
                ctx.stroke();
                break;
            case 'arrow':
                this.drawArrow(ctx, this.startX, this.startY, x, y);
                break;
        }

        ctx.setLineDash([]);
    },

    drawFreehandPreview() {
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');
        if (this.freehandPath.length < 2) return;

        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.currentStroke;
        ctx.beginPath();
        ctx.moveTo(this.freehandPath[0].x, this.freehandPath[0].y);
        for (let i = 1; i < this.freehandPath.length; i++) {
            ctx.lineTo(this.freehandPath[i].x, this.freehandPath[i].y);
        }
        ctx.stroke();
    },

    renderAnnotationList() {
        const container = document.getElementById('annotationList');
        if (this.annotations.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm" style="text-align:center;padding:20px;">No annotations on this page</p>';
            return;
        }

        container.innerHTML = this.annotations.map(ann => `
            <div class="annotation-item ${ann.is_visible ? '' : 'hidden-ann'}" data-id="${ann.id}">
                <div class="ann-header">
                    <span class="ann-type">${ann.annotation_type}</span>
                    <span class="ann-page">Page ${ann.page_number} · v${ann.version}</span>
                </div>
                ${ann.content ? `<div class="ann-content">${this.escapeHtml(ann.content)}</div>` : ''}
                <div class="ann-actions">
                    <button class="btn btn-sm btn-ghost" onclick="AnnotationManager.toggleVisibility('${ann.id}')" title="${ann.is_visible ? 'Hide' : 'Show'}">
                        ${ann.is_visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="AnnotationManager.deleteAnnotation('${ann.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async toggleVisibility(id) {
        try {
            const res = await API.put(`/api/annotations/${id}/toggle-visibility`, {});
            if (res.ok) {
                await this.loadAnnotations();
            }
        } catch (err) {
            Toast.error('Failed to toggle visibility');
        }
    },

    async deleteAnnotation(id) {
        Modal.confirm('Delete Annotation', 'Are you sure you want to delete this annotation?', async () => {
            try {
                const res = await API.delete(`/api/annotations/${id}`);
                if (res.ok || res.status === 204) {
                    Toast.success('Annotation deleted');
                    await this.loadAnnotations();
                }
            } catch (err) {
                Toast.error('Failed to delete');
            }
        });
    },
};
