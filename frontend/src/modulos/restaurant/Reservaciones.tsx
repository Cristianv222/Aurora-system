import React, { useState, useEffect, useCallback } from 'react';
import TableCroquis from './TableCroquis';
import { Table } from '../../types';

// Extend local types for tables and reservations
interface Reservation {
    id: string;
    reservation_number: string;
    guest_name: string;
    guest_phone: string;
    guest_email?: string;
    party_size: number;
    reservation_date: string;
    reservation_time: string;
    duration_minutes: number;
    occasion: string;
    status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
    special_requests?: string;
    cancellation_reason?: string;
    table?: string | null;
    table_number?: string | null;
}

interface CroquisTable extends Table {
    reservation?: Reservation | null;
}

// ─── Hook responsivo ──────────────────────────────────────────────
const useWindowSize = (): number => {
    const [width, setWidth] = useState<number>(window.innerWidth);
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return width;
};

const RESTAURANT_API = process.env.REACT_APP_RESTAURANT_SERVICE || '';
const API_BASE = `${RESTAURANT_API}/api/restaurant`;

// ─── Configuración de estados ──────────────────────────────────────
interface StatusStyle {
    label: string;
    bg: string;
    color: string;
    border: string;
    dot: string;
}

const STATUS_CONFIG: Record<string, StatusStyle> = {
    pending: { label: 'Pendiente', bg: '#fffbeb', color: '#78350f', border: '#fbbf24', dot: '#f59e0b' },
    confirmed: { label: 'Confirmada', bg: '#eff6ff', color: '#1e40af', border: '#93c5fd', dot: '#2563eb' },
    seated: { label: 'En mesa', bg: '#f0fdf4', color: '#14532d', border: '#86efac', dot: '#16a34a' },
    completed: { label: 'Completada', bg: '#f9fafb', color: '#374151', border: '#d1d5db', dot: '#9ca3af' },
    cancelled: { label: 'Cancelada', bg: '#fff1f2', color: '#881337', border: '#fda4af', dot: '#e11d48' },
    no_show: { label: 'No se presentó', bg: '#faf5ff', color: '#581c87', border: '#d8b4fe', dot: '#9333ea' },
};

const OCCASION_LABELS: Record<string, string> = {
    none: 'Ninguna',
    birthday: 'Cumpleaños',
    anniversary: 'Aniversario',
    business: 'Reunión de negocios',
    graduation: 'Graduación',
    other: 'Ocasión especial',
};

// Acciones posibles por estado
const ACTIONS_BY_STATUS: Record<string, string[]> = {
    pending: ['confirm', 'seat', 'cancel', 'no_show'],
    confirmed: ['seat', 'cancel', 'no_show'],
    seated: ['complete'],
    completed: [],
    cancelled: [],
    no_show: [],
};

interface ActionStyle {
    label: string;
    style: 'primary' | 'success' | 'neutral' | 'danger' | 'warning' | 'ghost' | 'outline';
}

const ACTION_CONFIG: Record<string, ActionStyle> = {
    confirm: { label: 'Confirmar reserva', style: 'primary' },
    seat: { label: 'Sentar en mesa', style: 'success' },
    complete: { label: 'Marcar completada', style: 'neutral' },
    cancel: { label: 'Cancelar reserva', style: 'danger' },
    no_show: { label: 'No se presentó', style: 'warning' },
};

const today = (): string => new Date().toISOString().slice(0, 10);
const fmt = (t: string | undefined | null): string => t ? t.slice(0, 5) : '—';

// ─── Componentes pequeños ──────────────────────────────────────────

interface StatusBadgeProps {
    status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
            style={{
                backgroundColor: cfg.bg,
                color: cfg.color,
                border: `1px solid ${cfg.border}`,
                whiteSpace: 'nowrap',
            }}
        >
            <span
                className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: cfg.dot }}
            />
            {cfg.label}
        </span>
    );
};

