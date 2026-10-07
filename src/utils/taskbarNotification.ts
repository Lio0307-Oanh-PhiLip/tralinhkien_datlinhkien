/**
 * Utility to manage Taskbar Icon (Favicon), Red Dot Badges, App Badging API,
 * Dynamic Web App Manifest, and Desktop Notifications when system warnings or reminders occur.
 * 
 * - Web Version: Modern Red Dot (chấm đỏ) on the Emerald Green favicon when notices/warnings are active.
 * - Desktop App: Color-changing taskbar icon (Crimson Red / Amber) when user is working in another app,
 *   and instantly restores to normal green icon upon returning (focusing) to the desktop app.
 */

let titleFlashInterval: ReturnType<typeof setInterval> | null = null;
let faviconFlashInterval: ReturnType<typeof setInterval> | null = null;
const ORIGINAL_TITLE = 'HCM4 tra linh kiện in tem & đặt chờ linh kiện';
let originalManifestHref: string | null = null;
let dynamicManifestObjectUrl: string | null = null;

let currentActiveNoticeState = {
  hasNotice: false,
  message: '',
  badgeCount: 0,
};

/**
 * Generate high-definition Web Favicon with Modern Red Dot (Dạng Chấm Đỏ)
 * @param size - Canvas width & height (32, 64, 192, 512)
 * @param count - Badge count or true for alert, 0/false for normal
 * @param isAlternateFlash - Toggle for subtle glowing pulse
 */
