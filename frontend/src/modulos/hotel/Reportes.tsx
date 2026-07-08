import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { generateHotelShiftPDF } from '../../utils/hotelReportUtils';

interface RoomStats {
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
    occupancy_rate: number;
}

interface SalesStats {
    today: number;
    today_transactions: number;
    yesterday: number;
    yesterday_transactions: number;
    active_shifts: number;
}

interface TrendItem {
    date: string;
    sales: number;
}

interface DashboardStats {
    rooms: RoomStats;
    sales: SalesStats;
    trend: TrendItem[];
}

interface ShiftItem {
    id: string;
    shift_number: string;
    user_name: string;
    opened_at: string;
    closed_at: string | null;
    status: 'open' | 'closed';
    total_sales: string | number;
    cash_difference: string | number;
}

interface ShiftReportDetail {
    shift_info: {
        id: string;
        shift_number: string;
        user_name: string;
        opened_at: string;
        closed_at: string;
        status: string;
        opening_cash: number;
        closing_cash: number;
        total_sales: number;
        total_cash_sales: number;
        total_card_sales: number;
        total_transfer_sales: number;
        total_transactions: number;
        cash_difference: number;
        opening_notes: string;
        closing_notes: string;
    };
    summary: {
        total_sales: number;
        cash_sales: number;
        card_sales: number;
        transfer_sales: number;
        total_transactions: number;
    };
    payments: Array<{
        id: number;
        reservation_code: string;
        guest_name: string;
        room_number: string;
        amount: number;
        payment_method: string;
        is_deposit: boolean;
        created_at: string;
    }>;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

const Reportes: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [shifts, setShifts] = useState<ShiftItem[]>([]);
    const [selectedShift, setSelectedShift] = useState<ShiftReportDetail | null>(null);
    const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
    const [modalLoading, setModalLoading] = useState<boolean>(false);
    
    // Revenue range filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [revenueData, setRevenueData] = useState<any>(null);
    const [loadingRevenue, setLoadingRevenue] = useState<boolean>(false);

    useEffect(() => {
        loadReportData();
        // Initialize range dates (default last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            loadRevenueFilter();
        }
    }, [startDate, endDate]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const statsRes = await api.get('/api/reports/stats/dashboard_stats/', { baseURL: '/api/hotel' });
            setStats(statsRes.data);

