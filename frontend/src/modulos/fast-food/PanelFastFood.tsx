import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface QuickAccessItem {
    title: string;
    description: string;
    path?: string;
    icon: React.ReactNode;
    wip?: boolean;
    action?: () => void;
}

const PanelFastFood: React.FC = () => {
    const navigate = useNavigate();
    const [showWip, setShowWip] = useState<boolean>(false);
    const [showSRIModal, setShowSRIModal] = useState<boolean>(false);
    
    // SRI Config States
    const [sriIsActive, setSriIsActive] = useState<boolean>(false);
    const [sriVsrToken, setSriVsrToken] = useState<string>('');
    const [sriEnvironment, setSriEnvironment] = useState<string>('TEST');
    const [sriEstCode, setSriEstCode] = useState<string>('001');
    const [sriEmPoint, setSriEmPoint] = useState<string>('001');
    const [savingSri, setSavingSri] = useState<boolean>(false);

    // Monitor States
    const [showMonitorModal, setShowMonitorModal] = useState<boolean>(false);
    const [paymentsList, setPaymentsList] = useState<any[]>([]);
    const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
    const [monitorFilter, setMonitorFilter] = useState<string>('all');
    const [monitorSearch, setMonitorSearch] = useState<string>('');

    const fetchPaymentsList = async () => {
        setLoadingPayments(true);
        try {
            const res = await api.get('/api/fast-food/payments/payments/');
            const data = res.data.results || res.data || [];
            setPaymentsList(data);
        } catch (err) {
            console.error('Error fetching payments list:', err);
        } finally {
            setLoadingPayments(false);
        }
    };

    // Fetch SRI Config
    const fetchSRIConfig = async () => {
        try {
            const res = await api.get('/api/fast-food/payments/sri-config/');
            if (res.status === 200) {
                setSriIsActive(res.data.is_active);
                setSriEnvironment(res.data.environment || 'TEST');
                setSriEstCode(res.data.establishment_code || '001');
                setSriEmPoint(res.data.emission_point || '001');
            }
        } catch (err) {
            console.error('Error fetching SRI configuration:', err);
        }
    };

    const handleSaveSRIConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingSri(true);
        try {
            const payload: any = {
                is_active: sriIsActive,
                environment: sriEnvironment,
                establishment_code: sriEstCode,
                emission_point: sriEmPoint,
            };
            if (sriVsrToken) {
                payload.vsr_token = sriVsrToken;
            }
            const res = await api.post('/api/fast-food/payments/sri-config/', payload);
            if (res.status === 200 || res.status === 201) {
                alert('✅ Configuración SRI guardada con éxito.');
                setShowSRIModal(false);
                setSriVsrToken('');
            } else {
                alert('❌ Error al guardar configuración.');
            }
        } catch (err) {
            console.error('Error saving SRI config:', err);
            alert('❌ Error de conexión al guardar la configuración.');
        } finally {
            setSavingSri(false);
        }
    };

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
            action: () => {
                fetchPaymentsList();
                setShowMonitorModal(true);
            }
        },
        {
            title: 'Credenciales SRI',
            description: 'Configurar ambiente y tokens de emisión',
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            ),
            action: () => {
                fetchSRIConfig();
                setShowSRIModal(true);
            }
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
                        onClick={() => {
                            if (item.action) {
                                item.action();
                            } else if (item.wip) {
                                setShowWip(true);
                            } else if (item.path) {
                                navigate(item.path);
                            }
                        }}
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

            {/* SRI Configuration Modal */}
            {showSRIModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-5 animate-in fade-in duration-200"
                    onClick={() => setShowSRIModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-250 flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center border-b pb-4 mb-5">
                            <h3 className="text-lg font-bold text-slate-900">Configuración SRI — Comida Rápida</h3>
                            <button className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer text-xl" onClick={() => setShowSRIModal(false)}>×</button>
                        </div>
                        
                        <form onSubmit={handleSaveSRIConfig} className="space-y-4">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border">
                                <div>
                                    <span className="block text-sm font-semibold text-slate-800">Facturación SRI</span>
                                    <span className="block text-xs text-slate-500 mt-0.5">Activar envío automático al SRI</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={sriIsActive}
                                        onChange={e => setSriIsActive(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Token de FactuExpress / VSR</label>
                                <input
                                    type="password"
                                    placeholder="Ingresa el token de autenticación..."
                                    className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                                    value={sriVsrToken}
                                    onChange={e => setSriVsrToken(e.target.value)}
                                />
                                <span className="block text-[10px] text-slate-400 mt-1">Déjalo en blanco para mantener el token actual.</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Establecimiento</label>
                                    <input 
                                        type="text" 
                                        value={sriEstCode} 
                                        onChange={e => setSriEstCode(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white" 
                                        placeholder="Ej: 001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Punto Emisión</label>
                                    <input 
                                        type="text" 
                                        value={sriEmPoint} 
                                        onChange={e => setSriEmPoint(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white" 
                                        placeholder="Ej: 001"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ambiente</label>
                                <select 
                                    value={sriEnvironment} 
                                    onChange={e => setSriEnvironment(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                                >
                                    <option value="TEST">Pruebas / Test</option>
                                    <option value="PRODUCTION">Producción</option>
                                </select>
                            </div>

                            <div className="flex gap-2.5 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider border-none rounded-xl cursor-pointer transition"
                                    onClick={() => setShowSRIModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSri}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider border-none rounded-xl cursor-pointer transition disabled:opacity-60"
                                >
                                    {savingSri ? 'Guardando...' : 'Guardar Configuración'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Monitor de Facturación Electrónica Modal */}
            {showMonitorModal && !showSRIModal && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-5 text-left animate-in fade-in duration-200"
                    onClick={() => setShowMonitorModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden transform transition-all duration-300 scale-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                    <i className="bi bi-receipt-cutoff text-lg"></i>
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-slate-900">
                                        Monitor de Facturación Electrónica (SRI)
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Controla y verifica el estado fiscal de todas tus facturas.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        fetchSRIConfig();
                                        setShowSRIModal(true);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95 duration-150"
                                >
                                    <i className="bi bi-gear-fill"></i> Credenciales SRI
                                </button>
                                <button 
                                    className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 border-none rounded-xl w-9 h-9 text-xl font-medium flex items-center justify-center cursor-pointer transition-colors" 
                                    onClick={() => setShowMonitorModal(false)}
                                >
                                    ×
                                </button>
                            </div>
                        </div>

                        {/* Filters & Search */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado:</span>
                                <select
                                    value={monitorFilter}
                                    onChange={e => setMonitorFilter(e.target.value)}
                                    className="px-3 py-2 text-xs text-slate-800 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                                >
                                    <option value="all">Todos los estados</option>
                                    <option value="AUTHORIZED">Autorizados</option>
                                    <option value="QUEUED">En Cola</option>
                                    <option value="REJECTED">Rechazados</option>
                                    <option value="DRAFT">Borradores</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-initial">
                                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 text-xs"></i>
                                    <input
                                        type="text"
                                        placeholder="Buscar por N. Factura o Clave..."
                                        value={monitorSearch}
                                        onChange={e => setMonitorSearch(e.target.value)}
                                        className="pl-9 pr-3.5 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl outline-none w-full sm:w-60 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <button
                                    onClick={fetchPaymentsList}
                                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer hover:shadow-sm active:scale-95"
                                    title="Actualizar listado"
                                >
                                    <i className="bi bi-arrow-clockwise"></i> Actualizar
                                </button>
                            </div>
                        </div>

                        {/* List / Table */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {loadingPayments ? (
                                <div className="text-center py-20 flex flex-col items-center justify-center">
                                    <div className="inline-block w-8 h-8 border-4 border-slate-250 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                    <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cargando facturas...</span>
                                </div>
                            ) : paymentsList.length === 0 ? (
                                <div className="text-center py-16 px-4 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                                        <i className="bi bi-receipt text-2xl"></i>
                                    </div>
                                    <h4 className="text-slate-800 font-bold text-sm">Sin comprobantes</h4>
                                    <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                                        No se encontraron registros de facturación electrónica. Asegúrate de activar la facturación en tus ventas.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-150 bg-white shadow-sm">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/70 border-b border-slate-150 text-slate-550 font-bold uppercase tracking-wider text-[10px]">
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4">Pedido</th>
                                                <th className="px-6 py-4">Factura SRI</th>
                                                <th className="px-6 py-4">Monto</th>
                                                <th className="px-6 py-4">Estado SRI</th>
                                                <th className="px-6 py-4">Clave de Acceso</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {paymentsList
                                                .filter(p => {
                                                    const matchesFilter = monitorFilter === 'all' || p.sri_status === monitorFilter;
                                                    const query = monitorSearch.toLowerCase();
                                                    const matchesSearch = !monitorSearch || 
                                                        (p.sri_number && p.sri_number.toLowerCase().includes(query)) ||
                                                        (p.sri_access_key && p.sri_access_key.toLowerCase().includes(query)) ||
                                                        (p.payment_number && p.payment_number.toLowerCase().includes(query));
                                                    return matchesFilter && matchesSearch;
                                                })
                                                .map(payment => (
                                                    <tr key={payment.id} className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="px-6 py-4.5 whitespace-nowrap text-slate-500">
                                                            {new Date(payment.created_at).toLocaleString('es-EC')}
                                                        </td>
                                                        <td className="px-6 py-4.5 font-bold text-slate-800">
                                                            #{payment.order_number || payment.payment_number}
                                                        </td>
                                                        <td className="px-6 py-4.5 font-semibold text-slate-900">
                                                            {payment.sri_number || (
                                                                <span className="text-slate-450 italic font-normal">No Generado</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4.5 font-extrabold text-slate-950">
                                                            ${parseFloat(payment.amount).toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4.5">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                                                                payment.sri_status === 'AUTHORIZED' 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                                                                    : payment.sri_status === 'QUEUED'
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                                                                    : payment.sri_status === 'REJECTED'
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                                                                    : 'bg-slate-50 text-slate-600 border-slate-200/60'
                                                            }`}>
                                                                {payment.sri_status_display || payment.sri_status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4.5 font-mono text-[10px] text-slate-450 select-all max-w-[220px] truncate" title={payment.sri_access_key}>
                                                            {payment.sri_access_key || <span className="italic font-sans text-slate-400">N/A</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4.5 border-t border-slate-100 flex justify-end bg-white shrink-0">
                            <button
                                className="bg-slate-900 hover:bg-slate-800 text-white border-none px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer hover:shadow-sm active:scale-95"
                                onClick={() => setShowMonitorModal(false)}
                            >
                                Cerrar Monitor
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WIP Modal */}
            {showWip && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-5"
                    onClick={() => setShowWip(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl border border-slate-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-2xl mx-auto mb-5">🚧</div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Módulo en Construcción</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">
                            Este módulo está actualmente en desarrollo.
                        </p>
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
