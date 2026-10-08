import { PointerSteering } from './vendor/pointer-steering.js';
const moveKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
export class TrialControls {
    constructor(read, now = () => performance.now()) {
        this.read = read;
        this.now = now;
        this.pointer = new PointerSteering();
        this.keys = new Set();
        this.finger = null;
        this.stoppedUntil = 0;
    }
    clearMovement() { const t = this.read().touch; t.active = false; t.dx = 0; t.dy = 0; }
    cancel() { this.pointer.cancel(); this.keys.clear(); this.finger = null; this.clearMovement(); }
    suspend() {
        const now = this.now();
        if (this.pointer.inspect(now).latched)
            this.pointer.release(now);
        else
            this.pointer.cancel();
        this.keys.clear();
        this.finger = null;
        this.clearMovement();
    }
    press(point, type = 'mouse', id = 0) {
        if (this.read().state.screen !== 'playing')
            return;
        this.keys.clear();
        this.clearMovement();
        if (type === 'touch') {
            if (this.finger)
                return;
            this.pointer.cancel();
            this.finger = { id, origin: point, point };
            return;
        }
        const wasFollowing = this.pointer.inspect(this.now()).latched;
        this.finger = null;
        this.pointer.press(point, this.now());
        this.stoppedUntil = wasFollowing ? this.now() + 1800 : 0;
    }
    move(point, type = 'mouse', id = 0) {
        if (this.read().state.screen !== 'playing') {
            this.suspend();
            return;
        }
        if (type === 'touch') {
            if (this.finger?.id === id)
                this.finger.point = point;
        }
        else
            this.pointer.move(point);
    }
    release(type = 'mouse', id = 0) {
        if (type === 'touch') {
            if (this.finger?.id === id) {
                this.finger = null;
                this.clearMovement();
            }
            return;
        }
        if (this.read().state.screen !== 'playing')
            this.suspend();
        this.pointer.release(this.now());
        this.clearMovement();
    }
    keyDown(key) {
        if (!moveKeys.has(key) || this.read().state.screen !== 'playing')
            return false;
        this.pointer.cancel();
        this.finger = null;
        this.keys.add(key);
        return true;
    }
    keyUp(key) { this.keys.delete(key); if (!this.keys.size)
        this.clearMovement(); }
    resize() {
        this.suspend();
        const { canvas } = this.read();
        this.pointer.move({ x: canvas.width / 2, y: canvas.height / 2 });
    }
    input() {
        const { state, touch, canvas } = this.read();
        this.clearMovement();
        if (state.screen !== 'playing')
            return;
        let x = 0, y = 0;
        if (this.keys.size) {
            x = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
            y = Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup'));
        }
        else if (this.finger) {
            x = this.finger.point.x - this.finger.origin.x;
            y = this.finger.point.y - this.finger.origin.y;
        }
        else {
            ({ x, y } = this.pointer.direction({ x: canvas.width / 2, y: canvas.height / 2 }, this.now()));
        }
        touch.active = x !== 0 || y !== 0;
        touch.dx = x;
        touch.dy = y;
    }
    inspect() { return { ...this.pointer.inspect(this.now()), keyboard: [...this.keys], touchActive: this.finger !== null }; }
    hint() {
        const { state } = this.read(), p = this.inspect();
        if (state.screen === 'menu' || state.screen === 'gameover')
            return '';
        if (state.screen !== 'playing')
            return p.latched ? '移动已暂停 · 返回后继续跟随' : '';
        if (p.latched)
            return p.pressed ? '跟随已开启 · 可以松开左键' : '鼠标跟随中 · 左击停止';
        if (p.pressed)
            return `再按住 ${(1.2 * (1 - p.holdProgress)).toFixed(1)} 秒即可松手跟随`;
        if (this.now() < this.stoppedUntil)
            return '已停止跟随';
        return state.gameTime < 6 ? '按住左键移动 · 长按 1.2 秒可松手跟随' : '';
    }
    bind(canvas) {
        const point = e => {
            const rect = canvas.getBoundingClientRect();
            return { x: (e.clientX - rect.left) * canvas.width / rect.width, y: (e.clientY - rect.top) * canvas.height / rect.height };
        };
        canvas.addEventListener('pointerdown', e => {
            if (e.button !== 0 || this.read().state.screen !== 'playing')
                return;
            if (e.pointerType === 'touch' && this.finger)
                return;
            e.preventDefault();
            this.press(point(e), e.pointerType, e.pointerId);
            if (e.pointerType === 'touch')
                canvas.setPointerCapture(e.pointerId);
        });
        window.addEventListener('pointermove', e => {
            const p = point(e);
            if (e.pointerType !== 'touch' && (p.x < 0 || p.y < 0 || p.x > canvas.width || p.y > canvas.height)) {
                this.cancel();
                return;
            }
            if (e.target === canvas || this.finger?.id === e.pointerId)
                this.move(p, e.pointerType, e.pointerId);
        });
        window.addEventListener('pointerup', e => { if (e.button === 0)
            this.release(e.pointerType, e.pointerId); });
        window.addEventListener('pointercancel', () => this.cancel());
        document.addEventListener('mouseleave', () => this.cancel());
        window.addEventListener('resize', () => this.resize());
    }
}
