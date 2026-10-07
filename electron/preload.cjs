const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  printToPdf: (options) => ipcRenderer.invoke('print-to-pdf', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printJob: (options) => ipcRenderer.invoke('print-job', options),
  printHtml: (params) => ipcRenderer.invoke('print-html', params),
  openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
  updateTaskbarNotice: (params) => ipcRenderer.invoke('update-taskbar-notice', params),
  showDesktopNotification: (params) => ipcRenderer.invoke('show-desktop-notification', params),
  reloadWindow: () => ipcRenderer.invoke('reload-window'),
  onTriggerPrint: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-smart-print', handler);
    return () => ipcRenderer.removeListener('trigger-smart-print', handler);
  },
});
