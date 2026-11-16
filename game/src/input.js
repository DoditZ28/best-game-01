// Input for Starshard Drift: keyboard (WASD/arrows), mouse aim and click,
// dash on Space or click, plus the one-shot edges the menus need.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.pressed = new Set(); // keys pressed since last poll
    this.clicked = false; // mouse click since last poll
    this.clickPos = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.down = true;
      this.clicked = true;
      this.clickPos.x = this.mouse.x;
      this.clickPos.y = this.mouse.y;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    // Touch: drag to move, tap to dash.
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const r = canvas.getBoundingClientRect();
      this.mouse.x = t.clientX - r.left;
      this.mouse.y = t.clientY - r.top;
      this.clicked = true;
      this.clickPos.x = this.mouse.x;
      this.clickPos.y = this.mouse.y;
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const r = canvas.getBoundingClientRect();
      this.mouse.x = t.clientX - r.left;
      this.mouse.y = t.clientY - r.top;
    }, { passive: false });
  }

  // Movement vector from WASD/arrows, normalised; {x, y} in [-1, 1].
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  // True once for a key pressed since the last call to endFrame.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  dashRequested() {
    return this.wasPressed(' ') || this.wasPressed('shift') || this.clicked;
  }

  // Call at the end of every frame so edges fire exactly once.
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
