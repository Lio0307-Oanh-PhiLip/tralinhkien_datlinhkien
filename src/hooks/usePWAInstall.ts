import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect Standalone / Already Installed Mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://');
      const installed = isStandaloneMedia || isNavigatorStandalone || isAndroidApp;
      setIsInstalled(installed);
    };

    checkStandalone();

    // 2. Detect User Agent
    const ua = (typeof window !== 'undefined' ? window.navigator.userAgent : '').toLowerCase();
    const android = /android/i.test(ua);
    const ios = /iphone|ipad|ipod/i.test(ua);
    const mobile = android || ios || /mobile/i.test(ua) || (window.innerWidth < 768);

    setIsAndroid(android);
    setIsIOS(ios);
    setIsMobile(mobile);

    // 3. Listen to beforeinstallprompt event (Supported by Chromium/Android/Chrome/Edge/Samsung Internet)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unsupported'> => {
    if (!deferredPrompt) {
      return 'unsupported';
    }
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('Lỗi khi kích hoạt cài đặt PWA:', err);
      return 'unsupported';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isAndroid,
    isIOS,
    isMobile,
    triggerInstall,
    deferredPrompt,
  };
}
