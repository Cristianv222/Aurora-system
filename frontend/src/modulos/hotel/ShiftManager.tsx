import React, { useState, useEffect, useContext, FormEvent } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { generateHotelShiftPDF } from '../../utils/hotelReportUtils';

interface Shift {
    id: string;
    shift_number: string;
    user_id: string;
    user_name: string;
    user_role: string;
    status: 'scheduled' | 'open' | 'closed';
    opening_cash: string | number;
    opened_at?: string;
    closed_at?: string;
    scheduled_start?: string;
    scheduled_end?: string;
}

interface PaymentRecord {
    id: number;
    reservation_code: string;
    guest_name: string;
    room_number: string;
    amount: number;
    payment_method: 'cash' | 'card' | 'transfer';
    is_deposit: boolean;
    created_at: string;
}

interface ClosedShiftReport {
    shift_info: {
        id: string;
        shift_number: string;
        user_name: string;
        opened_at: string;
        closed_at: string;
        status: string;
        total_sales: number;
        total_transactions: number;
        opening_notes: string;
        closing_notes: string;
    };
    summary: {
        total_sales: number;
        total_transactions: number;
    };
    payments: PaymentRecord[];
}

interface ShiftManagerProps {
    onShiftActive: (isActive: boolean) => void;
}

const ShiftManager: React.FC<ShiftManagerProps> = ({ onShiftActive }) => {
    const auth = useContext(AuthContext);
    const currentUser = auth?.user;
    const isAdmin = currentUser?.is_staff || 
                    currentUser?.role?.name?.toLowerCase() === 'admin' || 
                    currentUser?.role?.name?.toLowerCase() === 'administrador';

    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [scheduledShifts, setScheduledShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    
    // Forms state
    const [employeeNameInput, setEmployeeNameInput] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [closedShiftReport, setClosedShiftReport] = useState<ClosedShiftReport | null>(null);
    const [openingCashInput, setOpeningCashInput] = useState<string | number>('0.00');
    const [closingCashInput, setClosingCashInput] = useState<string | number>('0.00');
    const [pastShifts, setPastShifts] = useState<any[]>([]);

    // Scheduling state
    const [showSchedulerModal, setShowSchedulerModal] = useState<boolean>(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [scheduledEmployeeName, setScheduledEmployeeName] = useState<string>('');
    const [schedStart, setSchedStart] = useState<string>('');
    const [schedEnd, setSchedEnd] = useState<string>('');
    const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);

    useEffect(() => {
        loadShiftData();
    }, []);

    const loadShiftData = async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Get current active shift
            const activeRes = await api.get('/api/reports/shifts/current/', { baseURL: '/api/hotel' });
            if (activeRes.data && activeRes.data.shift) {
                setCurrentShift(activeRes.data.shift);
                onShiftActive(true);
            } else {
                setCurrentShift(null);
                onShiftActive(false);

                // Check if it was auto closed by the backend
                if (activeRes.data && activeRes.data.auto_closed && activeRes.data.closed_shift_id) {
                    try {
                        const reportRes = await api.get(`/api/reports/shifts/${activeRes.data.closed_shift_id}/report/`, { baseURL: '/api/hotel' });
                        setClosedShiftReport(reportRes.data);
                        generateHotelShiftPDF(reportRes.data);
                        alert('Su turno de trabajo programado ha finalizado y se ha cerrado automáticamente. El sistema generó y descargó el reporte PDF de auditoría de su turno.');
                    } catch (reportErr) {
                        console.error('Error fetching auto-closed shift report:', reportErr);
                    }
                }
            }

            // 2. Get all shifts to filter scheduled ones
            const allRes = await api.get('/api/reports/shifts/', { baseURL: '/api/hotel' });
            const allShifts: Shift[] = allRes.data.results || allRes.data;
            const scheduled = allShifts.filter(s => s.status === 'scheduled');
            setScheduledShifts(scheduled);
            setPastShifts(allShifts.filter(s => s.status !== 'scheduled'));
        } catch (err: any) {
            console.error('Error loading shift data:', err);
            setError('Error al obtener la información de turnos.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenShift = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        
        const nameToUse = employeeNameInput.trim() || 
                           `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 
                           currentUser?.email || 
                           'Recepcionista';

        try {
            const response = await api.post('/api/reports/shifts/', {
                user_name: nameToUse,
                opening_notes: notes,
                opening_cash: Number(openingCashInput) || 0,
                status: 'open'
            }, { baseURL: '/api/hotel' });

            setCurrentShift(response.data);
            onShiftActive(true);
            setEmployeeNameInput('');
            setOpeningCashInput('0.00');
            setNotes('');
            loadShiftData();
        } catch (err: any) {
            console.error('Error opening shift:', err);
            setError(err.response?.data?.error || 'Error al iniciar el turno.');
        }
    };

    const handleOpenScheduledShift = async (shift: Shift) => {
        setError('');
        try {
            const response = await api.post(`/api/reports/shifts/${shift.id}/open_scheduled/`, {
                opening_notes: 'Turno programado iniciado'
            }, { baseURL: '/api/hotel' });

            setCurrentShift(response.data.shift);
            onShiftActive(true);
            loadShiftData();
        } catch (err: any) {
            console.error('Error opening scheduled shift:', err);
            setError(err.response?.data?.error || 'Error al iniciar el turno programado.');
        }
    };

    const handleCloseShift = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentShift) return;

        if (!window.confirm('¿Está seguro de que desea cerrar su turno de trabajo actual? Se registrará la hora de salida para la auditoría.')) return;

        try {
            const closeRes = await api.post(`/api/reports/shifts/${currentShift.id}/close/`, {
                closing_notes: notes,
                closing_cash: Number(closingCashInput) || 0
            }, { baseURL: '/api/hotel' });

            // Get Shift Report details
            try {
                const reportRes = await api.get(`/api/reports/shifts/${currentShift.id}/report/`, { baseURL: '/api/hotel' });
                setClosedShiftReport(reportRes.data);
                generateHotelShiftPDF(reportRes.data);
            } catch (reportErr) {
                console.error('Error getting shift report:', reportErr);
            }

            setCurrentShift(null);
            onShiftActive(false);
            setNotes('');
            setClosingCashInput('0.00');
            loadShiftData();
        } catch (err: any) {
            console.error('Error closing shift:', err);
            setError(err.response?.data?.error || 'Error al finalizar el turno.');
        }
    };

    const handleDownloadShiftPDF = async (shiftId: string) => {
        try {
            const reportRes = await api.get(`/api/reports/shifts/${shiftId}/report/`, { baseURL: '/api/hotel' });
            generateHotelShiftPDF(reportRes.data);
        } catch (err) {
            console.error('Error downloading shift PDF:', err);
            alert('Error al descargar el PDF del reporte del turno.');
        }
    };

    const handleSaveSchedule = async (e: FormEvent) => {
        e.preventDefault();
        if (!scheduledEmployeeName.trim() || !schedStart || !schedEnd) {
            alert('Por favor complete todos los campos');
            return;
        }

        setIsSavingSchedule(true);
        setError('');
        
        const today = new Date().toISOString().split('T')[0];
        const startDateTime = new Date(`${today}T${schedStart}:00`);
        let endDateTime = new Date(`${today}T${schedEnd}:00`);
        if (endDateTime < startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
        }
        
        const payload = {
            status: 'scheduled',
            user_name: scheduledEmployeeName.trim(),
            user_role: 'Recepcionista',
            scheduled_start: startDateTime.toISOString(),
            scheduled_end: endDateTime.toISOString()
        };

        try {
            if (editingShift) {
                // Update
                await api.put(`/api/reports/shifts/${editingShift.id}/`, payload, { baseURL: '/api/hotel' });
            } else {
                // Create
                await api.post('/api/reports/shifts/', payload, { baseURL: '/api/hotel' });
            }
            setShowSchedulerModal(false);
            setEditingShift(null);
            setScheduledEmployeeName('');
            setSchedStart('');
            setSchedEnd('');
            loadShiftData();
        } catch (err: any) {
            console.error('Error saving shift schedule:', err);
            alert(err.response?.data?.error || 'Error al guardar la programación.');
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleEditSchedule = (shift: Shift) => {
        setEditingShift(shift);
        setScheduledEmployeeName(shift.user_name);
        
        if (shift.scheduled_start) {
            const dateObj = new Date(shift.scheduled_start);
            const hh = String(dateObj.getHours()).padStart(2, '0');
            const mm = String(dateObj.getMinutes()).padStart(2, '0');
            setSchedStart(`${hh}:${mm}`);
        }
        if (shift.scheduled_end) {
            const dateObj = new Date(shift.scheduled_end);
            const hh = String(dateObj.getHours()).padStart(2, '0');
            const mm = String(dateObj.getMinutes()).padStart(2, '0');
            setSchedEnd(`${hh}:${mm}`);
        }
        
        setShowSchedulerModal(true);
    };

    const handleDeleteSchedule = async (id: string) => {
        if (!window.confirm('¿Está seguro de que desea eliminar esta programación de turno?')) return;
        try {
            await api.delete(`/api/reports/shifts/${id}/`, { baseURL: '/api/hotel' });
            loadShiftData();
        } catch (err: any) {
            console.error('Error deleting shift schedule:', err);
            alert('Error al eliminar la programación de turno.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-500 text-sm">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent mr-2"></div>
                Cargando estado del turno de recepción...
            </div>
        );
    }

    // Convert date string to readable format
    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString([], {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTimeOnly = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <i className="bi bi-exclamation-octagon-fill text-rose-500"></i>
                    <span>{error}</span>
                </div>
            )}

            {/* MAIN SHIFT PANEL */}
            {currentShift ? (
                /* ACTIVE SHIFT PANEL */
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6 flex-wrap gap-2 border-b border-slate-100 pb-4">
                        <div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-250 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Turno Activo</span>
                            <h3 className="text-lg font-black text-slate-950 mt-1.5">{currentShift.shift_number}</h3>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-400 block font-bold">Empleado de Turno:</span>
                            <span className="text-xs font-bold text-slate-800">{currentShift.user_name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Ingreso (Real): {formatDateTime(currentShift.opened_at)}</span>
                            {currentShift.scheduled_start && (
                                <span className="text-[10px] text-indigo-600 block font-semibold">
                                    Programado: {formatDateTime(currentShift.scheduled_start)}
                                </span>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleCloseShift} className="space-y-4">
                        <h4 className="font-bold text-slate-950 text-xs uppercase tracking-wider">Finalizar Turno de Recepción</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Efectivo contado al cerrar caja ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                                    value={closingCashInput}
                                    onChange={(e) => setClosingCashInput(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observaciones / Novedades de Turno</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-800"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Detalles sobre pendientes, toallas entregadas, novedades de relevo..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-6 py-2.5 font-bold text-xs shadow-md transition whitespace-nowrap h-[38px] w-full md:w-auto"
                            >
                                Registrar Salida y Cerrar Turno
                            </button>
                        </div>
                    </form>
                </div>
            ) : closedShiftReport ? (
                /* CLOSED SHIFT RECEIPT REPORT */
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl text-slate-800 max-w-md mx-auto">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200">
                            <i className="bi bi-shield-check text-2xl"></i>
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Salida de Turno Registrada</h2>
                        <p className="text-xs text-slate-500 mt-1">El turno {closedShiftReport.shift_info.shift_number} ha finalizado.</p>
                    </div>

                    <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-xs">
                        <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1.5 mb-2">Detalles del Turno</h3>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Empleado:</span>
                            <span className="font-bold text-slate-800">{closedShiftReport.shift_info.user_name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Hora de Entrada (Fichaje):</span>
                            <span className="font-bold text-slate-800">{formatDateTime(closedShiftReport.shift_info.opened_at)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Hora de Salida (Fichaje):</span>
                            <span className="font-bold text-slate-800">{formatDateTime(closedShiftReport.shift_info.closed_at)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total Reservaciones / Movimientos:</span>
                            <span className="font-bold text-slate-800">{closedShiftReport.shift_info.total_transactions} transacciones</span>
                        </div>
                        {closedShiftReport.shift_info.opening_notes && (
                            <div className="border-t border-slate-200 pt-2">
                                <span className="text-slate-500 block font-semibold mb-0.5">Notas de Apertura:</span>
                                <p className="text-slate-700 italic">{closedShiftReport.shift_info.opening_notes}</p>
                            </div>
                        )}
                        {closedShiftReport.shift_info.closing_notes && (
                            <div className="border-t border-slate-200 pt-2">
                                <span className="text-slate-500 block font-semibold mb-0.5">Observaciones de Salida:</span>
                                <p className="text-slate-700 italic">{closedShiftReport.shift_info.closing_notes}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                        <button
                            onClick={() => window.print()}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                        >
                            <i className="bi bi-printer-fill"></i> Imprimir Reporte de Turno
                        </button>
                        <button
                            onClick={() => setClosedShiftReport(null)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs transition"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            ) : (
                /* OPEN SHIFT OPTIONS */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Formulario Apertura Manual */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 space-y-4">
                        <h3 className="text-sm font-black text-slate-900 mb-2 flex items-center gap-2 uppercase tracking-wider">
                            <i className="bi bi-door-open-fill text-indigo-600"></i> Apertura Manual de Turno
                        </h3>
                        <p className="text-xs text-slate-500">
                            Inicie su turno de trabajo registrando el efectivo inicial en caja.
                        </p>
                        <form onSubmit={handleOpenShift} className="space-y-4 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Recepcionista</label>
                                    <input
                                        type="text"
                                        placeholder="Nombre del recepcionista"
                                        className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-800"
                                        value={employeeNameInput}
                                        onChange={(e) => setEmployeeNameInput(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Efectivo Inicial en Caja ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-800 font-bold"
                                        value={openingCashInput}
                                        onChange={(e) => setOpeningCashInput(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observaciones de Apertura</label>
                                <input
                                    type="text"
                                    placeholder="Novedades de apertura, entrega de llaves, etc..."
                                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-800"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition"
                            >
                                Abrir Turno de Trabajo
                            </button>
                        </form>
                    </div>

                    {/* Turnos Programados */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                                <i className="bi bi-calendar3 text-indigo-600"></i> Turnos Programados
                            </h3>
                            {scheduledShifts.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 italic text-[11px] border border-dashed border-slate-200 rounded-xl bg-slate-50">
                                    Sin programaciones para hoy
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                    {scheduledShifts.map(s => (
                                        <div key={s.id} className="p-2.5 border border-slate-150 rounded-xl bg-slate-50 flex flex-col justify-between gap-2 text-[11px]">
                                            <div>
                                                <strong className="text-slate-800 block font-bold">{s.user_name}</strong>
                                                <span className="text-[9px] text-slate-500 font-medium">
                                                    Horario: {s.scheduled_start ? formatTimeOnly(s.scheduled_start) : ''} - {s.scheduled_end ? formatTimeOnly(s.scheduled_end) : ''}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleOpenScheduledShift(s)}
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg font-bold text-[10px] transition text-center"
                                            >
                                                Iniciar Turno
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN SCHEDULER VIEW */}
            {isAdmin && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2 border-b border-slate-100 pb-3">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                            <i className="bi bi-calendar-event-fill text-indigo-600"></i> Planificación y Cronograma de Turnos (Admin)
                        </h3>
                        <button
                            onClick={() => {
                                setEditingShift(null);
                                setScheduledEmployeeName('');
                                setSchedStart('');
                                setSchedEnd('');
                                setShowSchedulerModal(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-sm transition"
                        >
                            + Programar Turno
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs divide-y divide-slate-200">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <th className="p-3">Número Turno</th>
                                    <th className="p-3">Empleado</th>
                                    <th className="p-3">Inicio Programado</th>
                                    <th className="p-3">Fin Programado</th>
                                    <th className="p-3">Estado</th>
                                    <th className="p-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                {scheduledShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-6 text-center text-slate-400 italic">No hay turnos programados en el sistema.</td>
                                    </tr>
                                ) : (
                                    scheduledShifts.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                            <td className="p-3 font-mono font-bold text-slate-900">{s.shift_number}</td>
                                            <td className="p-3 font-medium">{s.user_name}</td>
                                            <td className="p-3 font-semibold text-indigo-600">{formatTimeOnly(s.scheduled_start)} Hs</td>
                                            <td className="p-3 font-semibold text-indigo-600">{formatTimeOnly(s.scheduled_end)} Hs</td>
                                            <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider bg-amber-50 border-amber-200 text-amber-800">
                                                    Programado
                                                </span>
                                            </td>
                                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleEditSchedule(s)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-[10px] font-bold transition"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSchedule(s.id)}
                                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg px-2.5 py-1 text-[10px] font-bold transition"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: ADMIN SHIFT SCHEDULER FORM (CREATE / EDIT) */}
            {showSchedulerModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase tracking-wider">
                                {editingShift ? 'Editar Turno Programado' : 'Programar Turno de Trabajo'}
                            </h3>
                            <button onClick={() => setShowSchedulerModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>
                        <form onSubmit={handleSaveSchedule} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre del Empleado</label>
                                <input
                                    type="text"
                                    value={scheduledEmployeeName}
                                    onChange={e => setScheduledEmployeeName(e.target.value)}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs text-slate-850"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Hora de Entrada</label>
                                    <input
                                        type="time"
                                        value={schedStart}
                                        onChange={e => setSchedStart(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-805"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Hora de Salida</label>
                                    <input
                                        type="time"
                                        value={schedEnd}
                                        onChange={e => setSchedEnd(e.target.value)}
                                        className="w-full border border-slate-350 rounded-xl p-2 text-xs text-slate-805"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={isSavingSchedule}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                                >
                                    {isSavingSchedule ? 'Guardando...' : editingShift ? 'Actualizar Programación' : 'Programar Turno'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSchedulerModal(false)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* HISTORIAL DE AUDITORÍA DE CAJAS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-6">
                <h3 className="text-sm font-bold text-slate-900 mb-5 uppercase tracking-wider flex items-center gap-2">
                    <i className="bi bi-journal-text text-indigo-600"></i> Historial de Auditoría de Cajas (Turnos)
                </h3>
                
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-3">Número Turno</th>
                                <th className="p-3">Recepcionista</th>
                                <th className="p-3">Fecha Apertura</th>
                                <th className="p-3">Fecha Cierre</th>
                                <th className="p-3">Estado</th>
                                <th className="p-3 text-right">Monto Recaudado</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                            {pastShifts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">No se han registrado turnos.</td>
                                </tr>
                            ) : (
                                pastShifts.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                        <td className="p-3 font-mono font-bold text-slate-900">{s.shift_number}</td>
                                        <td className="p-3 font-medium">{s.user_name}</td>
                                        <td className="p-3">{s.opened_at ? new Date(s.opened_at).toLocaleString() : '-'}</td>
                                        <td className="p-3">{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                                s.status === 'open' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                                            }`}>
                                                {s.status === 'open' ? 'Abierto' : 'Cerrado'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-bold text-slate-900">${s.status === 'closed' ? Number(s.total_sales).toFixed(2) : Number(s.total_sales_live).toFixed(2)}</td>
                                        <td className="p-3 text-right">
                                            {s.status === 'closed' && (
                                                <button
                                                    onClick={() => handleDownloadShiftPDF(s.id)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm transition inline-flex items-center gap-1"
                                                >
                                                    <i className="bi bi-file-earmark-pdf-fill"></i> PDF
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftManager;
