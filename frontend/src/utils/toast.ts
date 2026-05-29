type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
    type?: ToastType;
    duration?: number;
}

type ToastCallback = (message: string, options?: ToastOptions) => void;

let globalToastFn: ToastCallback | null = null;
const toastQueue: Array<{ message: string, options?: ToastOptions }> = [];

export const registerToast = (fn: ToastCallback) => {
    globalToastFn = fn;
    while (toastQueue.length > 0) {
        const item = toastQueue.shift();
        if (item) {
            try {
                fn(item.message, item.options);
            } catch (e) {
                console.error("Failed to run queued toast", e);
            }
        }
    }
};

export const showToast = (message: string, options?: ToastOptions) => {
    if (globalToastFn) {
        globalToastFn(message, options);
    } else {
        toastQueue.push({ message, options });
    }
};

// Intercept alert calls on all global scopes
const customAlert = (message: any) => {
    const msgStr = String(message);
    let type: ToastType = 'info';
    if (
        msgStr.includes('✅') || 
        msgStr.toLowerCase().includes('éxito') || 
        msgStr.toLowerCase().includes('exito') || 
        msgStr.toLowerCase().includes('correctamente') || 
        msgStr.toLowerCase().includes('guardado') ||
        msgStr.toLowerCase().includes('activado') ||
        msgStr.toLowerCase().includes('creado')
    ) {
        type = 'success';
    } else if (
        msgStr.includes('❌') || 
        msgStr.toLowerCase().includes('error') || 
        msgStr.toLowerCase().includes('inválido') || 
        msgStr.toLowerCase().includes('falló') ||
        msgStr.toLowerCase().includes('vacío') ||
        msgStr.toLowerCase().includes('no')
    ) {
        type = 'error';
    }

    const cleanMsg = msgStr.replace(/[✅❌⚠️]/g, '').trim();
    showToast(cleanMsg, { type, duration: 4000 });
};

if (typeof window !== 'undefined') {
    (window as any).alert = customAlert;
}
if (typeof globalThis !== 'undefined') {
    (globalThis as any).alert = customAlert;
}
if (typeof self !== 'undefined') {
    (self as any).alert = customAlert;
}

