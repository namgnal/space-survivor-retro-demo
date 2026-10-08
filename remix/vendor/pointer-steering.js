const isPoint = point => point != null
    && Number.isFinite(point.x) && Number.isFinite(point.y);
export class PointerSteering {
    constructor({ holdMs = 1200, deadzone = 6 } = {}) {
        if (!Number.isFinite(holdMs) || holdMs < 0) {
            throw new RangeError('holdMs must be a finite non-negative number');
        }
        if (!Number.isFinite(deadzone) || deadzone < 0) {
            throw new RangeError('deadzone must be a finite non-negative number');
        }
        this._holdMs = holdMs;
        this._deadzone = deadzone;
        this.cancel();
    }
    press(point, nowMs) {
        if (!isPoint(point)) {
            this.cancel();
            return;
        }
        if (!this._refresh(nowMs))
            return;
        if (this._latched) {
            this.cancel();
            return;
        }
        if (this._pressed)
            return;
        this._point = { x: point.x, y: point.y };
        this._pressed = true;
        this._pressedAt = nowMs;
        this._lastNow = nowMs;
        this._refresh(nowMs);
    }
    move(point) {
        if (!isPoint(point)) {
            this.cancel();
            return;
        }
        if (this._point)
            this._point = { x: point.x, y: point.y };
    }
    release(nowMs) {
        if (!this._refresh(nowMs) || !this._pressed)
            return;
        if (!this._latched) {
            this.cancel();
            return;
        }
        this._pressed = false;
        this._pressedAt = null;
    }
    direction(origin, nowMs) {
        if (!isPoint(origin)) {
            this.cancel();
            return { x: 0, y: 0 };
        }
        if (!this._refresh(nowMs) || !this._point)
            return { x: 0, y: 0 };
        const dx = this._point.x - origin.x;
        const dy = this._point.y - origin.y;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
            this.cancel();
            return { x: 0, y: 0 };
        }
        if (Math.hypot(dx, dy) <= this._deadzone)
            return { x: 0, y: 0 };
        const scale = Math.max(Math.abs(dx), Math.abs(dy));
        const x = dx / scale;
        const y = dy / scale;
        const length = Math.hypot(x, y);
        return { x: x / length, y: y / length };
    }
    inspect(nowMs) {
        this._refresh(nowMs);
        return {
            active: this._point !== null,
            pressed: this._pressed,
            latched: this._latched,
            holdProgress: this._holdProgress,
            point: this._point ? { ...this._point } : null,
        };
    }
    cancel() {
        this._point = null;
        this._pressed = false;
        this._latched = false;
        this._holdProgress = 0;
        this._pressedAt = null;
        this._lastNow = null;
    }
    _refresh(nowMs) {
        if (!Number.isFinite(nowMs)
            || (this._lastNow !== null && nowMs < this._lastNow)) {
            this.cancel();
            return false;
        }
        if (!this._point)
            return true;
        this._lastNow = nowMs;
        if (this._pressed) {
            this._holdProgress = this._holdMs === 0
                ? 1 : Math.min(1, (nowMs - this._pressedAt) / this._holdMs);
            if (this._holdProgress >= 1)
                this._latched = true;
        }
        return true;
    }
}
