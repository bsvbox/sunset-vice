// Keyboard + mouse input. WASD/arrows move, E enters/exits a car, Space punches,
// mouse aims and click shoots, P/Esc pauses, M mutes. Touch is not supported:
// this is a desktop keyboard-and-mouse game.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    actions: 0,
  };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    const key = event.key.toLowerCase();
    if (!event.repeat) {
      if (key === ' ' || key === 'enter') state.actions |= ACTION_CONFIRM | ACTION_PUNCH;
      if (key === 'p' || key === 'escape') state.actions |= ACTION_PAUSE;
      if (key === 'e') state.actions |= ACTION_ENTER;
      if (key === 'm') state.actions |= ACTION_MUTE;
    }
    keys.add(key);
  }
  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = event.clientX - rect.left;
    state.mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      state.mouseDown = true;
      state.actions |= ACTION_SHOOT | ACTION_CONFIRM;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // -1..1 on each axis, from WASD or arrows.
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y };
    },
    running() {
      return keys.has('shift');
    },
    takeActions() {
      const actions = state.actions;
      state.actions = 0;
      return actions;
    },
    mouse() {
      return { x: state.mouseX, y: state.mouseY, down: state.mouseDown };
    },
    // Feed synthetic input (used by the screenshot autopilot).
    feed(move, mouseDown, mouse) {
      this._move = move;
      this._mouseDown = mouseDown;
      if (mouse) {
        state.mouseX = mouse.x;
        state.mouseY = mouse.y;
      }
    },
  };
}
