const canvas = document.getElementById('pug');
const hit = document.getElementById('pug-hit');
const menu = document.getElementById('pug-actions');
const controls = [...menu.querySelectorAll('button')];
const bark = document.getElementById('pug-bark');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const update = createPug(canvas);
let paused = false;
let visible = true;
let queued = false;
let previousRegions = '';
let heldPointer = null;
let blockClickUntil = 0;

function hitRegion(element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  return [x + width / 2, y + height / 2, width / 2, height / 2].map(Math.round);
}

function publishRegions() {
  const regions = visible && !hit.hidden
    ? [hitRegion(hit), ...(menu.hidden ? [] : controls.map(hitRegion))]
    : [];
  const serialized = JSON.stringify(regions);
  if (serialized !== previousRegions) {
    previousRegions = serialized;
    window.desktopPet.hitRegions(regions);
  }
}

function queueFrame() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(tick);
  }
}

function tick(timestamp) {
  queued = false;
  update(timestamp, null, null, paused || reducedMotion.matches);
  publishRegions();
  if (visible) queueFrame();
}

const sendLocalEvent = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

window.desktopPet.onCursor(point => sendLocalEvent('daba-cursor', point));
window.desktopPet.onSettings(settings => {
  paused = settings.paused;
  bark.muted = !settings.sound;
  sendLocalEvent('daba-follow', settings.follow);
  sendLocalEvent('daba-roam', settings.roam);
  document.body.classList.toggle('motion-paused', paused);
});
window.desktopPet.onVisible(show => {
  visible = show;
  canvas.hidden = !show;
  if (!show) {
    releasePet();
    sendLocalEvent('daba-cursor', null);
    update(performance.now(), null, null, paused || reducedMotion.matches);
    publishRegions();
  }
  queueFrame();
});
function releasePet(event) {
  if (!heldPointer || (event && event.pointerId !== heldPointer.id)) return;
  const { id, dragging, position } = heldPointer;
  heldPointer = null;
  window.desktopPet.dragState('released');
  if (hit.hasPointerCapture(id)) hit.releasePointerCapture(id);
  if (!dragging) return;
  blockClickUntil = performance.now() + 650;
  const drop = event?.type === 'pointerup' ? [event.clientX, event.clientY] : position;
  sendLocalEvent('daba-drag-end', drop);
}

window.desktopPet.onReset(() => {
  releasePet();
  sendLocalEvent('daba-home');
});
window.desktopPet.onDragPosition(point => {
  if (!heldPointer?.dragging) return;
  heldPointer.position = point;
  sendLocalEvent('daba-drag-move', point);
});
hit.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || heldPointer || !menu.hidden) return;
  blockClickUntil = 0;
  heldPointer = {
    id: event.pointerId,
    start: [event.clientX, event.clientY],
    screen: [event.screenX, event.screenY],
    position: [event.clientX, event.clientY],
    dragging: false
  };
  hit.setPointerCapture(event.pointerId);
  window.desktopPet.dragState('held');
});
hit.addEventListener('pointermove', event => {
  if (!heldPointer || event.pointerId !== heldPointer.id) return;
  if (!(event.buttons & 1)) { releasePet(event); return; }
  const { screen, start } = heldPointer;
  if (!heldPointer.dragging) {
    if (Math.hypot(event.screenX-screen[0],event.screenY-screen[1]) < 6) return;
    heldPointer.dragging = true;
    sendLocalEvent('daba-drag-start', start);
    window.desktopPet.dragState('dragging');
  }
  heldPointer.position = [event.clientX,event.clientY];
  sendLocalEvent('daba-drag-move', heldPointer.position);
});
hit.addEventListener('pointerup', releasePet);
hit.addEventListener('pointercancel', releasePet);
hit.addEventListener('lostpointercapture', releasePet);
window.addEventListener('blur', () => releasePet());
hit.addEventListener('click', event => {
  if (event.detail !== 0 && performance.now() < blockClickUntil) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
hit.addEventListener('contextmenu', event => {
  event.preventDefault();
  window.desktopPet.showControls();
});
new MutationObserver(publishRegions).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
queueFrame();
