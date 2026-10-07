import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // Keep max 3 toasts

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Render Area */}
      <div className="fixed bottom-16 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none flex flex-col space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-2xl backdrop-blur-md border text-sm font-medium animate-fade-in transition-all ${
              toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : toast.type === 'info'
                ? 'bg-blue-950/90 border-blue-500/50 text-blue-200'
                : 'bg-dark-card/95 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-none" />
              ) : toast.type === 'info' ? (
                <Info className="w-5 h-5 text-blue-400 flex-none" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-none" />
              )}
              <span className="line-clamp-2">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white p-1 ml-2 flex-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg: string) => console.log(msg) };
  }
  return context;
};
