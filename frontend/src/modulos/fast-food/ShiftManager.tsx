import React, { useState, useEffect, FormEvent } from 'react';
import api from '../../services/api';
import { generateDetailedPDF } from '../../utils/reportUtils';

interface ShiftInfo {
    id: string;
    number?: number;
    opened_at: string;
    user?: string;
}

interface Shift {
    id: string;
    shift_number?: string;
    opened_at: string;
    status: string;
}

interface ShiftReport {
    total_sales?: number;
    total_orders?: number;
    shift_info: ShiftInfo;
    orders_detail?: any[];
    payment_methods?: any[];
    top_products?: any[];
    [key: string]: any;
}

interface ShiftManagerProps {
    onShiftActive: (active: boolean) => void;
}

const ShiftManager: React.FC<ShiftManagerProps> = ({ onShiftActive }) => {
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [openingCash, setOpeningCash] = useState<string>('');
    const [closingCash, setClosingCash] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [closedShiftReport, setClosedShiftReport] = useState<ShiftReport | null>(null);

    const checkCurrentShift = async () => {
        try {
            const response = await api.get('/api/pos/shifts/current/', {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
            });
            if (response.data && response.data.status === 'open') {
                setCurrentShift(response.data);
                onShiftActive(true);
            } else {
                setCurrentShift(null);
                onShiftActive(false);
            }
        } catch (err: any) {
            if (err.response && err.response.status === 404) {
                setCurrentShift(null);
                onShiftActive(false);
            } else {
                console.error('Error checking shift:', err);
                setError('Error al verificar turno');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { checkCurrentShift(); }, []);

    const handleOpenShift = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const registersRes = await api.get('/api/payments/cash-registers/', {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
            });
            const register = registersRes.data.results ? registersRes.data.results[0] : registersRes.data[0];
            if (!register) {
                setError('No hay cajas registradoras configuradas');
                return;
            }
            const response = await api.post('/api/pos/shifts/', {
                cash_register: register.id,
                opening_cash: parseFloat(openingCash),
                opening_notes: notes
            }, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setCurrentShift(response.data);
            onShiftActive(true);
            setOpeningCash('');
            setNotes('');
        } catch (err) {
            console.error('Error opening shift:', err);
            setError('Error al abrir turno. Verifique los datos.');
        }
    };

    const handleCloseShift = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentShift) return;
        if (!window.confirm('¿Está seguro de cerrar el turno?')) return;
        try {
            await api.post(`/api/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: parseFloat(closingCash),
                closing_notes: notes
            }, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });

            try {
                const reportResponse = await api.get(`/api/pos/shifts/${currentShift.id}/report/`, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });
                const shiftData = reportResponse.data;
                const normalizedReport: ShiftReport = {
                    ...shiftData.summary,
                    shift_info: shiftData.shift_info,
                    orders_detail: shiftData.orders_detail,
                    payment_methods: shiftData.payment_methods,
                    top_products: shiftData.top_products,
                    date: shiftData.shift_info.opened_at,
                    is_shift_report: true,
                    generated_by: shiftData.shift_info.user
                };
                setClosedShiftReport(normalizedReport);
            } catch (reportErr) {
                console.error('Error fetching report after close:', reportErr);
            }

            setCurrentShift(null);
            onShiftActive(false);
            setClosingCash('');
            setNotes('');
        } catch (err) {
            console.error('Error closing shift:', err);
            setError('Error al cerrar turno');
        }
    };

    const handlePrintReport = () => {
        if (closedShiftReport) {
            generateDetailedPDF(closedShiftReport, 'Reporte de Turno', 'Turno #' + closedShiftReport.shift_info.number);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="inline-block w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mr-3"></div>
                <span className="text-slate-500 text-sm font-medium">Cargando estado del turno...</span>
            </div>
        );
    }

    // Turno abierto: mostrar cierre
    if (currentShift) {
        return (
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm mb-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <h3 className="text-lg font-bold text-emerald-700">
                            Turno Abierto: {currentShift.shift_number}
                        </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        Inicio: {new Date(currentShift.opened_at).toLocaleString('es-ES')}
                    </span>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">{error}</div>}

                <form onSubmit={handleCloseShift} className="border-t border-slate-100 pt-4">
                    <h4 className="font-semibold text-slate-700 mb-3 text-sm uppercase tracking-wider">Cerrar Turno</h4>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Efectivo Final</label>
                            <input
                                type="number"
                                step="0.01"
                                className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm w-36 focus:outline-none focus:border-slate-800 transition"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                required
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Notas de cierre</label>
                            <input
                                type="text"
                                className="border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observaciones..."
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition"
                        >
                            Cerrar Turno
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-md mx-auto mt-8">
            {closedShiftReport ? (
                <div className="text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">¡Turno Cerrado!</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            El turno #{closedShiftReport.shift_info.number} fue cerrado correctamente.
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Ventas Totales:</span>
                            <span className="font-bold text-slate-800">${closedShiftReport.total_sales?.toFixed(2) ?? '0.00'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Órdenes:</span>
                            <span className="font-bold text-slate-800">{closedShiftReport.total_orders ?? 0}</span>
                        </div>
                    </div>

                    <button
                        onClick={handlePrintReport}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Imprimir Reporte
                    </button>
                    <button
                        onClick={() => setClosedShiftReport(null)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition"
                    >
                        Volver a Apertura
                    </button>
                </div>
            ) : (
                <>
                    <h2 className="text-xl font-bold text-slate-800 text-center mb-6">Apertura de Caja</h2>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">{error}</div>}
                    <form onSubmit={handleOpenShift} className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fondo de Caja (Efectivo Inicial)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                                value={openingCash}
                                onChange={(e) => setOpeningCash(e.target.value)}
                                required
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Notas</label>
                            <textarea
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition resize-none"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observaciones iniciales..."
                                rows={3}
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition"
                        >
                            Abrir Turno
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

export default ShiftManager;
