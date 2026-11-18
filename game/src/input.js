// Sunset Vice — keyboard and mouse input. The simulation reads only the
// plain object this module hands it ({axis, shift}), so the same input shape
// drives both the live game and the headless tests.
const KEYS = new Set();

let mouseX = 0;
let mouseY = 0;
let clickQueued = false;
let attached = false;

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'enter',
  KeyF: 'punch',
  KeyP: 'pause',
  KeyM: 'mute',
  Space: 'start',
};

// The movement vector for this frame, from WASD / arrow keys.
export function axis() {
  let x = 0;
  let y = 0;
  if (KEYS.has('left')) x -= 1;
  if (KEYS.has('right')) x += 1;
  if (KEYS.has('up')) y -= 1;
  if (KEYS.has('down')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.hypot(x, y);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

// True while Shift is held (run).
export function running() {
  return KEYS.has('run');
}

// True once when a key was pressed since the last call, then forgotten.
export function pressed(name) {
  if (KEYS.has(name)) {
    KEYS.delete(name);
    return true;
  }
  return false;
}

// The last mouse position in canvas pixels, and whether a click is waiting.
export function mouse() {
  return { x: mouseX, y: mouseY };
}

export function consumeClick() {
  const c = clickQueued;
  clickQueued = false;
  return c;
}

// Hook the listeners onto a canvas (once). Keys are tracked by their mapped
// names; Space and arrows do not scroll the page while playing.
export function attach(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      KEYS.add(name);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) KEYS.delete(name);
  });
  window.addEventListener('blur', () => KEYS.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    clickQueued = true;
  });
}
