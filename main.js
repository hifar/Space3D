const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let pendingModelPath = null;
let appLanguage = 'en';

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

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('set-language', appLanguage);
  });

  if (pendingModelPath) {
    const filePath = pendingModelPath;
    pendingModelPath = null;
    mainWindow.webContents.once('did-finish-load', () => {
      openModelFile(filePath);
    });
  }
}

const i18n = {
  en: {
    menuFile: 'File',
    menuOpen: 'Open Model...',
    menuExit: 'Exit',
    menuView: 'View',
    menuResetCamera: 'Reset Camera',
    menuToggleWireframe: 'Toggle Wireframe',
    menuToggleBackground: 'Toggle Background',
    menuFullscreen: 'Fullscreen',
    menuDevTools: 'Developer Tools',
    menuLanguage: 'Language',
    langEnglish: 'English',
    langChinese: 'Chinese',
    menuHelp: 'Help',
    menuAbout: 'About',
    aboutTitle: 'About Space3D Viewer',
    aboutDetail: 'Version: 1.0.0\nBuilt with BabylonJS + Electron\nFormats: GLB, GLTF, OBJ, FBX, STL',
    dialogOpenTitle: 'Open 3D Model',
    dialogModelFilter: '3D Models',
    dialogAllFiles: 'All Files',
  },
  zh: {
    menuFile: '文件',
    menuOpen: '打开模型...',
    menuExit: '退出',
    menuView: '视图',
    menuResetCamera: '重置相机',
    menuToggleWireframe: '切换线框模式',
    menuToggleBackground: '切换背景',
    menuFullscreen: '全屏',
    menuDevTools: '开发者工具',
    menuLanguage: '语言',
    langEnglish: '英文',
    langChinese: '中文',
    menuHelp: '帮助',
    menuAbout: '关于',
    aboutTitle: '关于 Space3D Viewer',
    aboutDetail: '版本: 1.0.0\n基于 BabylonJS + Electron\n支持格式: GLB, GLTF, OBJ, FBX, STL',
    dialogOpenTitle: '打开3D模型文件',
    dialogModelFilter: '3D模型',
    dialogAllFiles: '所有文件',
  },
};

function t(key) {
  const dict = i18n[appLanguage] || i18n.en;
  return dict[key] || key;
}

function setLanguage(lang) {
  const next = lang === 'zh' ? 'zh' : 'en';
  if (appLanguage === next) return;
  appLanguage = next;
  buildMenu();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('set-language', appLanguage);
  }
}

function buildMenu() {
  const template = [
    {
      label: t('menuFile'),
      submenu: [
        {
          label: t('menuOpen'),
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: t('menuExit'),
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: t('menuView'),
      submenu: [
        {
          label: t('menuResetCamera'),
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.webContents.send('reset-camera'),
        },
        {
          label: t('menuToggleWireframe'),
          accelerator: 'CmdOrCtrl+W',
          click: () => mainWindow && mainWindow.webContents.send('toggle-wireframe'),
        },
        {
          label: t('menuToggleBackground'),
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow && mainWindow.webContents.send('toggle-background'),
        },
        { type: 'separator' },
        {
          label: t('menuLanguage'),
          submenu: [
            {
              label: t('langEnglish'),
              type: 'radio',
              checked: appLanguage === 'en',
              click: () => setLanguage('en'),
            },
            {
              label: t('langChinese'),
              type: 'radio',
              checked: appLanguage === 'zh',
              click: () => setLanguage('zh'),
            },
          ],
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menuFullscreen') },
        { role: 'toggleDevTools', label: t('menuDevTools') },
      ],
    },
    {
      label: t('menuHelp'),
      submenu: [
        {
          label: t('menuAbout'),
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: t('aboutTitle'),
              message: 'Space3D Viewer',
              detail: t('aboutDetail'),
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
    title: t('dialogOpenTitle'),
    filters: [
      {
        name: t('dialogModelFilter'),
        extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl'],
      },
      { name: t('dialogAllFiles'), extensions: ['*'] },
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
    title: t('dialogOpenTitle'),
    filters: [
      {
        name: t('dialogModelFilter'),
        extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl'],
      },
      { name: t('dialogAllFiles'), extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-language', async () => appLanguage);

ipcMain.handle('set-language', async (_event, lang) => {
  setLanguage(lang);
  return appLanguage;
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
