const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let pendingModelPath = null;

const supportedExtensions = new Set(['.glb', '.gltf', '.obj', '.fbx', '.stl']);
const gotSingleInstanceLock = app.requestSingleInstanceLock();

// Ensure local file:// model resources (textures/buffers) are readable when running offline.
app.commandLine.appendSwitch('allow-file-access-from-files');

function normalizeExtension(filePath) {
  return path.extname(filePath || '').toLowerCase();
}

function isSupportedModelFile(filePath) {
  return supportedExtensions.has(normalizeExtension(filePath));
}

function showAndFocusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function openModelFile(filePath) {
  if (!filePath || !isSupportedModelFile(filePath)) return false;

  if (mainWindow && mainWindow.webContents) {
    showAndFocusWindow();
    mainWindow.webContents.send('load-model', filePath);
  } else {
    pendingModelPath = filePath;
  }

  return true;
}

function getFilePathFromArgv(argv) {
  const args = argv.slice(1).filter(Boolean);
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    if (isSupportedModelFile(arg)) return arg;
  }
  return null;
}

const initialModelPath = getFilePathFromArgv(process.argv);

if (!gotSingleInstanceLock) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Space3D Viewer',
    backgroundColor: '#1a1a2e',
    show: false,
  });

  mainWindow.loadFile('app/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildMenu();

  if (pendingModelPath) {
    const filePath = pendingModelPath;
    pendingModelPath = null;
    mainWindow.webContents.once('did-finish-load', () => {
      openModelFile(filePath);
    });
  }
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开模型...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重置相机',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.webContents.send('reset-camera'),
        },
        {
          label: '切换线框模式',
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow && mainWindow.webContents.send('toggle-wireframe'),
        },
        {
          label: '切换背景',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow && mainWindow.webContents.send('toggle-background'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Space3D Viewer',
              message: 'Space3D Viewer',
              detail: '版本: 1.0.0\n基于 BabylonJS + Electron\n支持格式: GLB, GLTF, OBJ, FBX, STL',
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openFileDialog() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开3D模型文件',
    filters: [
      {
        name: '3D模型',
        extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl'],
      },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send('load-model', result.filePaths[0]);
  }
}

ipcMain.handle('open-file-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开3D模型文件',
    filters: [
      {
        name: '3D模型',
        extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl'],
      },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

app.whenReady().then(() => {
  if (initialModelPath) {
    pendingModelPath = initialModelPath;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', (_event, argv) => {
  const filePath = getFilePathFromArgv(argv);
  if (filePath) {
    openModelFile(filePath);
  } else {
    showAndFocusWindow();
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openModelFile(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
