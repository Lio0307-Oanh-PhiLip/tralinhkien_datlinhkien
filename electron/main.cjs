const { app, BrowserWindow, ipcMain, shell, Menu, dialog, nativeImage, Tray, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

let mainWindow = null;

// Ensure consistent application name for Windows & Linux Window Manager (AUMID / WM_CLASS)
app.name = 'oppo-label-studio';
app.setName('oppo-label-studio');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.oppo.labelstudio');
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'oppo-label-studio');
  app.commandLine.appendSwitch('name', 'oppo-label-studio');
}

let cachedNativeIcon = null;

function getIconIcoPath() {
  const possiblePaths = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, 'resources/icon.ico'),
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'build/icon.ico'),
    path.join(process.resourcesPath, 'resources/icon.ico'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function getIconPngBuffer() {
  try {
    const iconBase64Path = path.join(__dirname, 'icon-base64.cjs');
    if (fs.existsSync(iconBase64Path)) {
      const b64 = require('./icon-base64.cjs');
      if (b64 && typeof b64 === 'string') {
        return Buffer.from(b64, 'base64');
      }
    }
  } catch (err) {
    console.warn('Error reading base64 buffer:', err);
  }

  const possiblePaths = [
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, 'resources/icon.png'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(process.resourcesPath, 'build/icon.png'),
    path.join(process.resourcesPath, 'resources/icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p);
      } catch (e) {}
    }
  }
  return null;
}

function getAppNativeIcon() {
  if (cachedNativeIcon && !cachedNativeIcon.isEmpty()) {
    return cachedNativeIcon;
  }

  const buf = getIconPngBuffer();
  if (buf) {
    const img = nativeImage.createFromBuffer(buf);
    if (!img.isEmpty()) {
      cachedNativeIcon = img;
      return img;
    }
  }

  return null;
}

// Auto-register Linux Desktop & Taskbar icon so XFCE / Ubuntu / GNOME never fall back to gear icon
function ensureLinuxDesktopIntegration(notify = false) {
  if (process.platform !== 'linux') return;

  try {
    const homeDir = os.homedir();
    const appDir = path.join(homeDir, '.local/share/applications');
    const iconsDir512 = path.join(homeDir, '.local/share/icons/hicolor/512x512/apps');
    const iconsDir256 = path.join(homeDir, '.local/share/icons/hicolor/256x256/apps');
    const pixmapsDir = path.join(homeDir, '.local/share/pixmaps');
    const legacyIconsDir = path.join(homeDir, '.icons');
    const localIconsDir = path.join(homeDir, '.local/share/icons');

    [appDir, iconsDir512, iconsDir256, pixmapsDir, legacyIconsDir, localIconsDir].forEach((d) => {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    });

    const buf = getIconPngBuffer();
    const targetIconPath = path.join(pixmapsDir, 'oppo-label-studio.png');
    if (buf) {
      fs.writeFileSync(path.join(iconsDir512, 'oppo-label-studio.png'), buf);
      fs.writeFileSync(path.join(iconsDir256, 'oppo-label-studio.png'), buf);
      fs.writeFileSync(targetIconPath, buf);
      fs.writeFileSync(path.join(legacyIconsDir, 'oppo-label-studio.png'), buf);
      fs.writeFileSync(path.join(localIconsDir, 'oppo-label-studio.png'), buf);
    }

    const execPath = process.env.APPIMAGE || process.execPath;
    const desktopContent = `[Desktop Entry]
Name=OPPO Label Studio
Comment=Trình In Tem Linh Kiện Khổ 3x2 inch - Barcode & QR Label Studio
Exec="${execPath}" %U
Icon=${targetIconPath}
Terminal=false
Type=Application
Categories=Office;Utility;Printing;
StartupWMClass=oppo-label-studio
StartupNotify=true
X-AppImage-Version=1.0.0
`;

    const desktopFilePath = path.join(appDir, 'oppo-label-studio.desktop');
    fs.writeFileSync(desktopFilePath, desktopContent, { mode: 0o755 });

    // Also place shortcut on Desktop if Desktop exists
    const desktopDirs = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Màn hình nền'),
    ];
    desktopDirs.forEach((dd) => {
      if (fs.existsSync(dd)) {
        try {
          fs.writeFileSync(path.join(dd, 'oppo-label-studio.desktop'), desktopContent, { mode: 0o755 });
        } catch (e) {}
      }
    });

    // Refresh icon cache and desktop database in background
    exec('update-desktop-database ~/.local/share/applications && gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor 2>/dev/null', () => {});

    if (notify && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Đồng Bộ Icon Hoàn Tất',
        message: 'Đã Cài Đặt Icon & Phím Tắt Linux Thành Công!',
        detail: 'Icon tem nhãn OPPO Label Studio đã được đăng ký vào hệ thống (~/.local/share/applications và hicolor icon cache).\n\nNếu Taskbar chưa đổi ngay, bạn chỉ cần khởi động lại thanh Panel hoặc mở lại ứng dụng từ menu!',
      });
    }
  } catch (err) {
    console.warn('Linux desktop integration note:', err);
  }
}