export function createWebFaviconDataUrl(size: number, count: number | boolean, isAlternateFlash: boolean = false): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return './favicon.svg';

    ctx.clearRect(0, 0, size, size);

    const scale = size / 64;
    const hasAlert = Boolean(count);

    // 1. Draw Base Brand Logo Tile (Always Premium Emerald Green for Web Favicon)
    const bgGradient = ctx.createLinearGradient(0, 0, size, size);
    bgGradient.addColorStop(0, '#059669'); // Emerald 600
    bgGradient.addColorStop(1, '#047857'); // Emerald 700
    ctx.fillStyle = bgGradient;

    // Rounded rectangle tile
    const r = 14 * scale;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Clean subtle white border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.8 * scale;
    ctx.stroke();

    // 2. Draw "HCM4" Brand Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${20 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HCM4', 32 * scale, 32 * scale);

    // Bottom subtitle "PHÚ LÂM"
    ctx.font = `bold ${8 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText('PHÚ LÂM', 32 * scale, 48 * scale);

    // 3. WEB NOTIFICATION: MODERN RED DOT (CHẤM ĐỎ THÔNG BÁO HIỆN ĐẠI)
    if (hasAlert) {
      const dotRadius = typeof count === 'number' && count > 9 ? 12 * scale : 9 * scale;
      const dotX = size - 14 * scale;
      const dotY = 14 * scale;

      // Glowing halo effect
      ctx.shadowColor = isAlternateFlash ? 'rgba(249, 115, 22, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 6 * scale;

      // Draw red dot circle
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = isAlternateFlash ? '#f97316' : '#ef4444'; // Bright Red & Vivid Orange
      ctx.fill();

      // Sharp white contrast ring
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.2 * scale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // If count is a number and size is large enough (>= 48px), draw the count number inside the red dot
      const num = typeof count === 'number' && count > 0 ? count : null;
      if (num !== null && size >= 48) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${9 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = num > 99 ? '99+' : String(num);
        ctx.fillText(label, dotX, dotY + 0.5 * scale);
      }
    }

    return canvas.toDataURL('image/png');
  } catch (e) {
    return './favicon.svg';
  }
}

/**
 * Generate full Color-Changed Alert Icon for Desktop Taskbar (Dạng Đổi Màu Sang Đỏ Khi Ở App Khác)
 * @param size - Canvas width & height (e.g. 192, 256, 512)
 * @param count - Badge count or true
 * @param isAlternateFlash - Toggle between Crimson Red & Vivid Amber
 */
export function createDesktopAlertIconDataUrl(size: number, count: number | boolean, isAlternateFlash: boolean = false): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return './favicon.svg';

    ctx.clearRect(0, 0, size, size);

    const scale = size / 64;

    // 1. Draw Base App Logo Tile in Warning Crimson Red / Bright Amber
    const baseColor = isAlternateFlash ? '#ea580c' : '#dc2626';
    ctx.fillStyle = baseColor;

    // Rounded rect
    const r = 14 * scale;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // High contrast warning border
    ctx.strokeStyle = isAlternateFlash ? '#fef08a' : '#ffffff';
    ctx.lineWidth = 3.5 * scale;
    ctx.stroke();

    // Alert Exclamation symbol
    const alertY = 24 * scale;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${18 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠️', 32 * scale, alertY);

    // Warning text
    ctx.font = `bold ${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CẢNH BÁO', 32 * scale, 41 * scale);

    ctx.font = `bold ${7.5 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = isAlternateFlash ? '#fef08a' : '#fee2e2';
    ctx.fillText('HCM4 PHÚ LÂM', 32 * scale, 52 * scale);

    return canvas.toDataURL('image/png');
  } catch (e) {
    return './favicon.svg';
  }
}

/**
 * Generate a 32x32 native Windows Taskbar overlay badge Data URL
 */
export function createOverlayBadgeDataUrl(count: number | boolean, isAlternateFlash: boolean = false): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 64, 64);

    // Glowing circle badge (alternates Crimson Red & Vivid Orange)
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, 2 * Math.PI);
    ctx.fillStyle = isAlternateFlash ? '#ea580c' : '#dc2626';
    ctx.fill();

    // High contrast white ring
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    const num = typeof count === 'number' && count > 0 ? count : null;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = num !== null ? (num > 99 ? '99+' : String(num)) : '!';
    ctx.fillText(label, 32, 34);

    return canvas.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}

/**
 * Updates browser Favicon links dynamically with modern Red Dot (chấm đỏ)
 */
export function setFaviconBadge(count: number | boolean, isAlternateFlash: boolean = false) {
  try {
    const hasAlert = Boolean(count);
    const dataUrl32 = createWebFaviconDataUrl(32, count, isAlternateFlash);
    const dataUrl64 = createWebFaviconDataUrl(64, count, isAlternateFlash);
    const dataUrl192 = createWebFaviconDataUrl(192, count, isAlternateFlash);
    const dataUrl512 = createWebFaviconDataUrl(512, count, isAlternateFlash);

    // Remove existing favicon and shortcut links to force browser refresh
    const existingLinks = document.querySelectorAll<HTMLLinkElement>(
      "link[rel*='icon'], link[rel='apple-touch-icon']"
    );
    existingLinks.forEach((link) => link.remove());

    // Re-create multi-resolution icons so browser tab & mobile home screen update
    const linkConfigs = [
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: dataUrl32 },
      { rel: 'icon', type: 'image/png', sizes: '64x64', href: dataUrl64 },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: dataUrl192 },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: dataUrl512 },
      { rel: 'shortcut icon', type: 'image/png', href: dataUrl192 },
      { rel: 'apple-touch-icon', type: 'image/png', href: dataUrl192 },
    ];

    linkConfigs.forEach((cfg) => {
      const el = document.createElement('link');
      el.rel = cfg.rel;
      el.type = cfg.type;
      if (cfg.sizes) el.setAttribute('sizes', cfg.sizes);
      el.href = cfg.href;
      document.head.appendChild(el);
    });

    // Update meta theme-color
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = hasAlert ? (isAlternateFlash ? '#ea580c' : '#dc2626') : '#059669';

    // Dynamically update Web App Manifest
    let manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!originalManifestHref && manifestLink) {
      originalManifestHref = manifestLink.getAttribute('href') || '/manifest.webmanifest';
    }

    if (hasAlert) {
      if (dynamicManifestObjectUrl) {
        URL.revokeObjectURL(dynamicManifestObjectUrl);
        dynamicManifestObjectUrl = null;
      }
      const countNumber = typeof count === 'number' && count > 0 ? count : '';
      const manifestObj = {
        name: `(${countNumber}) Cảnh Báo Tiến Độ - HCM4 Phú Lâm`,
        short_name: `(${countNumber}) Cảnh Báo`,
        start_url: '/',
        display: 'standalone',
        theme_color: isAlternateFlash ? '#ea580c' : '#dc2626',
        background_color: '#059669',
        icons: [
          { src: dataUrl192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: dataUrl512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: dataUrl512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      };
      const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
      dynamicManifestObjectUrl = URL.createObjectURL(blob);

      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = dynamicManifestObjectUrl;
    } else if (originalManifestHref && manifestLink) {
      if (dynamicManifestObjectUrl) {
        URL.revokeObjectURL(dynamicManifestObjectUrl);
        dynamicManifestObjectUrl = null;
      }
      manifestLink.href = originalManifestHref;
    }

    // Windows PWA & Chromium App Badging API (only for web browsers, skip in Electron to allow native setOverlayIcon & setIcon)
    const isElectronApp = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isElectron);
    if (!isElectronApp && 'setAppBadge' in navigator) {
      if (typeof count === 'number' && count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else if (count) {
        (navigator as any).setAppBadge().catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Favicon badge update error:', e);
  }
}

/**
 * Play a gentle Web Audio notification chime
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Audio might be blocked if user has not interacted yet, which is safe to ignore
  }
}

let prevNoticeState: boolean | null = null;
let prevNoticeCount: number | null = null;
let prevNoticeMsg: string | null = null;
let lastDesktopNotifTime = 0;

/**
 * Starts or stops window title flashing, red dot favicon on web, and desktop icon color changing when away
 */
export function updateTaskbarTitleNotice(
  hasNotice: boolean,
  message: string = 'Đăng ký mới / Thay đổi hệ thống',
  badgeCount: number = 1,
  forceFlash: boolean = false
) {
  currentActiveNoticeState = {
    hasNotice,
    message,
    badgeCount,
  };

  // Clear any existing intervals
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  if (faviconFlashInterval) {
    clearInterval(faviconFlashInterval);
    faviconFlashInterval = null;
  }

  const isUserFocused = !document.hidden && document.hasFocus();

  // 1. Electron Desktop Integration: Trigger native Windows Taskbar flashing & color change
  const hasChanged =
    forceFlash ||
    prevNoticeState !== hasNotice ||
    prevNoticeCount !== badgeCount ||
    prevNoticeMsg !== message;

  if (hasChanged) {
    prevNoticeState = hasNotice;
    prevNoticeCount = badgeCount;
    prevNoticeMsg = message;

    if (typeof window !== 'undefined' && window.electronAPI?.updateTaskbarNotice) {
      const iconDataUrl = hasNotice ? createDesktopAlertIconDataUrl(256, badgeCount || 1, false) : '';
      window.electronAPI.updateTaskbarNotice({
        hasNotice: Boolean(hasNotice && (badgeCount === undefined || badgeCount > 0 || hasNotice)),
        count: typeof badgeCount === 'number' ? badgeCount : 1,
        message,
        iconDataUrl,
        overlayDataUrl: '',
      }).catch((e) => console.warn('electronAPI.updateTaskbarNotice error:', e));
    }
  }

  if (!hasNotice) {
    document.title = ORIGINAL_TITLE;
    setFaviconBadge(false);
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
    return;
  }

  // Update App Badge on web browsers
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
  if (!isElectron && 'setAppBadge' in navigator && badgeCount > 0) {
    (navigator as any).setAppBadge(badgeCount).catch(() => {});
  }

  // Set initial Web Favicon with Red Dot (Chấm đỏ) & initial title
  const countLabel = badgeCount > 0 ? `(${badgeCount}) ` : '';
  document.title = `🔴 ${countLabel}${message} - HCM4`;
  setFaviconBadge(badgeCount || true, false);

  let flashFlag = false;

  // Flash title and red dot favicon alternately every 1200ms
  titleFlashInterval = setInterval(() => {
    flashFlag = !flashFlag;

    // Dynamic flashing Title on Windows Taskbar / Browser Tab
    document.title = flashFlag
      ? `🔴 ${countLabel}${message} - HCM4`
      : `⚡ [CẦN XỬ LÝ] (${badgeCount}) ${message}`;

    // Dynamic red dot favicon pulse
    setFaviconBadge(badgeCount || true, flashFlag);
  }, 1200);
}

/**
 * Legacy test helper stub - Simulation deactivated
 */
export function triggerSimulatedTaskbarAlert(
  _seconds: number = 10,
  _onShowToast?: (msg: string, type: 'info' | 'success') => void
) {
  console.log('Simulated alert test function has been deactivated.');
}

/**
 * Sends a native desktop notification (via Electron Native OS Toast or Browser Notification)
 */
export function sendDesktopNotification(title: string, body: string, tag: string = 'hcm4-alert') {
  try {
    // 1. Electron Desktop App: Send OS native notification
    if (typeof window !== 'undefined' && window.electronAPI?.showDesktopNotification) {
      window.electronAPI.showDesktopNotification({ title, body, tag }).catch((e) => {
        console.warn('electronAPI.showDesktopNotification error:', e);
      });
    }

    // 2. Browser fallback for Web / PWA
    if ('Notification' in window) {
      const iconUrl = './icon.png';
      if (Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: iconUrl,
          badge: iconUrl,
          tag,
          silent: false,
        });
        notif.onclick = () => {
          window.focus();
        };
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            const notif = new Notification(title, {
              body,
              icon: iconUrl,
              badge: iconUrl,
              tag,
              silent: false,
            });
            notif.onclick = () => {
              window.focus();
            };
          }
        });
      }
    }
  } catch (e) {
    console.warn('Desktop notification error:', e);
  }
}

// Global window event listeners:
// When the user returns to the app (focus), restore Desktop icon to normal green immediately!
if (typeof window !== 'undefined') {
  const handleWindowFocus = () => {
    // Keep main process active notice state alive if unhandled notices remain, while allowing main process to clear focus flash
    if (window.electronAPI?.updateTaskbarNotice && currentActiveNoticeState.hasNotice && currentActiveNoticeState.badgeCount > 0) {
      const iconDataUrl = createDesktopAlertIconDataUrl(256, currentActiveNoticeState.badgeCount, false);
      const overlayDataUrl = createOverlayBadgeDataUrl(currentActiveNoticeState.badgeCount, false);
      window.electronAPI.updateTaskbarNotice({
        hasNotice: true,
        count: currentActiveNoticeState.badgeCount,
        message: currentActiveNoticeState.message,
        iconDataUrl,
        overlayDataUrl,
      }).catch(() => {});
    }

    // Stop title flash and restore clean title when user is actively inside the app
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
    }
    document.title = ORIGINAL_TITLE;
  };

  const handleWindowBlur = () => {
    // When user leaves the app, if there are active unread notices/warnings, reactivate desktop alert & title flash
    if (currentActiveNoticeState.hasNotice && currentActiveNoticeState.badgeCount > 0) {
      updateTaskbarTitleNotice(
        true,
        currentActiveNoticeState.message,
        currentActiveNoticeState.badgeCount,
        true
      );
    }
  };

  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleWindowBlur();
    } else {
      handleWindowFocus();
    }
  });
}

