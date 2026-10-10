import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface ServerErrorInfo {
  status?: number;
  message?: string;
  url?: string;
  timestamp: string;
}

interface ServerErrorContextType {
  isServerDown: boolean;
  errorInfo: ServerErrorInfo | null;
  isChecking: boolean;
  countdown: number;
  triggerServerError: (info?: Partial<ServerErrorInfo>) => void;
  clearServerError: () => void;
  retryConnection: () => Promise<boolean>;
}

const ServerErrorContext = createContext<ServerErrorContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'https://moviebuzz-99fb.onrender.com/api';
const AUTO_RETRY_INTERVAL = 15; // seconds

export const ServerErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isServerDown, setIsServerDown] = useState<boolean>(false);
  const [errorInfo, setErrorInfo] = useState<ServerErrorInfo | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(AUTO_RETRY_INTERVAL);

  const clearServerError = useCallback(() => {
    setIsServerDown(false);
    setErrorInfo(null);
    setCountdown(AUTO_RETRY_INTERVAL);
  }, []);

  const triggerServerError = useCallback((info?: Partial<ServerErrorInfo>) => {
    setIsServerDown(true);
    setErrorInfo({
      status: info?.status || 503,
      message: info?.message || 'Server traffic limit exceeded',
      url: info?.url,
      timestamp: new Date().toLocaleTimeString(),
    });
    setCountdown(AUTO_RETRY_INTERVAL);
  }, []);

  // Health check probe
  const retryConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Determine health check URL
      let probeUrl = `${API_URL}/health`;
      if (!probeUrl.startsWith('http')) {
        probeUrl = '/api/health';
      }

      const res = await axios.get(probeUrl, {
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.status >= 200 && res.status < 400) {
        clearServerError();
        setIsChecking(false);
        return true;
      }
    } catch {
      // Server still failing or unreachable
    }
    setIsChecking(false);
    setCountdown(AUTO_RETRY_INTERVAL);
    return false;
  }, [clearServerError]);

  // Listen to global server error events from Axios interceptors or React Query
  useEffect(() => {
    const handleServerErrorEvent = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<ServerErrorInfo>>;
      triggerServerError(customEvent.detail);
    };

    const handleServerRestoredEvent = () => {
      clearServerError();
    };

    window.addEventListener('cinestream:server-error', handleServerErrorEvent);
    window.addEventListener('cinestream:server-restored', handleServerRestoredEvent);

    // Development / manual test helper attached to window
    (window as any).__simulateServerError = (customMsg?: string) => {
      triggerServerError({
        status: 503,
        message: customMsg || 'Heavy traffic simulation triggered',
      });
    };
    (window as any).__clearServerError = () => {
      clearServerError();
    };

    return () => {
      window.removeEventListener('cinestream:server-error', handleServerErrorEvent);
      window.removeEventListener('cinestream:server-restored', handleServerRestoredEvent);
    };
  }, [triggerServerError, clearServerError]);

  // Auto-retry countdown timer when server is down
  useEffect(() => {
    if (!isServerDown) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          retryConnection();
          return AUTO_RETRY_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isServerDown, retryConnection]);

  return (
    <ServerErrorContext.Provider
      value={{
        isServerDown,
        errorInfo,
        isChecking,
        countdown,
        triggerServerError,
        clearServerError,
        retryConnection,
      }}
    >
      {children}
    </ServerErrorContext.Provider>
  );
};

export const useServerError = (): ServerErrorContextType => {
  const context = useContext(ServerErrorContext);
  if (!context) {
    throw new Error('useServerError must be used within a ServerErrorProvider');
  }
  return context;
};
