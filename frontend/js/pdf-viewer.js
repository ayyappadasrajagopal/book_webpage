/**
 * PDF Viewer module — handles loading, rendering, navigation, and zoom.
 * Uses PDF.js library.
 */
const PDFViewer = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.0,
    currentPdfId: null,
    rendering: false,

    init() {
        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Navigation
        document.getElementById('prevPage').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());
        document.getElementById('pageInput').addEventListener('change', (e) => {
            const p = parseInt(e.target.value);
            if (p >= 1 && p <= this.totalPages) {
                this.goToPage(p);
            }
        });

        // Zoom
        document.getElementById('zoomIn').addEventListener('click', () => this.zoom(0.2));
        document.getElementById('zoomOut').addEventListener('click', () => this.zoom(-0.2));
        document.getElementById('zoomFit').addEventListener('click', () => this.fitWidth());
    },

    async loadPdf(pdfId) {
        this.currentPdfId = pdfId;
        try {
            const token = Auth.getToken();
            const url = `/api/pdfs/${pdfId}/file`;

            const loadingTask = pdfjsLib.getDocument({
                url: url,
                httpHeaders: { 'Authorization': `Bearer ${token}` },
            });

            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            document.getElementById('totalPages').textContent = this.totalPages;
            document.getElementById('emptyViewer').style.display = 'none';
            document.getElementById('canvasWrapper').style.display = 'block';
            document.getElementById('viewerToolbar').style.display = 'flex';

            this.fitWidth();
            await this.renderPage(this.currentPage);
        } catch (err) {
            console.error('Failed to load PDF:', err);
            Toast.error('Failed to load PDF');
        }
    },

    async renderPage(pageNum) {
        if (!this.pdfDoc || this.rendering) return;
        this.rendering = true;

        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            const canvas = document.getElementById('pdfCanvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Size annotation canvas to match
            const annotCanvas = document.getElementById('annotationCanvas');
            annotCanvas.width = viewport.width;
            annotCanvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Update page input
            document.getElementById('pageInput').value = pageNum;
            this.currentPage = pageNum;

            // Notify annotation module
            if (typeof AnnotationManager !== 'undefined') {
                AnnotationManager.onPageRendered(pageNum);
            }
        } catch (err) {
            console.error('Render error:', err);
        } finally {
            this.rendering = false;
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    },

    goToPage(num) {
        if (num >= 1 && num <= this.totalPages) {
            this.renderPage(num);
        }
    },

    zoom(delta) {
        this.scale = Math.max(0.25, Math.min(5.0, this.scale + delta));
        document.getElementById('zoomLevel').textContent = Math.round(this.scale * 100) + '%';
        this.renderPage(this.currentPage);
    },

    fitWidth() {
        const viewerArea = document.getElementById('viewerArea');
        const availWidth = viewerArea.clientWidth - 60;

        if (this.pdfDoc) {
            this.pdfDoc.getPage(this.currentPage).then(page => {
                const viewport = page.getViewport({ scale: 1.0 });
                this.scale = availWidth / viewport.width;
                document.getElementById('zoomLevel').textContent = Math.round(this.scale * 100) + '%';
                this.renderPage(this.currentPage);
            });
        }
    },

    close() {
        this.pdfDoc = null;
        this.currentPdfId = null;
        document.getElementById('emptyViewer').style.display = 'flex';
        document.getElementById('canvasWrapper').style.display = 'none';
        document.getElementById('viewerToolbar').style.display = 'none';
    },
};
