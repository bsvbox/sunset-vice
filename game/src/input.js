// Keyboard + mouse input. Keys are tracked by code; the game reads the
// pressed set each frame. Mouse position is kept in screen pixels and the
// aim angle is computed by the simulation from the camera.
export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    anyKey: false,
    attach(el) {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        keys.add(e.code);
        input.anyKey = true;
      });
      window.addEventListener('keyup', (e) => keys.delete(e.code));
      window.addEventListener('blur', () => keys.clear());
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        input.mouseX = e.clientX - r.left;
        input.mouseY = e.clientY - r.top;
      });
      el.addEventListener('mousedown', (e) => {
        input.mouseDown = true;
        input.clicked = true;
        const r = el.getBoundingClientRect();
        input.mouseX = e.clientX - r.left;
        input.mouseY = e.clientY - r.top;
      });
      window.addEventListener('mouseup', () => { input.mouseDown = false; });
    },
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    pressed(code) { return keys.has(code); },
    consumeClick() {
      const c = input.clicked;
      input.clicked = false;
      return c;
    },
  };
  return input;
}
