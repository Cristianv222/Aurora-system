import React, { useState, useEffect, FormEvent } from 'react';
import api from '../../services/api';
import { generateDetailedPDF } from '../../utils/reportUtils';

interface Shift {
    id: string | number;
    shift_number: string;
    opened_at: string;
    status: 'open' | 'closed';
}

interface ClosedShiftReport {
    total_sales: number;
    total_orders: number;
    shift_info: {
        number: string;
        opened_at: string;
        user: string;
    };
    orders_detail: any;
    payment_methods: any;
    top_products: any;
    date: string;
    is_shift_report: boolean;
    generated_by: string;
}

interface ShiftManagerProps {
    onShiftActive: (isActive: boolean) => void;
}

const ShiftManager: React.FC<ShiftManagerProps> = ({ onShiftActive }) => {
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [openingCash, setOpeningCash] = useState<string>('');
    const [closingCash, setClosingCash] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [closedShiftReport, setClosedShiftReport] = useState<ClosedShiftReport | null>(null);

    useEffect(() => {
        checkCurrentShift();
    }, []);

    const checkCurrentShift = async () => {
        try {
            const response = await api.get('/api/restaurant/pos/shifts/current/');
            if (response.data && response.data.status === 'open') {
                setCurrentShift(response.data);
                onShiftActive(true);
            } else {
                setCurrentShift(null);
                onShiftActive(false);
            }
        } catch (err: any) {
            // Si da 404 es que no hay turno, no es error crítico
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

    const handleOpenShift = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const registersRes = await api.get('/api/restaurant/payments/cash-registers/');
            const register = registersRes.data.results ? registersRes.data.results[0] : registersRes.data[0];

            if (!register) {
                setError('No hay cajas registradoras configuradas');
                return;
            }

            const response = await api.post('/api/restaurant/pos/shifts/', {
                cash_register: register.id,
                opening_cash: parseFloat(openingCash),
                opening_notes: notes
            });

            setCurrentShift(response.data);
            onShiftActive(true);
            setOpeningCash('');
            setNotes('');
        } catch (err: any) {
            console.error('Error opening shift:', err);
            setError('Error al abrir turno. Verifique los datos.');
        }
    };

    const handleCloseShift = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentShift) return;

        if (!window.confirm('¿Está seguro de cerrar el turno?')) return;

        try {
            await api.post(`/api/restaurant/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: parseFloat(closingCash),
                closing_notes: notes
            });

            try {
                const reportResponse = await api.get(`/api/restaurant/pos/shifts/${currentShift.id}/report/`);
                const shiftData = reportResponse.data;
                const normalizedReport: ClosedShiftReport = {
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
                console.error("Error fetching report after close:", reportErr);
            }

            setCurrentShift(null);
            onShiftActive(false);
            setClosingCash('');
            setNotes('');
        } catch (err: any) {
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
            <div className="flex items-center justify-center p-8 text-slate-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-650 mr-2"></div>
                Cargando estado del turno...
            </div>
        );
    }

    if (currentShift) {
        return (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h3 className="text-lg font-bold text-emerald-600 m-0">Turno Abierto: {currentShift.shift_number}</h3>
                    <span className="text-xs text-slate-400 font-medium">
                        Inicio: {new Date(currentShift.opened_at).toLocaleString()}
                    </span>
                </div>

                <form onSubmit={handleCloseShift} className="border-t border-slate-100 pt-4">
                    <h4 className="font-bold text-slate-800 text-sm mb-3">Cerrar Turno</h4>
                    <div className="flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Efectivo Final</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex-[2] min-w-[200px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Notas</label>
                            <input
                                type="text"
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Notas de cierre..."
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-rose-650 hover:bg-rose-700 text-white border-none rounded-xl px-5 py-2.5 font-bold text-sm cursor-pointer transition-colors shadow-sm"
                        >
                            Cerrar Turno
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md max-w-md mx-auto mt-10">
            {closedShiftReport ? (
                <div className="text-center">
                    <div className="mb-4 text-emerald-600">
                        <svg className="w-16 h-16 mx-auto text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <h2 className="text-xl font-bold mt-2 text-emerald-600">¡Turno Cerrado!</h2>
                    </div>
                    <p className="mb-5 text-slate-500 text-sm leading-relaxed">El turno #{closedShiftReport.shift_info.number} ha sido cerrado correctamente.</p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-left text-sm text-slate-700 space-y-2">
                        <div className="flex justify-between">
                            <span>Ventas Totales:</span>
                            <span className="font-bold text-slate-800">${closedShiftReport.total_sales?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/60 pt-2">
                            <span>Órdenes:</span>
                            <span className="font-bold text-slate-800">{closedShiftReport.total_orders}</span>
                        </div>
                    </div>

                    <button
                        onClick={handlePrintReport}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold mb-3 flex items-center justify-center gap-2 cursor-pointer border-none shadow-sm transition-colors text-sm"
                    >
                        <i className="bi bi-printer text-base"></i> Imprimir Reporte
                    </button>

                    <button
                        onClick={() => setClosedShiftReport(null)}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold cursor-pointer border-none transition-colors text-sm"
                    >
                        Volver a Apertura
                    </button>
                </div>
            ) : (
                <>
                    <h2 className="text-xl font-bold mb-5 text-center text-slate-800">Apertura de Caja</h2>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                            {error}
                        </div>
                    )}

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
                                className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-slate-800 transition resize-y"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Observaciones iniciales..."
                                rows={3}
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold cursor-pointer border-none shadow-sm transition-colors text-sm"
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
