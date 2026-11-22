const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const defaults = { follow: true, roam: true, sound: true, paused: false };
const isMac = process.platform === 'darwin';
const preferencePath = path.join(app.getPath('userData'), 'desktop-pet.json');
let preferences = readPreferences();
let petWindow, tray, activeDisplay, pollTimer;
let hitRegions = [], ignoreMouse = true, lastCursor = null;
let mouseHeld = false, dragging = false;

function readPreferences() {
  try {
    const stored = JSON.parse(fs.readFileSync(preferencePath, 'utf8'));
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, typeof stored?.[key] === 'boolean' ? stored[key] : value]));
  } catch {
    return { ...defaults };
  }
}

function send(channel, payload) {
  if (petWindow && !petWindow.isDestroyed() && !petWindow.webContents.isLoadingMainFrame()) {
    petWindow.webContents.send(channel, payload);
  }
}

function setPreference(key, value) {
  preferences = { ...preferences, [key]: value };
  try {
    fs.mkdirSync(path.dirname(preferencePath), { recursive: true });
    const temporary = preferencePath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(preferences));
    fs.renameSync(temporary, preferencePath);
  } catch (error) {
    console.error('Could not save desktop pet preferences:', error.message);
  }
  send('settings', preferences);
  probeCursor(false);
}

function setClickThrough(ignore) {
  if (!petWindow || petWindow.isDestroyed() || ignore === ignoreMouse) return;
  petWindow.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined);
  ignoreMouse = ignore;
}

function probeCursor(announce = true) {
  if (!petWindow || !petWindow.isVisible()) return;
  const { x, y } = screen.getCursorScreenPoint();
  if (mouseHeld) {
    lastCursor = { x, y };
    setClickThrough(false);
    if (dragging) {
      const display = screen.getDisplayNearestPoint({ x, y });
      if (display.id !== activeDisplay) {
        activeDisplay = display.id;
        hitRegions = [];
        petWindow.setBounds(display.workArea);
      }
      const { x: left, y: top } = petWindow.getContentBounds();
      send('drag-position', [x - left, y - top]);
    }
    return;
  }
  const { x: left, y: top, width, height } = petWindow.getContentBounds();
  const localX = x - left;
  const localY = y - top;
  const inWindow = localX >= 0 && localY >= 0 && localX < width && localY < height;
  setClickThrough(!inWindow || !hitRegions.some(([cx, cy, rx, ry]) =>
    ((localX - cx) / rx) ** 2 + ((localY - cy) / ry) ** 2 <= 1));
  if (x === lastCursor?.x && y === lastCursor?.y) return;
  lastCursor = { x, y };
  if (announce) send('cursor', inWindow ? [localX, localY] : null);
}

function visible(show) {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (show) {
    petWindow.showInactive();
    send('visible', true);
    probeCursor(false);
  } else {
    send('visible', false);
    mouseHeld = dragging = false;
    setClickThrough(true);
    hitRegions = [];
    petWindow.hide();
  }
  refreshTray();
}

function ontoDisplay(display) {
  activeDisplay = display.id;
  mouseHeld = dragging = false;
  hitRegions = [];
  setClickThrough(true);
  petWindow.setBounds(display.workArea);
  lastCursor = null;
  send('reset-position');
}

function refreshTray() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: petWindow?.isVisible() ? '隐藏大巴' : '显示大巴', click: () => visible(!petWindow.isVisible()) },
    { type: 'separator' },
    { label: '跟随鼠标', type: 'checkbox', checked: preferences.follow,
      click: item => setPreference('follow', item.checked) },
    { label: '空闲时散步', type: 'checkbox', checked: preferences.roam,
      click: item => setPreference('roam', item.checked) },
    { label: '叫声', type: 'checkbox', checked: preferences.sound,
      click: item => setPreference('sound', item.checked) },
    { label: '暂停动画', type: 'checkbox', checked: preferences.paused,
      click: item => setPreference('paused', item.checked) },
    { label: '回到屏幕右下角', click: () => {
      ontoDisplay(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()));
      visible(true);
    } },
    { type: 'separator' },
    { label: '退出大巴', click: () => app.quit() }
  ]));
}

function createWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  activeDisplay = display.id;
  const window = new BrowserWindow({
    ...display.workArea,
    title: app.getName(), transparent: true, backgroundColor: '#00000000',
    frame: false, hasShadow: false, resizable: false, maximizable: false,
    minimizable: false, fullscreenable: false, skipTaskbar: true, show: false,
    alwaysOnTop: true, acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false, spellcheck: false
    }
  });
  window.setIgnoreMouseEvents(true, { forward: true });
  ignoreMouse = true;
  if (isMac) window.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] },
    (_details, respond) => respond({ cancel: true }));
  window.webContents.on('did-finish-load', () => {
    send('settings', preferences);
    visible(true);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') {
      console.error('Desktop pet renderer exited:', details.reason);
      visible(false);
      if (details.reason !== 'killed') window.reload();
    }
  });
  window.loadFile(path.join(__dirname, 'pet.html')).catch(console.error);
  return window;
}

function fromPet(event) {
  return petWindow && !petWindow.isDestroyed() && event.sender === petWindow.webContents;
}

ipcMain.on('hit-regions', (event, regions) => {
  if (!fromPet(event) || !Array.isArray(regions)) return;
  hitRegions = regions.slice(0, 8).filter(region => Array.isArray(region) && region.length === 4 &&
    region.every(Number.isFinite) && region[2] > 0 && region[3] > 0);
  probeCursor();
});

ipcMain.on('drag-state', (event, state) => {
  if (!fromPet(event)) return;
  if (state === 'held') mouseHeld = true;
  if (state === 'dragging' && mouseHeld) dragging = true;
  if (state === 'released') mouseHeld = dragging = false;
  probeCursor(false);
});

ipcMain.on('show-controls', event => {
  if (fromPet(event) && tray && !tray.isDestroyed()) tray.popUpContextMenu();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => visible(true));
  app.on('activate', () => visible(true));
  app.whenReady().then(() => {
    if (isMac) app.dock?.hide();
    const icon = nativeImage.createFromPath(path.join(__dirname, isMac ? 'trayTemplate.png' : 'tray.png'));
    if (isMac) icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setToolTip(app.getName());
    petWindow = createWindow();
    refreshTray();
    if (!isMac) tray.on('click', () => tray.popUpContextMenu());
    pollTimer = setInterval(probeCursor, 28);
    const fitDisplay = () => {
      const display = screen.getAllDisplays().find(candidate => candidate.id === activeDisplay) ??
        screen.getPrimaryDisplay();
      if (petWindow && !petWindow.isDestroyed()) ontoDisplay(display);
    };
    screen.on('display-metrics-changed', fitDisplay);
    screen.on('display-removed', fitDisplay);
  });
  app.on('will-quit', () => clearInterval(pollTimer));
}
