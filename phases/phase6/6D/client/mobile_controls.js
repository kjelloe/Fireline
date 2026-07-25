// client/mobile_controls.js — Mobile UI & Touch Controls (6C)
// Emits normalized command events from touch gestures.
// Non-authoritative: only produces commands, never mutates game state.

export class MobileControls {
  constructor(canvas, onCommand) {
    this.canvas = canvas;
    this.onCommand = onCommand;
    this.joystickOrigin = null;
    this.joystickActive = false;
    this.pinchStartDist = null;
    this.touches = new Map();

    canvas.addEventListener('touchstart',  e => this._onTouchStart(e),  { passive: false });
    canvas.addEventListener('touchmove',   e => this._onTouchMove(e),   { passive: false });
    canvas.addEventListener('touchend',    e => this._onTouchEnd(e),    { passive: false });
  }

  _onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (e.touches.length === 1) {
      this.joystickOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.joystickActive = true;
    }
    if (e.touches.length === 2) {
      this.joystickActive = false;
      this.pinchStartDist = this._pinchDist(e.touches[0], e.touches[1]);
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (this.joystickActive && e.touches.length === 1) {
      const dx = e.touches[0].clientX - this.joystickOrigin.x;
      const dy = e.touches[0].clientY - this.joystickOrigin.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 10) {
        this.onCommand({ type: 'MOVE', dx: dx / len, dy: dy / len, magnitude: Math.min(len, 60) });
      }
    }
    if (e.touches.length === 2 && this.pinchStartDist !== null) {
      const dist = this._pinchDist(e.touches[0], e.touches[1]);
      const scale = dist / this.pinchStartDist;
      this.onCommand({ type: 'ZOOM', scale });
      this.pinchStartDist = dist;
    }
  }

  _onTouchEnd(e) {
    for (const t of e.changedTouches) {
      this.touches.delete(t.identifier);
    }
    if (e.touches.length === 0) {
      if (this.joystickActive) this.onCommand({ type: 'STOP' });
      this.joystickActive = false;
      this.joystickOrigin = null;
      this.pinchStartDist = null;
    }
  }

  _pinchDist(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy() {
    this.canvas.removeEventListener('touchstart',  this._onTouchStart);
    this.canvas.removeEventListener('touchmove',   this._onTouchMove);
    this.canvas.removeEventListener('touchend',    this._onTouchEnd);
  }
}