            const shiftsRes = await api.get('/api/reports/shifts/', { baseURL: '/api/hotel' });
            setShifts(shiftsRes.data.results || shiftsRes.data);
        } catch (err) {
            console.error('Error loading report stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadRevenueFilter = async () => {
        setLoadingRevenue(true);
        try {
            const res = await api.get(`/api/reports/stats/revenue/?start_date=${startDate}&end_date=${endDate}`, { baseURL: '/api/hotel' });
            setRevenueData(res.data);
        } catch (err) {
            console.error('Error loading revenue stats:', err);
        } finally {
            setLoadingRevenue(false);
        }
    };

    const handleViewShiftDetails = async (shiftId: string) => {
        setModalLoading(true);
        setShowShiftModal(true);
        try {
            const res = await api.get(`/api/reports/shifts/${shiftId}/report/`, { baseURL: '/api/hotel' });
            setSelectedShift(res.data);
        } catch (err) {
            console.error('Error loading shift report:', err);
            setShowShiftModal(false);
        } finally {
            setModalLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-900 border-t-transparent mr-2"></div>
                Cargando datos de reportes del hotel...
            </div>
        );
    }

    // Pie chart values for room occupancy
    const roomPieData = stats ? [
        { name: 'Disponibles', value: stats.rooms.available, color: '#10b981' },
        { name: 'Ocupadas', value: stats.rooms.occupied, color: '#4f46e5' },
        { name: 'Limpieza', value: stats.rooms.cleaning, color: '#f59e0b' },
        { name: 'Mantenimiento', value: stats.rooms.maintenance, color: '#ef4444' }
    ].filter(item => item.value > 0) : [];

    // Pie chart values for payments
    const paymentPieData = revenueData ? [
        { name: 'Efectivo', value: revenueData.by_method.cash },
        { name: 'Tarjeta', value: revenueData.by_method.card },
        { name: 'Transferencia', value: revenueData.by_method.transfer }
    ].filter(item => item.value > 0) : [];

    return (
        <div className="space-y-6 text-slate-800 animate-in fade-in duration-200">
            {/* Upper Widgets row */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                            <i className="bi bi-percent text-xl"></i>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Tasa Ocupación</span>
                            <strong className="text-2xl font-black text-slate-950 mt-1 block">{stats.rooms.occupancy_rate}%</strong>
                        </div>
                    </div>
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                            <i className="bi bi-cash-stack text-xl"></i>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Recaudación Hoy</span>
                            <strong className="text-2xl font-black text-slate-950 mt-1 block">${stats.sales.today.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                            <i className="bi bi-clock-history text-xl"></i>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Ventas Ayer</span>
                            <strong className="text-2xl font-black text-slate-950 mt-1 block">${stats.sales.yesterday.toFixed(2)}</strong>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-200">
                            <i className="bi bi-journal-check text-xl"></i>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Hab. Ocupadas</span>
                            <strong className="text-2xl font-black text-slate-950 mt-1 block">{stats.rooms.occupied} / {stats.rooms.total}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Graphs row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-day trend chart */}
                {stats && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <i className="bi bi-graph-up-arrow"></i> Tendencia de Recaudación (Últimos 7 días)
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.trend}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10}/>
                                    <YAxis stroke="#94a3b8" fontSize={10}/>
                                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Ventas']}/>
                                    <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)"/>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Rooms status pie */}
                {stats && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <i className="bi bi-pie-chart-fill"></i> Estado de Habitaciones
                            </h3>
                            <div className="h-44 relative flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={roomPieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {roomPieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute text-center">
                                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Total</span>
                                    <strong className="text-2xl font-black text-slate-900">{stats.rooms.total}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-semibold">
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span> Libre: {stats.rooms.available}</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 block"></span> Ocupado: {stats.rooms.occupied}</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span> Sucia: {stats.rooms.cleaning}</div>
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 block"></span> Mant.: {stats.rooms.maintenance}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Income filter & Methods statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Range Filter */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <i className="bi bi-funnel-fill"></i> Ingresos por Métodos de Pago
                        </h3>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="border border-slate-350 rounded-xl px-2.5 py-1 text-xs text-slate-800"
                            />
                            <span className="text-xs text-slate-400 font-bold">a</span>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="border border-slate-350 rounded-xl px-2.5 py-1 text-xs text-slate-800"
                            />
                        </div>
                    </div>

                    {loadingRevenue ? (
                        <div className="flex items-center justify-center h-48 text-slate-400 text-xs">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-800 border-t-transparent mr-2"></div>
                            Calculando ingresos del rango...
                        </div>
                    ) : revenueData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            {/* Bar Chart for payment method */}
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Efectivo', valor: revenueData.by_method.cash },
                                        { name: 'Tarjeta', valor: revenueData.by_method.card },
                                        { name: 'Transf.', valor: revenueData.by_method.transfer }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9}/>
                                        <YAxis stroke="#94a3b8" fontSize={9}/>
                                        <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Ventas']}/>
                                        <Bar dataKey="valor" fill="#4f46e5" radius={[4, 4, 0, 0]}/>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Recaudado</span>
                                    <strong className="text-2xl font-black text-slate-900 block mt-1">${revenueData.total_sales.toFixed(2)}</strong>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Efectivo</span>
                                        <strong className="text-slate-800 font-bold mt-1 block">${revenueData.by_method.cash.toFixed(2)}</strong>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Tarjeta</span>
                                        <strong className="text-slate-800 font-bold mt-1 block">${revenueData.by_method.card.toFixed(2)}</strong>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Transf.</span>
                                        <strong className="text-slate-800 font-bold mt-1 block">${revenueData.by_method.transfer.toFixed(2)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400 italic text-xs">Indique un rango de fechas para cargar el informe.</div>
                    )}
                </div>

                {/* Revenue by Room Type */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <i className="bi bi-tag-fill"></i> Ventas por Tipo de Habitación
                        </h3>
                        {revenueData && revenueData.by_room_type ? (
                            <div className="space-y-3.5 pt-2">
                                {Object.entries(revenueData.by_room_type).map(([name, val]: any, index) => {
                                    const percent = revenueData.total_sales > 0 ? (val / revenueData.total_sales * 100) : 0;
                                    return (
                                        <div key={index}>
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span className="text-slate-650">{name}</span>
                                                <span className="text-slate-900">${val.toFixed(2)} ({percent.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-400 italic text-xs">Cargue el filtro de arriba para ver las ventas por habitación.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shift Logs table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-5 uppercase tracking-wider flex items-center gap-2">
                    <i className="bi bi-journal-text"></i> Historial de Auditoría de Cajas (Turnos)
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
                            {shifts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">No se han registrado turnos en este hotel.</td>
                                </tr>
                            ) : (
                                shifts.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                        <td className="p-3 font-mono font-bold text-slate-900">{s.shift_number}</td>
                                        <td className="p-3 font-medium">{s.user_name}</td>
                                        <td className="p-3">{new Date(s.opened_at).toLocaleString()}</td>
                                        <td className="p-3">{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                                s.status === 'open' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                                            }`}>
                                                {s.status === 'open' ? 'Abierto' : 'Cerrado'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-bold text-slate-900">${Number(s.total_sales).toFixed(2)}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => handleViewShiftDetails(s.id)}
                                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-sm transition"
                                            >
                                                Ver Detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Shift Detail Modal */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
                        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-sm uppercase tracking-wider">Reporte de Auditoría de Turno</h3>
                            <button onClick={() => setShowShiftModal(false)} className="text-white/80 hover:text-white"><i className="bi bi-x-lg"></i></button>
                        </div>

                        {modalLoading ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-850 border-t-transparent mx-auto mb-2"></div>
                                Cargando reporte de turno...
                            </div>
                        ) : selectedShift ? (
                            <div className="p-6 max-h-[80vh] overflow-y-auto space-y-5 text-xs">
                                {/* Header stats block */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-3">
                                    <div><span className="text-slate-500 block">Número de Turno:</span> <strong className="text-slate-800 text-sm block mt-0.5">{selectedShift.shift_info.shift_number}</strong></div>
                                    <div><span className="text-slate-500 block">Recepcionista:</span> <strong className="text-slate-800 text-sm block mt-0.5">{selectedShift.shift_info.user_name}</strong></div>
                                    <div><span className="text-slate-500 block">Fecha Apertura:</span> <strong className="text-slate-800 text-xs block mt-0.5">{new Date(selectedShift.shift_info.opened_at).toLocaleString()}</strong></div>
                                    <div><span className="text-slate-500 block">Fecha Cierre:</span> <strong className="text-slate-800 text-xs block mt-0.5">{selectedShift.shift_info.closed_at ? new Date(selectedShift.shift_info.closed_at).toLocaleString() : '-'}</strong></div>
                                    <div className="col-span-2 border-t border-slate-200 pt-3 mt-1 grid grid-cols-3 gap-2 text-slate-650">
                                        <div>Efectivo: <strong>${selectedShift.summary.cash_sales.toFixed(2)}</strong></div>
                                        <div>Tarjeta: <strong>${selectedShift.summary.card_sales.toFixed(2)}</strong></div>
                                        <div>Transferencia: <strong>${selectedShift.summary.transfer_sales.toFixed(2)}</strong></div>
                                    </div>
                                    <div className="col-span-2 border-t border-slate-200 pt-3 flex justify-between items-center">
                                        <div>
                                            <span className="text-slate-500 block">Total Recaudado en Reservaciones:</span>
                                            <strong className="text-base font-black text-indigo-700">${selectedShift.summary.total_sales.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Shift Notes */}
                                {(selectedShift.shift_info.opening_notes || selectedShift.shift_info.closing_notes) && (
                                    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-slate-750">
                                        {selectedShift.shift_info.opening_notes && (
                                            <div>
                                                <span className="font-bold text-amber-800 block uppercase text-[9px] tracking-wider">Notas de Apertura</span>
                                                <p className="mt-0.5">{selectedShift.shift_info.opening_notes}</p>
                                            </div>
                                        )}
                                        {selectedShift.shift_info.closing_notes && (
                                            <div className="border-t border-amber-200/50 pt-2">
                                                <span className="font-bold text-amber-800 block uppercase text-[9px] tracking-wider">Notas de Cierre</span>
                                                <p className="mt-0.5">{selectedShift.shift_info.closing_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Payments list in shift */}
                                <div>
                                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] mb-2.5 border-b border-slate-100 pb-1 flex justify-between items-center">
                                        <span><i className="bi bi-wallet2 text-slate-500"></i> Detalle de Pagos / Recaudaciones</span>
                                        <span className="text-slate-450">{selectedShift.payments.length} transacción(es)</span>
                                    </h4>
                                    
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                                        <table className="w-full text-left text-xs divide-y divide-slate-200">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                    <th className="p-2">Hora</th>
                                                    <th className="p-2">Hab.</th>
                                                    <th className="p-2">Código</th>
                                                    <th className="p-2">Huésped</th>
                                                    <th className="p-2">Método</th>
                                                    <th className="p-2 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {selectedShift.payments.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-4 text-center text-slate-400 italic">No se registraron cobros en este turno.</td>
                                                    </tr>
                                                ) : (
                                                    selectedShift.payments.map((p, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-55/50 transition">
                                                            <td className="p-2 text-slate-500">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                            <td className="p-2 font-bold">Hab {p.room_number}</td>
                                                            <td className="p-2 font-mono text-slate-600">{p.reservation_code}</td>
                                                            <td className="p-2 text-slate-700 truncate max-w-[120px]">{p.guest_name}</td>
                                                            <td className="p-2 capitalize text-slate-500">{p.payment_method}</td>
                                                            <td className="p-2 text-right font-bold text-slate-900">${p.amount.toFixed(2)}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => generateHotelShiftPDF(selectedShift)}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-center shadow-md transition flex justify-center items-center gap-1.5"
                                    >
                                        <i className="bi bi-file-earmark-pdf-fill"></i> Descargar Reporte PDF
                                    </button>
                                    <button
                                        onClick={() => setShowShiftModal(false)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold px-5 py-2.5 rounded-xl transition"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reportes;