const CLOUD_APP_URL = process.env.CLOUD_APP_URL || 'https://ais-pre-25zqqhfhavqkf7k3te25ij-670519460440.asia-southeast1.run.app';

function getAppIndexPath() {
  const possiblePaths = [
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, 'dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
    path.join(process.resourcesPath, 'app.asar/dist/index.html'),
    path.join(process.resourcesPath, 'dist/index.html'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(__dirname, '../dist/index.html');
}

let isTaskbarAlertActive = false;
let cachedNoticeState = null;
let appTray = null;

function createSystemTray() {
  if (appTray && !appTray.isDestroyed()) return;

  const defaultIcon = getAppNativeIcon();
  if (!defaultIcon || defaultIcon.isEmpty()) return;

  try {
    appTray = new Tray(defaultIcon);
    appTray.setToolTip('OPPO Label Studio - Trình In Tem & Đặt Chờ Linh Kiện');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'OPPO Label Studio (Mở giao diện)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: '⚡ Live Cloud WebApp (Tự động Cập Nhật)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            if (typeof loadCloudVersion === 'function') loadCloudVersion();
          }
        },
      },
      {
        label: '🌐 Chế độ Cục bộ (Offline)',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            if (typeof loadLocalVersion === 'function') loadLocalVersion();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Thoát hẳn ứng dụng',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    appTray.setContextMenu(contextMenu);

    appTray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    appTray.on('double-click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('Failed to create system tray icon:', err);
  }
}

function updateTrayNoticeState(hasNotice, message, count, redIconImg) {
  if (!appTray || appTray.isDestroyed()) return;

  try {
    if (hasNotice) {
      if (redIconImg && !redIconImg.isEmpty()) {
        appTray.setImage(redIconImg);
      }
      const alertMsg = `🔴 CẢNH BÁO [${count || 1}]: ${message || 'Có phiếu quá hạn / yêu cầu mới'}`;
      appTray.setToolTip(`OPPO Label Studio - ${alertMsg}`);
    } else {
      const defaultIcon = getAppNativeIcon();
      if (defaultIcon && !defaultIcon.isEmpty()) {
        appTray.setImage(defaultIcon);
      }
      appTray.setToolTip('OPPO Label Studio - Trình In Tem & Đặt Chờ Linh Kiện');
    }
  } catch (e) {
    console.warn('Error updating tray notice state:', e);
  }
}

function createWindow() {
  ensureLinuxDesktopIntegration(false);

  const iconImg = getAppNativeIcon();
  const iconIco = getIconIcoPath();
  const windowIcon = (process.platform === 'win32' && iconIco) ? iconIco : iconImg;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'OPPO Label Studio - Trình In Tem Linh Kiện 3x2 inch',
    icon: windowIcon || iconImg || undefined,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: false,
  });

  if (windowIcon || iconImg) {
    try {
      mainWindow.setIcon(windowIcon || iconImg);
    } catch (e) {}
  }

  mainWindow.once('ready-to-show', () => {
    if (windowIcon || (iconImg && !iconImg.isEmpty())) {
      try {
        mainWindow.setIcon(windowIcon || iconImg);
      } catch (e) {}
    }
  });

  // Windows & Linux Taskbar Attention state:
  // When in background (working in other apps like Zalo, Chrome, Excel) and notice exists -> change color, error progress bar & flash
  mainWindow.on('blur', () => {
    if (isTaskbarAlertActive && !mainWindow.isDestroyed()) {
      let redIconImg = null;
      if (cachedNoticeState && cachedNoticeState.iconDataUrl) {
        try {
          redIconImg = nativeImage.createFromDataURL(cachedNoticeState.iconDataUrl);
          if (redIconImg && !redIconImg.isEmpty()) {
            mainWindow.setIcon(redIconImg);
          }
        } catch (e) {}
      }
      if (cachedNoticeState && cachedNoticeState.overlayDataUrl) {
        try {
          const overlayImg = nativeImage.createFromDataURL(cachedNoticeState.overlayDataUrl);
          if (overlayImg && !overlayImg.isEmpty()) {
            mainWindow.setOverlayIcon(overlayImg, `${cachedNoticeState.count || ''} thông báo`);
          }
        } catch (e) {}
      }
      mainWindow.flashFrame(false);
      mainWindow.flashFrame(true);
      try {
        mainWindow.setProgressBar(1, { mode: 'error' });
      } catch (e) {}

      updateTrayNoticeState(true, cachedNoticeState?.message, cachedNoticeState?.count, redIconImg);
    }
  });

  // When user returns to the Desktop App (focus) -> Restore standard icon & clear alert bar immediately
  mainWindow.on('focus', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.flashFrame(false);
      try {
        mainWindow.setProgressBar(-1);
      } catch (e) {}
      try {
        const defaultIcon = getAppNativeIcon();
        if (defaultIcon && !defaultIcon.isEmpty()) {
          mainWindow.setIcon(defaultIcon);
        }
      } catch (e) {}
      try {
        mainWindow.setOverlayIcon(null, '');
      } catch (e) {}
    }
  });

  // Automatically detect alert from title updates & preview proxy Cookie check fallback
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    if (title && (title.includes('Cookie check') || title.includes('Cookie Check'))) {
      console.warn('Google AI Studio preview proxy Cookie check detected. Fallback to native local bundle immediately.');
      loadLocalVersion();
      return;
    }

    const isAlert =
      title.includes('🔴') ||
      title.includes('⚡') ||
      title.includes('⚠️') ||
      title.includes('[CẢNH BÁO]') ||
      title.includes('[CẦN XỬ LÝ]') ||
      title.toLowerCase().includes('cảnh báo') ||
      title.toLowerCase().includes('yêu cầu');

    if (isAlert) {
      const wasAlert = isTaskbarAlertActive;
      isTaskbarAlertActive = true;
      if (!wasAlert && !mainWindow.isFocused()) {
        mainWindow.flashFrame(true);
      }
    } else {
      isTaskbarAlertActive = false;
      mainWindow.flashFrame(false);
      try {
        mainWindow.setProgressBar(-1);
      } catch (e) {}
    }
  });

  // Function to load local offline/desktop bundle
  const loadLocalVersion = () => {
    if (process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
      return;
    }

    const localIndexPath = getAppIndexPath();
    mainWindow.loadFile(localIndexPath).catch((err) => {
      console.warn('Failed to load local index.html via loadFile:', err);
      try {
        mainWindow.loadURL(`file://${localIndexPath}`);
      } catch (e) {
        console.error('Failed to load index file:', e);
      }
    });
  };

  // Function to load live cloud app (WebWrapper mode - auto updates on startup)
  const loadCloudVersion = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Refreshing live app interface cleanly...');
      mainWindow.reload();
    }
  };

  // Fallback to local offline version if network connection fails
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.startsWith(CLOUD_APP_URL)) {
      console.warn(`Failed to connect to Cloud Server (${errorCode}: ${errorDescription}). Switching to local offline bundle.`);
      loadLocalVersion();
    }
  });

  // Create custom application menu
  const menuTemplate = [
    {
      label: 'Tệp',
      submenu: [
        {
          label: 'In tem (Ctrl + P)',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('trigger-smart-print');
            }
          },
        },
        {
          label: 'Tải lại giao diện (F5 / Ctrl + R)',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
        },
        { type: 'separator' },
        {
          label: '⚡ Chế độ Live Cloud WebApp (Tự động Cập Nhật Tính Năng Mới)',
          click: () => {
            loadCloudVersion();
          },
        },
        {
          label: '🌐 Chế độ Cục bộ & Ngoại tuyến (Offline Local)',
          click: () => {
            loadLocalVersion();
          },
        },
        { type: 'separator' },
        {
          label: 'Thoát',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Cổng GCSM',
      submenu: [
        {
          label: 'Mở trang Tra Cứu Tồn Kho GCSM (Trình duyệt)',
          click: () => {
            shell.openExternal('https://gcsm-sg.oppoit.com/part/stocks/stock-query');
          },
        },
      ],
    },
    {
      label: 'Xem',
      submenu: [
        { role: 'resetZoom', label: 'Cỡ gốc (100%)' },
        { role: 'zoomIn', label: 'Phóng to' },
        { role: 'zoomOut', label: 'Thu nhỏ' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toàn màn hình' },
        {
          label: 'Công cụ phát triển (F12)',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Cập nhật & Trợ giúp',
      submenu: [
        {
          label: '⚡ Kiểm tra & Cập nhật phiên bản mới (Cloud OTA)',
          accelerator: 'CmdOrCtrl+U',
          click: () => {
            loadCloudVersion();
          },
        },
        {
          label: '🚀 Thông tin phiên bản & Kết nối Server',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Cập Nhật Phần Mềm & Trạng Thái Máy Chủ',
              message: 'OPPO Label Studio v2.5.2 (WebWrapper Auto-Update & Offline Dual-Engine)',
              detail: `Hệ thống hỗ trợ tự động cập nhật tính năng mới nhất trực tiếp từ Live Cloud Server:\n• ${CLOUD_APP_URL}\n\nKhi mở phần mềm, ứng dụng sẽ tự động tải các tính năng mới nhất đã cập nhật từ AI Studio mà không cần tải hay cài đặt lại file .exe / .AppImage.\n• Nếu mất kết nối mạng, phần mềm sẽ tự chuyển sang Chế độ Ngoại tuyến (Offline Local) để làm việc liên tục.`,
            });
          },
        },
        {
          label: '🛠️ Đồng bộ Icon Taskbar Linux (Sửa icon bánh răng)',
          click: () => {
            ensureLinuxDesktopIntegration(true);
          },
        },
        {
          label: 'Về ứng dụng OPPO Label Studio',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'OPPO Label Studio',
              icon: iconImg,
              message: 'OPPO Label Studio - Trình In Tem Linh Kiện Khổ 3x2 inch & Đặt Chờ Linh Kiện',
              detail: 'Phiên bản Desktop Windows EXE / Linux AppImage (WebWrapper Auto-Update).\nTự động kết nối và cập nhật tính năng trực tiếp từ Server.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load local offline/desktop bundle by default for 1s instant startup without preview proxy blockers
  loadLocalVersion();

  // Handle navigation & Cookie check proxy redirect protection
  mainWindow.webContents.on('did-navigate', (event, url) => {
    if (url && (url.includes('cookie-check') || url.includes('accounts.google.com'))) {
      console.warn('Redirected to Google auth/cookie-check proxy page. Returning to local native bundle:', url);
      loadLocalVersion();
    }
  });

  // Handle opening external URLs in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // If navigating within the Cloud App URL domain, allow inside app
      if (url.startsWith(CLOUD_APP_URL)) {
        return { action: 'allow' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (process.platform === 'linux') {
    app.setDesktopName('oppo-label-studio.desktop');
  }
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.oppo.labelstudio');
  }
  createWindow();
  createSystemTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for printing capabilities
ipcMain.handle('print-to-pdf', async (event, options) => {
  if (!mainWindow) return null;
  try {
    const data = await mainWindow.webContents.printToPDF({
      pageSize: {
        width: 3 * 25400, // 3 inches in microns
        height: 2 * 25400, // 2 inches in microns
      },
      marginsType: 1, // no margins
      printBackground: true,
      ...options,
    });
    return data;
  } catch (error) {
    console.error('Failed to print to PDF:', error);
    throw error;
  }
});

// Helper to fetch installed Windows printers with PowerShell fallback if Chromium spooler is empty
async function getAllSystemPrinters() {
  let printers = [];
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      printers = await mainWindow.webContents.getPrintersAsync();
    } catch (e) {}
  }
  if (Array.isArray(printers) && printers.length > 0) {
    return printers;
  }

  // Windows PowerShell fallback
  if (process.platform === 'win32') {
    try {
      const output = await new Promise((resolve) => {
        exec('powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json"', { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) resolve(null);
          else resolve(stdout.trim());
        });
      });
      if (output) {
        const parsed = JSON.parse(output);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        printers = arr.filter(p => p && p.Name).map(p => ({
          name: p.Name,
          displayName: p.Name,
          isDefault: Boolean(p.Default),
          status: 0,
        }));
      }
    } catch (e) {}
  }
    // Linux CUPS fallback (lpstat)
  if (process.platform === 'linux') {
    try {
      const output = await new Promise((resolve) => {
        exec('lpstat -p', { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) resolve(null);
          else resolve(stdout.trim());
        });
      });
      const defaultOutput = await new Promise((resolve) => {
        exec('lpstat -d', { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) resolve(null);
          else resolve(stdout.trim());
        });
      });
      if (output) {
        const lines = output.split('\n');
        const defaultMatch = defaultOutput ? defaultOutput.match(/system default destination:\s*(.+)/i) : null;
        const defaultName = defaultMatch ? defaultMatch[1].trim() : null;
        
        const extractedPrinters = [];
        for (const line of lines) {
          const match = line.match(/^printer\s+([^\s]+)/i);
          if (match && match[1]) {
            const pName = match[1];
            extractedPrinters.push({
              name: pName,
              displayName: pName.replace(/_/g, ' '),
              isDefault: pName === defaultName,
              status: 0
            });
          }
        }
        if (extractedPrinters.length > 0) {
          printers = extractedPrinters;
        }
      }
    } catch (e) {}
  }

  return printers || [];
}