interface StatCardProps {
    label: string;
    value: string | number;
    color: string;
    subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color, subtitle }) => (
    <div
        className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-200"
        style={{ borderLeft: `4px solid ${color}` }}
    >
        <div className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="text-xs font-semibold text-slate-700 mt-1">{label}</div>
        {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
);

interface AlertProps {
    type: 'success' | 'error';
    children: React.ReactNode;
}

const Alert: React.FC<AlertProps> = ({ type, children }) => {
    const styles = {
        success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
        error: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' },
    };
    const s = styles[type] || styles.success;
    return (
        <div className={`fixed top-5 right-6 z-[99999] ${s.bg} border ${s.border} ${s.text} rounded-2xl px-5 py-3 font-semibold text-xs shadow-xl max-w-sm animate-[fadeIn_0.2s_ease-out]`}>
            {children}
        </div>
    );
};

interface ModalProps {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
}

const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children, width = 680 }) => (
    <div
        className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div
            className="bg-white rounded-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col transform transition-all scale-100"
            style={{ maxWidth: `${width}px` }}
        >
            {/* Header del modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                <div>
                    <h3 className="m-0 text-base font-bold text-slate-800">{title}</h3>
                    {subtitle && <p className="m-0 mt-0.5 text-xs text-slate-500">{subtitle}</p>}
                </div>
                <button
                    onClick={onClose}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-500 border-none rounded-lg w-7 h-7 text-base font-medium flex items-center justify-center cursor-pointer transition-colors"
                >
                    &times;
                </button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

interface FieldProps {
    label: string;
    children: React.ReactNode;
    error?: string | string[];
    hint?: string;
    half?: boolean;
}

const Field: React.FC<FieldProps> = ({ label, children, error, hint, half }) => (
    <div className={`${half ? 'col-span-1' : 'col-span-2'}`}>
        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
            {label}
        </label>
        {children}
        {hint && !error && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
        {error && (
            <p className="mt-1 text-xs text-rose-600 font-semibold">
                {Array.isArray(error) ? error.join(', ') : error}
            </p>
        )}
    </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    readOnly?: boolean;
}

const Input: React.FC<InputProps> = (props) => (
    <input
        {...props}
        className={`w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition ${
            props.readOnly ? 'bg-slate-50 cursor-default' : 'bg-white'
        } ${props.className || ''}`}
    />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ children, ...props }) => (
    <select
        {...props}
        className={`w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white ${
            props.className || ''
        }`}
    >
        {children}
    </select>
);

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'success' | 'neutral' | 'danger' | 'warning' | 'ghost' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
}

const Btn: React.FC<BtnProps> = ({ variant = 'primary', size = 'md', children, ...props }) => {
    const variants = {
        primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-none',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-none',
        neutral: 'bg-slate-600 hover:bg-slate-700 text-white border-none',
        danger: 'bg-rose-600 hover:bg-rose-700 text-white border-none',
        warning: 'bg-amber-600 hover:bg-amber-700 text-white border-none',
        ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-none',
        outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
    };
    const v = variants[variant] || variants.primary;
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-2.5 text-sm' : 'px-4.5 py-2 text-xs';
    return (
        <button
            {...props}
            className={`rounded-xl font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${v} ${pad} ${
                props.className || ''
            }`}
        >
            {children}
        </button>
    );
};

// ─── Componente principal ──────────────────────────────────────────
const Reservaciones: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [successMsg, setSuccessMsg] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Filtros
    const [filterDate, setFilterDate] = useState<string>(today());
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [search, setSearch] = useState<string>('');

    // Modales
    const [showCreate, setShowCreate] = useState<boolean>(false);
    const [showDetail, setShowDetail] = useState<boolean>(false);
    const [showCroquis, setShowCroquis] = useState<boolean>(false);
    const [showCroquisSelector, setShowCroquisSelector] = useState<boolean>(false);

    const [selected, setSelected] = useState<Reservation | null>(null);
    const [croquisData, setCroquisData] = useState<CroquisTable[]>([]);
    const [selectedMesa, setSelectedMesa] = useState<Table | null>(null);
    const [showCancel, setShowCancel] = useState<boolean>(false);
    const [cancelReason, setCancelReason] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);

    // Paginación
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState<number>(1);

    interface FormState {
        guest_name: string;
        guest_phone: string;
        guest_email: string;
        party_size: number;
        reservation_date: string;
        reservation_time: string;
        duration_minutes: number;
        occasion: string;
        special_requests: string;
        table: string;
    }

    const emptyForm: FormState = {
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        party_size: 2,
        reservation_date: today(),
        reservation_time: '19:00',
        duration_minutes: 90,
        occasion: 'none',
        special_requests: '',
        table: '',
    };
    const [form, setForm] = useState<FormState>(emptyForm);
    const [formErrors, setFormErrors] = useState<Record<string, any>>({});

    // ─── Notificaciones ─────────────────────────────────────────────
    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(''), 3500);
            return () => clearTimeout(t);
        }
    }, [successMsg]);
    useEffect(() => {
        if (errorMsg) {
            const t = setTimeout(() => setErrorMsg(''), 4500);
            return () => clearTimeout(t);
        }
    }, [errorMsg]);

    // ─── API helpers ────────────────────────────────────────────────
    const fetchReservations = useCallback(async () => {
        setLoading(true);
        setCurrentPage(1); // Resetear pagina al buscar
        try {
            const p = new URLSearchParams();
            if (filterDate) p.append('date', filterDate);
            if (filterStatus) p.append('status', filterStatus);
            if (search) p.append('search', search);
            const res = await fetch(`${API_BASE}/reservations/?${p}`);
            const data = await res.json();
            if (data.status === 'success') setReservations(data.data);
        } catch {
            setErrorMsg('No se pudo conectar con el servidor');
        } finally {
            setLoading(false);
        }
    }, [filterDate, filterStatus, search]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reservations/stats/`);
            const data = await res.json();
            if (data.status === 'success') setStats(data.data);
        } catch {}
    }, []);

    const fetchCroquisStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/reservations/croquis/`);
            const data = await res.json();
            if (data.status === 'success') setCroquisData(data.data);
        } catch {}
    }, []);

    const fetchAvailableTables = async (
        dt: string,
        tm: string,
        pax: number,
        dur: number
    ): Promise<CroquisTable[]> => {
        try {
            const p = new URLSearchParams({
                date: dt,
                time: tm,
                party_size: String(pax),
                duration: String(dur),
            });
            const res = await fetch(`${API_BASE}/reservations/available-tables/?${p}`);
            const data = await res.json();
            if (data.status === 'success') return data.data;
        } catch {}
        return [];
    };

    useEffect(() => {
        fetchReservations();
        fetchStats();
    }, [fetchReservations, fetchStats]);

    const performAction = async (id: string, action: string, body: Record<string, any> = {}) => {
        const actionUrl = action === 'no_show' ? 'no-show' : action;
        try {
            const res = await fetch(`${API_BASE}/reservations/${id}/${actionUrl}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.status === 'success') {
                const labels: Record<string, string> = {
                    confirm: 'Reserva confirmada correctamente',
                    seat: 'El cliente fue sentado en su mesa',
                    complete: 'Reserva marcada como completada',
                    cancel: 'Reserva cancelada',
                    no_show: 'Marcado como no presentado',
                };
                setSuccessMsg(labels[action] || 'Acción realizada');
                fetchReservations();
                fetchStats();
                if (showDetail) setShowDetail(false);
            } else {
                setErrorMsg(data.message || 'Ocurrió un error');
            }
        } catch {
            setErrorMsg('Error de conexión con el servidor');
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormErrors({});
        try {
            const payload = {
                ...form,
                party_size: Number(form.party_size),
                duration_minutes: Number(form.duration_minutes),
                table: form.table || null,
            };
            const res = await fetch(`${API_BASE}/reservations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.status === 'success') {
                setSuccessMsg(`Reserva ${data.data.reservation_number} registrada correctamente`);
                setShowCreate(false);
                setForm(emptyForm);
                setSelectedMesa(null);
                fetchReservations();
                fetchStats();
            } else {
                setFormErrors(data.errors || {});
                setErrorMsg(data.message || 'Revise los datos del formulario');
            }
        } catch {
            setErrorMsg('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const openCroquisSelector = async () => {
        const tables = await fetchAvailableTables(
            form.reservation_date,
            form.reservation_time,
            form.party_size,
            form.duration_minutes
        );
        setCroquisData(tables);
        setSelectedMesa(null);
        setShowCroquisSelector(true);
    };

    const handleSelectMesa = (table: Table) => {
        setForm(p => ({ ...p, table: table.id }));
        setSelectedMesa(table);
        setShowCroquisSelector(false);
    };

    const openCroquis = async () => {
        await fetchCroquisStatus();
        setShowCroquis(true);
    };

    // ─── Render ──────────────────────────────────────────────────────
    const s = stats?.today || {};
    const windowWidth = useWindowSize();
    const isMobile = windowWidth < 640;

    return (
        <div className="p-4 sm:p-8 font-sans min-h-screen bg-slate-50 text-slate-800">
            {/* Notificaciones flotantes */}
            {successMsg && <Alert type="success">{successMsg}</Alert>}
            {errorMsg && <Alert type="error">{errorMsg}</Alert>}

            {/* ── Encabezado ─────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 sm:mb-8 gap-4 flex-wrap">
                <div>
                    <h1 className="margin-0 text-2xl sm:text-3xl font-extrabold text-slate-900">Reservaciones</h1>
                    <p className="margin-0 mt-1 text-sm text-slate-500">
                        Registro y seguimiento de reservas del restaurante
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                    <Btn
                        variant="ghost"
                        onClick={openCroquis}
                        className={isMobile ? 'flex-1' : ''}
                    >
                        Ver mapa de mesas
                    </Btn>
                    <Btn
                        variant="primary"
                        size="lg"
                        className={isMobile ? 'flex-1' : ''}
                        onClick={() => {
                            setForm(emptyForm);
                            setFormErrors({});
                            setSelectedMesa(null);
                            setShowCreate(true);
                        }}
                    >
                        + Nueva reserva
                    </Btn>
                </div>
            </div>

            {/* ── Estadísticas del día ───────────────────────────────── */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6 sm:mb-8">
                    <StatCard label="Total hoy" value={s.total || 0} color="#6366f1" subtitle="reservas del día" />
                    <StatCard label="Pendientes" value={s.pending || 0} color="#f59e0b" subtitle="sin confirmar" />
                    <StatCard label="Confirmadas" value={s.confirmed || 0} color="#2563eb" subtitle="listas para llegar" />
                    <StatCard label="En mesa" value={s.seated || 0} color="#16a34a" subtitle="clientes sentados" />
                    <StatCard label="Completadas" value={s.completed || 0} color="#6b7280" subtitle="servicio finalizado" />
                    <StatCard label="Canceladas" value={s.cancelled || 0} color="#dc2626" />
                    <StatCard label="No show" value={s.no_show || 0} color="#9333ea" />
                </div>
            )}

            {/* ── Filtros ────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 mb-5 shadow-sm border border-slate-200">
                <div className="flex gap-3.5 flex-col sm:flex-row flex-wrap items-stretch sm:items-end">
                    <div className="w-full sm:w-40">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Fecha</label>
                        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                    </div>
                    <div className="w-full sm:w-48">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Estado</label>
                        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="">Todos los estados</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Buscar</label>
                        <Input
                            type="text"
                            placeholder="Nombre del cliente, teléfono o número..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchReservations()}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Btn variant="primary" onClick={fetchReservations} className={isMobile ? 'flex-1' : ''}>Buscar</Btn>
                        <Btn
                            variant="ghost"
                            onClick={() => {
                                setFilterDate(today());
                                setFilterStatus('');
                                setSearch('');
                            }}
                            className={isMobile ? 'flex-1' : ''}
                        >
                            Limpiar
                        </Btn>
                    </div>
                </div>
            </div>

            {/* ── Tabla de reservas ──────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center text-slate-400 text-sm font-medium">
                        Cargando reservaciones...
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="text-slate-300 flex justify-center mb-3">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                        </div>
                        <p className="margin-0 text-sm font-bold text-slate-700">
                            No hay reservaciones para esta fecha
                        </p>
                        <p className="margin-0 mt-1 text-xs text-slate-400">
                            Use el botón "Nueva reserva" para registrar una.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-width-[780px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">N. Reserva</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Teléfono</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mesa</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Pax</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hora</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ocasión</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    const totalPages = Math.ceil(reservations.length / PAGE_SIZE);
                                    const start = (currentPage - 1) * PAGE_SIZE;
                                    const pageItems = reservations.slice(start, start + PAGE_SIZE);
                                    return pageItems.map((r, i) => (
                                        <tr
                                            key={r.id}
                                            className="hover:bg-indigo-50/20 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setSelected(r);
                                                setShowDetail(true);
                                                setShowCancel(false);
                                                setCancelReason('');
                                            }}
                                        >
                                            <td className="px-5 py-3.5">
                                                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                    {r.reservation_number}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-slate-900">
                                                {r.guest_name}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-550">{r.guest_phone || '—'}</td>
                                            <td className="px-5 py-3.5">
                                                {r.table_number ? (
                                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-250 px-2.5 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap">
                                                        Mesa {r.table_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic whitespace-nowrap">Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center font-bold text-slate-800">{r.party_size}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-slate-800">{fmt(r.reservation_time)}</span>
                                                <span className="text-[10px] text-slate-400 block mt-0.5">{r.duration_minutes} min</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-550 text-xs">
                                                {r.occasion !== 'none' ? OCCASION_LABELS[r.occasion] || '—' : '—'}
                                            </td>
                                            <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                                <StatusBadge status={r.status} />
                                            </td>
                                            <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex gap-2">
                                                    {r.status === 'pending' && (
                                                        <Btn variant="primary" size="sm" onClick={() => performAction(r.id, 'confirm')}>Confirmar</Btn>
                                                    )}
                                                    {(r.status === 'pending' || r.status === 'confirmed') && (
                                                        <Btn variant="success" size="sm" onClick={() => performAction(r.id, 'seat')}>Sentar</Btn>
                                                    )}
                                                    {r.status === 'seated' && (
                                                        <Btn variant="neutral" size="sm" onClick={() => performAction(r.id, 'complete')}>Completar</Btn>
                                                    )}
                                                    <Btn variant="ghost" size="sm" onClick={() => { setSelected(r); setShowDetail(true); }}>Ver detalle</Btn>
                                                </div>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Paginación ─────────────────────────────────── */}
                {!loading && reservations.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 gap-3">
                        <span className="text-xs text-slate-500 font-semibold">
                            {(() => {
                                const start = (currentPage - 1) * PAGE_SIZE + 1;
                                const end = Math.min(currentPage * PAGE_SIZE, reservations.length);
                                return `Mostrando ${start}–${end} de ${reservations.length} reservaciones`;
                            })()}
                        </span>
                        {Math.ceil(reservations.length / PAGE_SIZE) > 1 && (
                            <div className="flex gap-1.5 items-center">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    Anterior
                                </button>
                                {Array.from({ length: Math.ceil(reservations.length / PAGE_SIZE) }, (_, i) => i + 1).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold min-w-[32px] transition-colors ${
                                            p === currentPage
                                                ? 'bg-indigo-600 border-indigo-650 text-white'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(reservations.length / PAGE_SIZE), p + 1))}
                                    disabled={currentPage === Math.ceil(reservations.length / PAGE_SIZE)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                                >
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ══ MODAL: NUEVA RESERVA ══════════════════════════════════ */}
            {showCreate && (
                <Modal
                    title="Registrar nueva reserva"
                    subtitle="Complete los datos del cliente y la reserva"
                    onClose={() => setShowCreate(false)}
                    width={720}
                >
                    <form onSubmit={handleCreate} className="space-y-4">
                        {/* Datos del cliente */}
                        <SectionHeader>Datos del cliente</SectionHeader>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Nombre completo del cliente *" error={formErrors.guest_name} half={isMobile ? false : true}>
                                <Input
                                    required
                                    value={form.guest_name}
                                    placeholder="Ej: María López"
                                    onChange={e => setForm(p => ({ ...p, guest_name: e.target.value }))}
                                />
                            </Field>
                            <Field label="Teléfono de contacto *" error={formErrors.guest_phone} half={isMobile ? false : true}>
                                <Input
                                    required
                                    value={form.guest_phone}
                                    placeholder="Ej: 0991234567"
                                    onChange={e => setForm(p => ({ ...p, guest_phone: e.target.value }))}
                                />
                            </Field>
                            <Field label="Correo electrónico" error={formErrors.guest_email} half={isMobile ? false : true}>
                                <Input
                                    type="email"
                                    value={form.guest_email}
                                    placeholder="Opcional"
                                    onChange={e => setForm(p => ({ ...p, guest_email: e.target.value }))}
                                />
                            </Field>
                            <Field label="Número de personas *" error={formErrors.party_size} hint="Cuántas personas asistirán" half={isMobile ? false : true}>
                                <Input
                                    required
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={form.party_size}
                                    onChange={e => setForm(p => ({ ...p, party_size: Number(e.target.value) }))}
                                />
                            </Field>
                        </div>

                        {/* Fecha y hora */}
                        <SectionHeader>Fecha y horario</SectionHeader>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Fecha de la reserva *" error={formErrors.reservation_date} half={isMobile ? false : true}>
                                <Input
                                    required
                                    type="date"
                                    value={form.reservation_date}
                                    onChange={e => setForm(p => ({ ...p, reservation_date: e.target.value }))}
                                />
                            </Field>
                            <Field label="Hora de llegada *" error={formErrors.reservation_time} half={isMobile ? false : true}>
                                <Input
                                    required
                                    type="time"
                                    value={form.reservation_time}
                                    onChange={e => setForm(p => ({ ...p, reservation_time: e.target.value }))}
                                />
                            </Field>
                            <Field label="Duración estimada" hint="Cuánto tiempo ocuparán la mesa (en minutos)" half={isMobile ? false : true}>
                                <Select
                                    value={form.duration_minutes}
                                    onChange={e => setForm(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                                >
                                    <option value={60}>1 hora</option>
                                    <option value={90}>1 hora 30 minutos</option>
                                    <option value={120}>2 horas</option>
                                    <option value={150}>2 horas 30 minutos</option>
                                    <option value={180}>3 horas</option>
                                </Select>
                            </Field>
                            <Field label="Tipo de ocasión" half={isMobile ? false : true}>
                                <Select
                                    value={form.occasion}
                                    onChange={e => setForm(p => ({ ...p, occasion: e.target.value }))}
                                >
                                    {Object.entries(OCCASION_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </Select>
                            </Field>
                        </div>

                        {/* Mesa */}
                        <SectionHeader>Asignación de mesa</SectionHeader>
                        <Field label="Mesa asignada" hint="Puede dejar sin asignar y asignar luego" error={formErrors.table}>
                            <div className="flex gap-2 items-center">
                                <Input
                                    readOnly
                                    value={selectedMesa ? `Mesa ${selectedMesa.number} — capacidad ${selectedMesa.capacity} personas` : ''}
                                    placeholder="Sin mesa asignada (se asignará al llegar el cliente)"
                                    className="flex-1"
                                />
                                <Btn type="button" variant="outline" onClick={openCroquisSelector}>
                                    Ver mapa de mesas
                                </Btn>
                                {selectedMesa && (
                                    <Btn
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            setForm(p => ({ ...p, table: '' }));
                                            setSelectedMesa(null);
                                        }}
                                    >
                                        Quitar
                                    </Btn>
                                )}
                            </div>
                        </Field>

                        {/* Notas */}
                        <div className="mt-1">
                            <Field label="Solicitudes especiales" hint="Alergias, preferencias de asiento, decoración, etc.">
                                <textarea
                                    value={form.special_requests}
                                    onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))}
                                    placeholder="Ej: cliente alérgico a los mariscos, necesita silla de bebé..."
                                    rows={3}
                                    className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white resize-none"
                                />
                            </Field>
                        </div>

                        {formErrors.non_field_errors && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-bold">
                                {formErrors.non_field_errors}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-slate-100">
                            <Btn type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Btn>
                            <Btn type="submit" variant="primary" size="lg" disabled={saving}>
                                {saving ? 'Guardando reserva...' : 'Guardar reserva'}
                            </Btn>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ══ MODAL: DETALLE DE RESERVA ═════════════════════════════ */}
            {showDetail && selected && (
                <Modal
                    title={`Reserva ${selected.reservation_number}`}
                    subtitle={`${selected.reservation_date} a las ${fmt(selected.reservation_time)} — ${selected.guest_name}`}
                    onClose={() => {
                        setShowDetail(false);
                        setShowCancel(false);
                    }}
                    width={640}
                >
                    {/* Info principal */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 mb-5">
                        <InfoRow label="Cliente" value={selected.guest_name} />
                        <InfoRow label="Teléfono" value={selected.guest_phone || '—'} />
                        <InfoRow label="Correo" value={selected.guest_email || '—'} />
                        <InfoRow label="Personas" value={`${selected.party_size} persona${selected.party_size !== 1 ? 's' : ''}`} />
                        <InfoRow label="Fecha" value={selected.reservation_date} />
                        <InfoRow label="Hora" value={`${fmt(selected.reservation_time)} (${selected.duration_minutes} min)`} />
                        <InfoRow label="Mesa" value={selected.table_number ? `Mesa ${selected.table_number}` : 'Sin asignar'} />
                        <InfoRow label="Ocasión" value={selected.occasion !== 'none' ? OCCASION_LABELS[selected.occasion] : 'Ninguna'} />
                        <div className="col-span-2">
                            <InfoRow label="Estado" value={<StatusBadge status={selected.status} />} />
                        </div>
                    </div>

                    {selected.special_requests && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5">
                            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                                Solicitudes especiales
                            </div>
                            <div className="text-sm text-amber-900 font-medium">{selected.special_requests}</div>
                        </div>
                    )}

                    {selected.cancellation_reason && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 mb-5">
                            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                                Motivo de cancelación
                            </div>
                            <div className="text-sm text-rose-900 font-medium">{selected.cancellation_reason}</div>
                        </div>
                    )}

                    {/* Acciones */}
                    {ACTIONS_BY_STATUS[selected.status]?.length > 0 && (
                        <div className="mb-4">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                                Acciones disponibles
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {ACTIONS_BY_STATUS[selected.status].map(action => {
                                    const cfg = ACTION_CONFIG[action];
                                    if (action === 'cancel') {
                                        return (
                                            <Btn
                                                key={action}
                                                variant="danger"
                                                onClick={() => setShowCancel(true)}
                                            >
                                                {cfg.label}
                                            </Btn>
                                        );
                                    }
                                    return (
                                        <Btn
                                            key={action}
                                            variant={cfg.style}
                                            onClick={() => performAction(selected.id, action)}
                                        >
                                            {cfg.label}
                                        </Btn>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Formulario de cancelación */}
                    {showCancel && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                            <p className="margin-0 mb-2.5 text-sm font-bold text-rose-800">
                                Indique el motivo por el cual se cancela la reserva:
                            </p>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={2}
                                placeholder="Ej: El cliente llamó para cancelar..."
                                className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 transition bg-white resize-none"
                            />
                            <div className="flex gap-2 mt-3">
                                <Btn
                                    variant="danger"
                                    onClick={() => performAction(selected.id, 'cancel', { reason: cancelReason })}
                                >
                                    Confirmar cancelación
                                </Btn>
                                <Btn variant="ghost" onClick={() => setShowCancel(false)}>Volver</Btn>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-3 border-t border-slate-100">
                        <Btn variant="ghost" onClick={() => { setShowDetail(false); setShowCancel(false); }}>Cerrar</Btn>
                    </div>
                </Modal>
            )}

            {/* ══ CROQUIS GENERAL ══════════════════════════════════════ */}
            {showCroquis && (
                <TableCroquis
                    tables={croquisData}
                    selectedTable={null}
                    onSelectTable={(table) => {
                        const res = (table as CroquisTable).reservation;
                        if (res) {
                            setSelected({ ...res, table_number: table.number });
                            setShowDetail(true);
                            setShowCroquis(false);
                        }
                    }}
                    onClose={() => setShowCroquis(false)}
                />
            )}

            {/* ══ CROQUIS SELECTOR DE MESA ═════════════════════════════ */}
            {showCroquisSelector && (
                <TableCroquis
                    tables={croquisData}
                    selectedTable={selectedMesa}
                    onSelectTable={handleSelectMesa}
                    onClose={() => setShowCroquisSelector(false)}
                />
            )}
        </div>
    );
};

// ─── Micro-componentes ─────────────────────────────────────────────
interface SectionHeaderProps {
    children: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ children }) => (
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-5 mb-2.5 pb-1.5 border-b border-slate-100">
        {children}
    </div>
);

interface InfoRowProps {
    label: string;
    value: React.ReactNode;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
    <div className="pb-2">
        <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{label}</div>
        <div className="text-sm text-slate-900 font-bold mt-0.5">{value}</div>
    </div>
);

export default Reservaciones;
