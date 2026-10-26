const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

let mainWindow = null;
let sidecarProcess = null;

const isDev = process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL);

function startPythonSidecar() {
  const sidecarScript = path.join(__dirname, '../sidecar/main.py');
  if (!fs.existsSync(sidecarScript)) {
    console.log('[Electron] Sidecar script not found, running in client-only mode.');
    return;
  }

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  try {
    sidecarProcess = spawn(pythonCmd, [sidecarScript], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, PYTHONPATH: path.join(__dirname, '..') },
    });

    sidecarProcess.stdout.on('data', (data) => {
      console.log(`[Sidecar] ${data.toString().trim()}`);
    });

    sidecarProcess.stderr.on('data', (data) => {
      console.warn(`[Sidecar] ${data.toString().trim()}`);
    });

    sidecarProcess.on('error', (err) => {
      console.log('[Sidecar] Could not spawn Python sidecar (running in client-only mode):', err.message);
      sidecarProcess = null;
    });

    sidecarProcess.on('exit', (code, signal) => {
      console.log(`[Sidecar] Process exited with code ${code}, signal ${signal}`);
      sidecarProcess = null;
    });
  } catch (err) {
    console.log('[Sidecar] Failed to start sidecar process:', err);
  }
}

function stopPythonSidecar() {
  if (sidecarProcess) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', sidecarProcess.pid.toString(), '/f', '/t']);
      } else {
        sidecarProcess.kill('SIGTERM');
      }
    } catch {
      // ignore
    }
    sidecarProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Margin — Reader-First Study Instrument',
    backgroundColor: '#fbfaf8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry in case dev server is still starting
      setTimeout(() => mainWindow?.loadURL(devUrl), 1500);
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => process.platform);

  ipcMain.handle('dialog:open-pdf', async () => {
    if (!mainWindow) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Open PDF Textbook',
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const data = await fs.promises.readFile(filePath);
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      data: data.buffer,
    };
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (mainWindow) {
              const res = await dialog.showOpenDialog(mainWindow, {
                title: 'Open PDF Document',
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
                properties: ['openFile'],
              });
              if (!res.canceled && res.filePaths.length > 0) {
                const filePath = res.filePaths[0];
                const buf = await fs.promises.readFile(filePath);
                mainWindow.webContents.send('menu:open-pdf', {
                  fileName: path.basename(filePath),
                  data: buf.buffer,
                });
              }
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Margin Documentation',
          click: () => shell.openExternal('https://github.com/Madara-Labs/margin'),
        },
        {
          label: 'Learning Design Principles',
          click: () => shell.openExternal('https://github.com/Madara-Labs/margin/blob/main/docs/learning-design.md'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createMenu();
  startPythonSidecar();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopPythonSidecar();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
