import React, { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  canInstall: false,
  isInstalled: false,
  promptInstall: async () => {},
});

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      console.log('[PWA] MovieBuzz App was successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      alert('To install MovieBuzz on iOS, tap the Share button in Safari and select "Add to Home Screen".');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice outcome:', outcome);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <PWAContext.Provider value={{ canInstall, isInstalled, promptInstall }}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = () => useContext(PWAContext);
