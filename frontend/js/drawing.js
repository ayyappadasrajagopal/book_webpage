/**
 * Drawing / Sketchpad module — standalone canvas drawing panel.
 */
const DrawingPad = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    mode: 'pen', // 'pen' or 'eraser'
    color: '#6366f1',
    lineWidth: 2,

    init() {
        this.canvas = document.getElementById('sketchCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Resize canvas to fit container
        this.resizeCanvas();

        // Tools
        document.getElementById('sketchPen').addEventListener('click', () => {
            this.mode = 'pen';
            document.getElementById('sketchPen').classList.add('active');
            document.getElementById('sketchEraser').classList.remove('active');
        });

        document.getElementById('sketchEraser').addEventListener('click', () => {
            this.mode = 'eraser';
            document.getElementById('sketchEraser').classList.add('active');
            document.getElementById('sketchPen').classList.remove('active');
        });

        document.getElementById('sketchColor').addEventListener('input', (e) => {
            this.color = e.target.value;
        });

        document.getElementById('sketchClear').addEventListener('click', () => this.clear());
        document.getElementById('sketchSave').addEventListener('click', () => this.save());

        // Drawing events
        this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDraw());
        this.canvas.addEventListener('mouseleave', () => this.stopDraw());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDraw(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', () => this.stopDraw());

        // Fill background
        this.clear();
    },

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth - 16;
    },

    startDraw(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.beginPath();
        this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    },

    draw(e) {
        if (!this.isDrawing) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = this.mode === 'eraser' ? '#1a1a2e' : this.color;
        this.ctx.lineWidth = this.mode === 'eraser' ? 20 : this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    },

    stopDraw() {
        this.isDrawing = false;
    },

    clear() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    save() {
        // Save as data URL — could be extended to save to server
        const dataUrl = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'sketch.png';
        link.href = dataUrl;
        link.click();
        Toast.success('Drawing saved');
    },
};
