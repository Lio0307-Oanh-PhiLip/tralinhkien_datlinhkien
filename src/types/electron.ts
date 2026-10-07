export interface ElectronPrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status?: number;
  isDefault: boolean;
  options?: Record<string, any>;
}

export interface ElectronPrintOptions {
  silent?: boolean;
  printBackground?: boolean;
  deviceName?: string;
  color?: boolean;
  margins?: {
    marginType?: 'default' | 'none' | 'printableArea' | 'custom';
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  landscape?: boolean;
  scaleFactor?: number;
  copies?: number;
  pageSize?: string | { width: number; height: number };
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  printToPdf: (options?: any) => Promise<Uint8Array | null>;
  getPrinters?: () => Promise<ElectronPrinterInfo[]>;
  printJob?: (options?: ElectronPrintOptions) => Promise<{ success: boolean; error?: string; deviceUsed?: string }>;
  printHtml?: (params: { html: string; options?: ElectronPrintOptions }) => Promise<{ success: boolean; error?: string; deviceUsed?: string; deviceAttempted?: string }>;
  openInBrowser?: (url: string) => Promise<boolean>;
  updateTaskbarNotice?: (params: {
    hasNotice: boolean;
    message?: string;
    count?: number;
    iconDataUrl?: string;
    overlayDataUrl?: string;
    isAlternateFlash?: boolean;
  }) => Promise<boolean>;
  showDesktopNotification?: (params: { title: string; body: string; tag?: string }) => Promise<boolean>;
  reloadWindow?: () => Promise<boolean>;
  onTriggerPrint?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
