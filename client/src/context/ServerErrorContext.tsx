import React, { createContext, useContext, useCallback } from 'react';

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

export const ServerErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clearServerError = useCallback(() => {}, []);
  const triggerServerError = useCallback((_info?: Partial<ServerErrorInfo>) => {}, []);
  const retryConnection = useCallback(async (): Promise<boolean> => true, []);

  return (
    <ServerErrorContext.Provider
      value={{
        isServerDown: false,
        errorInfo: null,
        isChecking: false,
        countdown: 0,
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