// Helper to resolve any printer request string to actual Windows printer driver name
function resolveSystemPrinterName(requestedDevice, printersList, isSilent) {
  if (!Array.isArray(printersList) || printersList.length === 0) {
    return requestedDevice || '';
  }

  if (requestedDevice) {
    const clean = requestedDevice.trim();
    const lowerReq = clean.toLowerCase();

    // 1. Exact match
    const exact = printersList.find((p) => p && p.name.toLowerCase() === lowerReq);
    if (exact) return exact.name;

    // 2. Substring match
    const matched = printersList.find(
      (p) => p && (lowerReq.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lowerReq))
    );
    if (matched) return matched.name;

    // 3. Model number extraction match (e.g. "3110", "3250", "2900", "6030", "6018", "350", "420", "800")
    const numbers = lowerReq.match(/\d{3,4}/g) || [];
    for (const num of numbers) {
      const numMatch = printersList.find((p) => p && p.name.toLowerCase().includes(num));
      if (numMatch) return numMatch.name;
    }

    // 4. Token / Brand match (Canon, Xprinter, Epson, Brother, etc.)
    const tokens = lowerReq.split(/[\s\/\-_,]+/).filter((t) => t.length >= 3 && !['series', 'printer'].includes(t));
    let bestScore = 0;
    let bestPrinter = null;
    for (const p of printersList) {
      if (!p || !p.name) continue;
      const pLower = p.name.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (pLower.includes(token)) score += token.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPrinter = p;
      }
    }
    if (bestPrinter && bestScore > 0) {
      return bestPrinter.name;
    }

    // 5. If isSilent: NEVER pass an unknown device name to Chromium as it opens Windows Print Dialog!
    if (isSilent) {
      const def = printersList.find((p) => p && p.isDefault) || printersList[0];
      if (def) return def.name;
    }

    return clean;
  } else if (isSilent) {
    const def = printersList.find((p) => p && p.isDefault) || printersList[0];
    if (def) return def.name;
  }

  return '';
}

