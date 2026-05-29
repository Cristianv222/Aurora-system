import React, { useState, useEffect } from 'react';
import { registerToast } from '../utils/toast';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        registerToast((message, options) => {
            const id = Date.now() + Math.random();
            const type = options?.type || 'info';
            const duration = options?.duration || 4000;

            setToasts(prev => [...prev, { id, message, type }]);

            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        });
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
            {toasts.map(toast => {
                let iconClass = 'bi bi-info-circle-fill text-blue-500';
                let borderAccent = 'border-l-4 border-l-blue-500';
                const bgClass = 'bg-white';

                if (toast.type === 'success') {
                    iconClass = 'bi bi-check-circle-fill text-emerald-500';
                    borderAccent = 'border-l-4 border-l-emerald-500';
                } else if (toast.type === 'error') {
                    iconClass = 'bi bi-exclamation-triangle-fill text-rose-500';
                    borderAccent = 'border-l-4 border-l-rose-500';
                }

                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-lg border border-slate-200/80 ${bgClass} ${borderAccent} animate-slide-in-right transition-all`}
                        style={{ minHeight: '64px' }}
                    >
                        <div className="flex items-center gap-3">
                            <i className={`${iconClass} text-xl shrink-0`}></i>
                            <span className="text-slate-800 text-sm font-semibold pr-2">{toast.message}</span>
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="bg-transparent border-none text-slate-400 hover:text-slate-600 cursor-pointer p-1 text-sm leading-none transition-colors"
                        >
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default ToastContainer;
