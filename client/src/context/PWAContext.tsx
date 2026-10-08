import React, { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  deferredPrompt: any | null;
  showInstallModal: boolean;
  setShowInstallModal: (show: boolean) => void;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  canInstall: false,
  isInstalled: false,
  isIOS: false,
  deferredPrompt: null,
  showInstallModal: false,
  setShowInstallModal: () => {},
  promptInstall: async () => {},
});

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone display mode (already installed PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Check for iOS devices
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(iosDevice);

    // 3. Register Service Worker
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 4. Check for early captured prompt
    if ((window as any).__pwa_deferred_prompt) {
      setDeferredPrompt((window as any).__pwa_deferred_prompt);
    }

    // 5. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwa_deferred_prompt = e;
      setDeferredPrompt(e);
    };

    const handlePromptReady = () => {
      if ((window as any).__pwa_deferred_prompt) {
        setDeferredPrompt((window as any).__pwa_deferred_prompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__pwa_deferred_prompt = null;
      setShowInstallModal(false);
      console.log('[PWA] MovieBuzz App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa_prompt_ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa_prompt_ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        console.log('[PWA] User choice outcome:', choiceResult?.outcome);
        if (choiceResult?.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          (window as any).__pwa_deferred_prompt = null;
          setShowInstallModal(false);
        }
      } catch (err) {
        console.warn('[PWA] prompt error, opening fallback modal:', err);
        setShowInstallModal(true);
      }
    } else {
      // For iOS Safari or browsers where prompt was already dismissed or unavailable
      setShowInstallModal(true);
    }
  };

  // User can install if they're not in standalone mode
  const canInstall = !isInstalled;

  return (
    <PWAContext.Provider
      value={{
        canInstall,
        isInstalled,
        isIOS,
        deferredPrompt,
        showInstallModal,
        setShowInstallModal,
        promptInstall,
      }}
    >
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => useContext(PWAContext);
