// Sunset Vice — keyboard and mouse state. The sim reads a plain axis
// vector each tick; the browser shell feeds keys and clicks into this file.
const held = new Set();
const tapped = new Set();
const mouse = { x: 0, y: 0, down: false, clicked: false };

export function attach(canvas) {
  window.addEventListener('keydown', (ev) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    if (!ev.repeat) tapped.add(ev.code);
    held.add(ev.code);
  });
  window.addEventListener('keyup', (ev) => held.delete(ev.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - rect.left;
    mouse.y = ev.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (ev) => {
    mouse.down = true;
    mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - rect.left;
    mouse.y = ev.clientY - rect.top;
    ev.preventDefault();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
}

// WASD or arrows as a normalised {x, y}: +x east, +y south (screen space).
export function axis() {
  let x = 0;
  let y = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { const inv = 1 / Math.hypot(x, y); x *= inv; y *= inv; }
  return { x, y };
}

export function running() {
  return held.has('ShiftLeft') || held.has('ShiftRight');
}

// Edge-triggered: true once per physical press until the frame consumes it.
export function pressed(code) {
  return tapped.has(code);
}

export function endFrame() {
  tapped.clear();
}

export function mousePos() {
  return mouse;
}

export function consumeClick() {
  const was = mouse.clicked;
  mouse.clicked = false;
  return was;
}
