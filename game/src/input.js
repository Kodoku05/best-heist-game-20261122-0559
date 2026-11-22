// Keyboard + mouse input. One clear job: turn browser events into the
// small input object the world simulation reads every frame.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    moveX: 0,
    moveY: 0,
    sneak: false,
    sprint: false,
    interactHeld: false,
    interactPressed: false,
    coinTarget: null, // {x, y} in canvas pixels, set on click, consumed by world
    smokePressed: false,
    empPressed: false,
    pausePressed: false,
    mutePressed: false,
    restartPressed: false,
    anyKeyPressed: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
  };

  function updateMove() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    input.moveX = len > 0 ? x / len : 0;
    input.moveY = len > 0 ? y / len : 0;
    input.sneak = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight');
    input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.interactHeld = keys.has('KeyE') || keys.has('Space');
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.anyKeyPressed = true;
      if (event.code === 'KeyE' || event.code === 'Space') input.interactPressed = true;
      if (event.code === 'KeyQ') input.smokePressed = true;
      if (event.code === 'KeyF') input.empPressed = true;
      if (event.code === 'KeyP' || event.code === 'Escape') input.pausePressed = true;
      if (event.code === 'KeyM') input.mutePressed = true;
      if (event.code === 'KeyR') input.restartPressed = true;
    }
    keys.add(event.code);
    updateMove();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    updateMove();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    updateMove();
  });

  function canvasPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPos(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = canvasPos(event);
    input.mouseX = p.x;
    input.mouseY = p.y;
    input.mouseDown = true;
    input.coinTarget = { x: p.x, y: p.y };
  });
  canvas.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  input.endFrame = function endFrame() {
    input.interactPressed = false;
    input.smokePressed = false;
    input.empPressed = false;
    input.pausePressed = false;
    input.mutePressed = false;
    input.restartPressed = false;
    input.anyKeyPressed = false;
    input.coinTarget = null;
  };
  return input;
}
