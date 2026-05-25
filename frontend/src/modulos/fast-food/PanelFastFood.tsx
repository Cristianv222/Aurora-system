import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuickAccessItem {
    title: string;
    description: string;
    path?: string;
    icon: React.ReactNode;
    wip?: boolean;
}

const PanelFastFood: React.FC = () => {
    const navigate = useNavigate();
    const [showWip, setShowWip] = useState<boolean>(false);

    const quickAccess: QuickAccessItem[] = [
        {
            title: 'Punto de Venta',
            description: 'Gestionar ventas y órdenes en tiempo real',
            path: '/fast-food/pos',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        },
        {
            title: 'Órdenes',
            description: 'Ver y gestionar todas las órdenes activas',
            path: '/fast-food/orders',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            ),
        },
        {
            title: 'Inventario',
            description: 'Administrar productos y stock disponible',
            path: '/fast-food/inventory',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
        },
        {
            title: 'Clientes',
            description: 'Gestión de clientes y fidelización',
            path: '/fast-food/customers',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            title: 'Reportes',
            description: 'Análisis y estadísticas de ventas',
            path: '/fast-food/reports',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            title: 'Impresoras',
            description: 'Configurar dispositivos de impresión',
            path: '/fast-food/printers',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
            ),
        },
        {
            title: 'Facturación Electrónica',
            description: 'Emisión de comprobantes electrónicos SRI',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            ),
            wip: true,
        },
    ];

    const infoCards = [
        {
            color: 'bg-slate-100 text-slate-700',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            ),
            title: 'Acceso Rápido',
            desc: 'Navega fácilmente entre módulos',
        },
        {
            color: 'bg-emerald-50 text-emerald-700',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            title: 'Sistema Seguro',
            desc: 'Datos protegidos y encriptados',
        },
        {
            color: 'bg-blue-50 text-blue-700',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            title: 'Tiempo Real',
            desc: 'Información actualizada al instante',
        },
    ];

    return (
        <div className="p-7 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white p-8 mb-7 shadow-xl flex items-center gap-5">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full border-[40px] border-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-44 h-44 rounded-full border-[30px] border-white/5 translate-y-1/2 pointer-events-none" />
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                    🍳
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Kroky — Comida Rápida</h1>
                    <p className="text-slate-400 text-sm mt-1">Selecciona un módulo para comenzar a trabajar</p>
                </div>
            </div>

            {/* Section Label */}
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Módulos disponibles
                <span className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Module Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {quickAccess.map((item, i) => (
                    <div
                        key={i}
                        onClick={() => item.wip ? setShowWip(true) : item.path && navigate(item.path)}
                        className={`
                            relative bg-white border rounded-2xl p-5 cursor-pointer group
                            flex items-center gap-4 overflow-hidden
                            transition-all duration-200
                            ${item.wip
                                ? 'border-dashed border-slate-200 hover:border-amber-300 hover:shadow-amber-50'
                                : 'border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-100'}
                        `}
                    >
                        {/* left accent bar */}
                        <span className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-r opacity-0 group-hover:opacity-100 transition-opacity ${item.wip ? 'bg-amber-400' : 'bg-slate-700'}`} />

                        {item.wip && (
                            <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Próximamente
                            </span>
                        )}

                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${item.wip ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-400 group-hover:text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white'}`}>
                            {item.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                        </div>

                        <svg className={`w-4 h-4 flex-shrink-0 transition-all duration-200 group-hover:translate-x-0.5 ${item.wip ? 'text-amber-400' : 'text-slate-300 group-hover:text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.wip ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' : 'M9 5l7 7-7 7'} />
                        </svg>
                    </div>
                ))}
            </div>

            {/* Info Section */}
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sistema
                <span className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {infoCards.map((c, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                            {c.icon}
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-slate-800">{c.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* WIP Modal */}
            {showWip && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-fade-in"
                    onClick={() => setShowWip(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl border border-slate-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-2xl mx-auto mb-5">🚧</div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Módulo en Construcción</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">
                            La <strong className="text-slate-700">Facturación Electrónica</strong> está actualmente en desarrollo.
                            Pronto podrás emitir comprobantes electrónicos directamente desde el sistema.
                        </p>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6 overflow-hidden">
                            <div className="h-full w-[35%] bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" />
                        </div>
                        <button
                            className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition"
                            onClick={() => setShowWip(false)}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PanelFastFood;