ipcMain.handle('get-printers', async () => {
  return await getAllSystemPrinters();
});

ipcMain.handle('print-job', async (event, options = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Không tìm thấy cửa sổ chính' };
  try {
    const isSilent = Boolean(options.silent);
    const requestedDevice = (options.deviceName || '').trim();
    let resolvedDeviceName = '';

    try {
      const printersList = await getAllSystemPrinters();
      resolvedDeviceName = resolveSystemPrinterName(requestedDevice, printersList, isSilent);
    } catch (e) {}

    return new Promise((resolve) => {
      const printOptions = {
        silent: isSilent,
        printBackground: options.printBackground ?? true,
        copies: Math.max(1, Number(options.copies) || 1),
        margins: {
          marginType: 'none',
        },
      };

      if (resolvedDeviceName) {
        printOptions.deviceName = resolvedDeviceName;
      }

      if (options.pageSize) {
        printOptions.pageSize = options.pageSize;
      }

      mainWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          console.warn('Print job warning/failure:', failureReason);
          resolve({ success: false, error: failureReason || 'In thất bại' });
        } else {
          resolve({ success: true, deviceUsed: resolvedDeviceName });
        }
      });
    });
  } catch (error) {
    console.error('Failed to print:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-html', async (event, { html, options = {} }) => {
  let printWindow = null;
  let tempHtmlPath = null;
  try {
    const isSilent = Boolean(options.silent);
    const requestedDevice = (options.deviceName || '').trim();

    // 1. Create invisible window with background throttling disabled
    printWindow = new BrowserWindow({
      show: false,
      parent: isSilent && mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false, // Critical: prevent Chromium from pausing render pipeline in background
      },
    });

    // 2. Resolve exact printer name from system spooler if available
    let resolvedDeviceName = '';
    try {
      const printersList = await getAllSystemPrinters();
      resolvedDeviceName = resolveSystemPrinterName(requestedDevice, printersList, isSilent);
    } catch (err) {
      console.warn('Could not query system printers:', err);
    }

    // 3. Write HTML to temporary file to avoid data URI limits with multiple labels/QR codes
    tempHtmlPath = path.join(os.tmpdir(), `oppo_print_${Date.now()}_${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(tempHtmlPath, html || '', 'utf-8');

    // 4. Load temp file and wait for DOM and styling to finish loading
    await new Promise((resolveLoad, rejectLoad) => {
      const loadTimeout = setTimeout(() => {
        resolveLoad();
      }, 3500);

      printWindow.webContents.once('did-finish-load', () => {
        clearTimeout(loadTimeout);
        // Wait 150ms for fonts, barcode SVGs and CSS @page layout to stabilize
        setTimeout(resolveLoad, 150);
      });

      printWindow.webContents.once('did-fail-load', (e, code, desc) => {
        clearTimeout(loadTimeout);
        rejectLoad(new Error(`Tải trang in thất bại: ${desc} (${code})`));
      });

      printWindow.loadFile(tempHtmlPath).catch(rejectLoad);
    });

    // 5. Construct print options
    const printOptions = {
      silent: isSilent,
      printBackground: options.printBackground ?? true,
      copies: Math.max(1, Number(options.copies) || 1),
      margins: {
        marginType: 'none',
      },
    };

    if (resolvedDeviceName) {
      printOptions.deviceName = resolvedDeviceName;
    }

    if (options.pageSize) {
      printOptions.pageSize = options.pageSize;
    }

    if (!isSilent && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }

    // 6. Execute print and keep window alive until Windows Spooler buffers document
    return await new Promise((resolve) => {
      printWindow.webContents.print(printOptions, (success, failureReason) => {
        // Delayed destruction to allow Windows Spooler service to complete buffering
        setTimeout(() => {
          try {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close();
              printWindow = null;
            }
            if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
              fs.unlinkSync(tempHtmlPath);
            }
          } catch (e) {}
        }, 3000);

        if (!success) {
          console.warn('print-html failed:', failureReason, 'printer:', resolvedDeviceName);
          resolve({
            success: false,
            error: failureReason || 'Lỗi gửi lệnh in tới máy in',
            deviceAttempted: resolvedDeviceName,
          });
        } else {
          resolve({
            success: true,
            deviceUsed: resolvedDeviceName,
          });
        }
      });
    });
  } catch (err) {
    console.error('print-html exception:', err);
    setTimeout(() => {
      try {
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.close();
        }
        if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
          fs.unlinkSync(tempHtmlPath);
        }
      } catch (e) {}
    }, 1000);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-in-browser', async (event, url) => {
  if (url) {
    try {
      await shell.openExternal(url);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
});

ipcMain.handle('reload-window', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload();
    return true;
  }
  return false;
});

// Native OS Desktop Notification (triggers Windows 10/11 Action Center & Taskbar highlight)
ipcMain.handle('show-desktop-notification', async (event, { title, body, tag }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  try {
    if (Notification && Notification.isSupported && Notification.isSupported()) {
      const notif = new Notification({
        title: title || 'HCM4 Thông Báo',
        body: body || '',
        icon: getAppNativeIcon() || undefined,
        urgency: 'critical',
        silent: false,
      });

      notif.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notif.show();

      // If user is currently on Google, Zalo, DingTalk, immediately flash and turn taskbar red!
      if (!mainWindow.isFocused()) {
        isTaskbarAlertActive = true;
        mainWindow.flashFrame(false);
        mainWindow.flashFrame(true);
        try {
          mainWindow.setProgressBar(1, { mode: 'error' });
        } catch (e) {}
      }

      return true;
    }
  } catch (err) {
    console.warn('show-desktop-notification error:', err);
  }
  return false;
});

// Update Windows & Linux Taskbar alert highlight, system tray icon, and background notification
ipcMain.handle('update-taskbar-notice', async (event, { hasNotice, message, count, iconDataUrl, overlayDataUrl }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  try {
    const isAlertActive = Boolean(hasNotice && (count === undefined || count > 0 || hasNotice));
    const wasAlertActive = isTaskbarAlertActive;
    cachedNoticeState = {
      hasNotice: isAlertActive,
      message: message || '',
      count: count || 0,
      iconDataUrl: iconDataUrl || '',
      overlayDataUrl: overlayDataUrl || '',
    };
    isTaskbarAlertActive = isAlertActive;

    let redIconImg = null;
    if (isAlertActive && iconDataUrl && typeof iconDataUrl === 'string' && iconDataUrl.startsWith('data:image/')) {
      try {
        redIconImg = nativeImage.createFromDataURL(iconDataUrl);
      } catch (e) {}
    }

    // Always keep System Tray updated with latest notice status
    updateTrayNoticeState(isAlertActive, message, count, redIconImg);

    if (isAlertActive) {
      // 1. DYNAMICALLY CHANGE TASKBAR ICON COLOR TO RED WHEN IN BACKGROUND
      if (!mainWindow.isFocused() && redIconImg && !redIconImg.isEmpty()) {
        try {
          mainWindow.setIcon(redIconImg);
        } catch (e) {
          console.warn('Failed to set red alert icon on taskbar:', e);
        }
      }

      // 2. PAINT TASKBAR BUTTON WITH RED COLOR (Windows Taskbar Progress Error Mode)
      if (!mainWindow.isFocused()) {
        try {
          mainWindow.setProgressBar(1, { mode: 'error' });
        } catch (e) {}
      }

      // 3. FLASH THE TASKBAR BUTTON ONCE WHEN ALERT TRANSITIONS TO ACTIVE
      if (!mainWindow.isFocused() && !wasAlertActive) {
        mainWindow.flashFrame(true);
      }

      // 4. Set native taskbar overlay badge
      if (overlayDataUrl && typeof overlayDataUrl === 'string' && overlayDataUrl.startsWith('data:image/')) {
        try {
          const overlayImg = nativeImage.createFromDataURL(overlayDataUrl);
          if (!overlayImg.isEmpty()) {
            mainWindow.setOverlayIcon(overlayImg, `${count || ''} thông báo`);
          }
        } catch (e) {
          console.warn('Failed to set overlay icon:', e);
        }
      }

      // 5. System dock badge
      if (app.setBadgeCount) {
        app.setBadgeCount(typeof count === 'number' ? count : 1);
      }
    } else {
      // Clear alert states and restore standard green appearance
      isTaskbarAlertActive = false;

      // Restore standard green icon
      try {
        const defaultIcon = getAppNativeIcon();
        if (defaultIcon && !defaultIcon.isEmpty()) {
          mainWindow.setIcon(defaultIcon);
        }
      } catch (e) {}

      // Clear red progress bar
      try {
        mainWindow.setProgressBar(-1);
      } catch (e) {}

      // Stop flashing
      try {
        mainWindow.flashFrame(false);
      } catch (e) {}

      // Clear overlay
      try {
        mainWindow.setOverlayIcon(null, '');
      } catch (e) {}

      if (app.setBadgeCount) {
        app.setBadgeCount(0);
      }
    }

    return true;
  } catch (err) {
    console.warn('Error in update-taskbar-notice IPC:', err);
    return false;
  }
});


