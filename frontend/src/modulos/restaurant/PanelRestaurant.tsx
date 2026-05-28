import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TableCroquis from './TableCroquis';
import api from '../../services/api';
import printerServiceRestaurant from '../../services/printerServiceRestaurant';

// ── Cache helpers ──────────────────────────────────────────────────────────────
const CACHE_KEY_TABLES = 'aurora_tables_cache';
const CACHE_KEY_PAYMENTS = 'aurora_payments_cache';
const CACHE_KEY_RATES = 'aurora_rates_cache';
const CACHE_TTL_STATIC = 30 * 60 * 1000; // 30 min para pagos y tasas
const POLL_INTERVAL = 30000;           // 30 s (era 60 s)

const readCache = (key: string) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw); // { data, ts }
    } catch { return null; }
};

const writeCache = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { }
};

// ── Interfaces ──────────────────────────────────────────────────────────────
interface Table {
    id: string;
    number: string;
    capacity: number;
    status: 'available' | 'occupied' | 'reserved' | 'inactive';
    current_order_id?: string;
    current_order_number?: string;
}

interface PaymentMethod {
    id: string | number;
    name: string;
    method_type: string;
}

interface PaymentSplit {
    payment_method_id: string | number;
    method_name: string;
    amount_applied: number; // USD
    amount_received: number; // raw currency
    currency_code: string;
    change_amount: number;
}

interface GroupedItem {
    name: string;
    notes: string;
    quantity: number;
    line_total: number;
    product_id?: string;
    is_paid: boolean;
}

const PanelRestaurant: React.FC = () => {
    const navigate = useNavigate();

    // Inicializar mesas desde cache si existe → sin spinner en segunda visita
    const cachedTables = readCache(CACHE_KEY_TABLES);
    const [tables, setTables] = useState<Table[]>(cachedTables?.data || []);
    const [loading, setLoading] = useState<boolean>(!cachedTables);

    const [selectedOrderModal, setSelectedOrderModal] = useState<Table | null>(null); // table object
    const [tableOrders, setTableOrders] = useState<any[]>([]); // all today's orders for this table

    // Estados para pagos parciales/separados
    const [showPartialPayment, setShowPartialPayment] = useState<boolean>(false);
    const [partialAmount, setPartialAmount] = useState<string>('');
    const [showSplitItems, setShowSplitItems] = useState<boolean>(false);
    const [splitItemsSelection, setSplitItemsSelection] = useState<Record<string, number>>({});

    // Estados para pagos y monedas
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
    const [exchangeRate, setExchangeRate] = useState<string>('4000');
    const [loadingRate, setLoadingRate] = useState<boolean>(false);

    const [inputCash, setInputCash] = useState<string>('');
    const [cashGiven, setCashGiven] = useState<number | null>(null);

    const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);

    // Estado independiente para el widget de pagos en "Separar Cuenta"
    const [splitPaymentSplits, setSplitPaymentSplits] = useState<PaymentSplit[]>([]);
    const [splitInputCash, setSplitInputCash] = useState<string>('');
    const [splitCashGiven, setSplitCashGiven] = useState<number | null>(null);
    const [splitPaymentMethod, setSplitPaymentMethod] = useState<string>('');
    const [splitCurrency, setSplitCurrency] = useState<string>('USD');

    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 600);
    const [isCompact, setIsCompact] = useState<boolean>(window.innerWidth > 600 && window.innerWidth <= 1024);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // ── Solo mesas (se llama en polling frecuente) ─────────────────────────────
    const fetchTables = async () => {
        try {
            const tablesRes = await api.get('/api/restaurant/pos/tables/');
            const data = tablesRes.data.results || tablesRes.data || [];
            setTables(data);
            writeCache(CACHE_KEY_TABLES, data);
        } catch (err) {
            console.error('Error cargando mesas', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Datos estáticos con TTL largo (métodos de pago + tasas) ───────────────
    const fetchStatic = async () => {
        // Métodos de pago
        const cachedPay = readCache(CACHE_KEY_PAYMENTS);
        const cachedMethods = cachedPay?.data || [];
        if (cachedPay && Date.now() - cachedPay.ts < CACHE_TTL_STATIC && cachedMethods.length > 0) {
            const methods = cachedMethods;
            setPaymentMethods(methods);
            if (methods.length > 0) {
                const cashMethod = methods.find((m: PaymentMethod) => m.method_type === 'cash');
                const defaultId = cashMethod ? String(cashMethod.id) : String(methods[0].id);
                setSelectedPaymentMethod(defaultId);
                setSplitPaymentMethod(defaultId);
            }
        } else {
            try {
                const paymentsRes = await api.get('/api/restaurant/payments/payment-methods/active/');
                const methods = paymentsRes.data.results || paymentsRes.data || [];
                setPaymentMethods(methods);
                if (methods.length > 0) {
                    writeCache(CACHE_KEY_PAYMENTS, methods);
                    const cashMethod = methods.find((m: PaymentMethod) => m.method_type === 'cash');
                    const defaultId = cashMethod ? String(cashMethod.id) : String(methods[0].id);
                    setSelectedPaymentMethod(defaultId);
                    setSplitPaymentMethod(defaultId);
                }
            } catch (err) {
                console.warn('Métodos de pago no disponibles', err);
            }
        }

        // Tasas de cambio
        const cachedRate = readCache(CACHE_KEY_RATES);
        if (cachedRate && Date.now() - cachedRate.ts < CACHE_TTL_STATIC) {
            setExchangeRate(cachedRate.data);
        } else {
            try {
                setLoadingRate(true);
                const ratesRes = await api.get('/api/restaurant/payments/exchange-rates/active/');
                const rates = ratesRes.data.results || ratesRes.data || [];
                const usdCopRate = rates.find((r: any) => r.from_currency === 'USD' && r.to_currency === 'COP');
                const rate = usdCopRate ? String(usdCopRate.rate) : '4000';
                setExchangeRate(rate);
                writeCache(CACHE_KEY_RATES, rate);
            } catch (err) {
                console.warn('Tasas de cambio no disponibles', err);
                setExchangeRate('4000');
            } finally {
                setLoadingRate(false);
            }
        }
    };

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            setIsMobile(w <= 600);
            setIsCompact(w > 600 && w <= 1024);
        };
        window.addEventListener('resize', handleResize);

        Promise.all([fetchPrinters(), fetchTables(), fetchStatic()]);

        intervalRef.current = setInterval(fetchTables, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Placeholder for printer fetch to keep compilation happy if referenced
    const fetchPrinters = async () => {};

    // ── Refrescar mesas sin recargar la página ─────────────────────────────────
    const refreshTables = async () => {
        await fetchTables();
    };

    // ── Forzar recarga de datos estáticos (borra caché local) ──────────────────
    const clearStaticCache = async () => {
        try { localStorage.removeItem(CACHE_KEY_PAYMENTS); } catch { }
        try { localStorage.removeItem(CACHE_KEY_RATES); } catch { }
        await fetchStatic();
    };

    // ── Cerrar modal y limpiar estado ──────────────────────────────────────────
    const closeModal = () => {
        setSelectedOrderModal(null);
        setTableOrders([]);
        setShowPartialPayment(false);
        setShowSplitItems(false);
        setPartialAmount('');
        setSplitItemsSelection({});
        setCashGiven(null);
        setInputCash('');
        setPaymentSplits([]);
        setSplitPaymentSplits([]);
        setSplitInputCash('');
        setSplitCashGiven(null);
        setSplitCurrency('USD');
    };

    const handleTableSelect = async (table: Table) => {
        if (table.status === 'occupied') {
            try {
                if (table.current_order_number) {
                    const res = await api.get(`/api/restaurant/orders/orders/${table.current_order_number}/`);
                    setTableOrders([res.data]);
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    const res = await api.get(
                        `/api/restaurant/orders/orders/?table_number=${encodeURIComponent(table.number)}&date_from=${today}`
                    );
                    const orders = res.data.results || res.data || [];
                    setTableOrders(orders);
                }
                setSelectedOrderModal(table);
            } catch (err) {
                console.error('Error al cargar orden de la mesa:', err);
                navigate(`/restaurant/pos?table=${encodeURIComponent(table.number)}&restaurantMode=1`);
            }
        } else {
            navigate(`/restaurant/pos?table=${encodeURIComponent(table.number)}&restaurantMode=1`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-950">
                <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin" />
            </div>
        );
    }

    const calculateTotalToPay = () => {
        return tableOrders.reduce((sum, o) => {
            const total = parseFloat(o.total || 0);
            const paid = parseFloat(o.amount_paid || 0);
            return sum + Math.max(0, total - paid);
        }, 0);
    };

    const formatCurrency = (amount: number, currency: string = selectedCurrency) => {
        if (amount === null || amount === undefined || isNaN(amount)) return `$0.00`;
        if (currency === 'COP') {
            return `$${Math.round(amount).toLocaleString('es-CO')} COP`;
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // === AGRUPAR ITEMS PARA EL MODAL ===
    const getGroupedItems = (excludePaid = false): GroupedItem[] => {
        if (!tableOrders || tableOrders.length === 0) return [];
        let allItems = tableOrders.flatMap(o => o.items || []);
        if (excludePaid) {
            allItems = allItems.filter(i => !i.is_paid);
        }

        const grouped = allItems.reduce((acc: Record<string, GroupedItem>, item: any) => {
            const name = item.product_details?.name || item.product_name || 'Producto';
            const notes = item.notes || '';
            const isPaid = item.is_paid || false;
            const key = `${name}|${notes}|${isPaid}`;

            if (!acc[key]) {
                acc[key] = {
                    name,
                    notes,
                    quantity: 0,
                    line_total: 0,
                    product_id: item.product_details?.id || item.product_id || item.product || item.id,
                    is_paid: isPaid
                };
            }
            acc[key].quantity += parseInt(item.quantity || 1, 10);
            acc[key].line_total += parseFloat(item.line_total || (parseFloat(item.unit_price || 0) * item.quantity));
            return acc;
        }, {});

        return Object.values(grouped);
    };

    const groupedItemsForModal = getGroupedItems(false);
    const groupedItemsForSplit = getGroupedItems(true);

    return (
        <div className="h-[calc(100vh-60px)] relative bg-black overflow-hidden flex flex-col">
            {/* Ocultar scrollbar en navegadores Webkit */}
            <style>{`.nav-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* Legend (Semáforo) */}
            <div className="absolute top-5 right-5 z-10 bg-slate-800/85 backdrop-blur border border-white/10 rounded-xl p-2.5 flex flex-row sm:flex-col gap-2.5 shadow-lg text-white text-xs font-semibold">
                <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded border-2 bg-amber-100/80 border-amber-600"></div>
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded border-2 bg-red-200/85 border-red-650"></div>
                    <span>Ocupada</span>
                </div>
            </div>

            {/* Tooltip CSS para modo compacto (tablet) */}
            {isCompact && (
                <style>{`
                    .nav-icon-btn { position: relative; }
                    .nav-icon-btn::after {
                        content: attr(data-tooltip);
                        position: absolute;
                        left: calc(100% + 10px);
                        top: 50%;
                        transform: translateY(-50%);
                        background: rgba(15,23,42,0.95);
                        color: #f1f5f9;
                        padding: 5px 10px;
                        border-radius: 8px;
                        font-size: 0.78rem;
                        font-weight: 600;
                        white-space: nowrap;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.15s;
                        border: 1px solid rgba(255,255,255,0.15);
                        z-index: 999;
                    }
                    .nav-icon-btn:hover::after { opacity: 1; }
                `}</style>
            )}

            {/* Overlay de Botones de Navegación */}
            <div className={`nav-scroll ${
                isMobile
                    ? 'absolute bottom-5 left-2.5 right-2.5 z-20 flex flex-row gap-2 overflow-x-auto pb-2.5'
                    : 'absolute top-5 left-5 z-10 flex flex-col gap-2.5'
            }`}>
                {[
                    { icon: 'box-seam', label: 'Inventario', to: '/restaurant/inventory', mLabel: 'Inventario' },
                    { icon: 'receipt-cutoff', label: 'Órdenes Activas', to: '/restaurant/orders', mLabel: 'Órdenes' },
                    { icon: 'calendar-check', label: 'Reservaciones', to: '/restaurant/reservations', mLabel: 'Reservas' },
                    { icon: 'bar-chart-fill', label: 'Reportes', to: '/restaurant/reports', mLabel: 'Reportes' },
                    { icon: 'printer-fill', label: 'Impresoras', to: '/restaurant/printers', mLabel: 'Impresoras' },
                ].map(({ icon, label, to, mLabel }) => (
                    <button
                        key={to}
                        className={`nav-icon-btn bg-slate-800/85 hover:bg-indigo-600/90 text-slate-100 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                            isMobile
                                ? 'px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0'
                                : isCompact
                                    ? 'p-3'
                                    : 'px-4.5 py-3 font-semibold text-sm'
                        }`}
                        data-tooltip={label}
                        title={isCompact ? label : undefined}
                        onClick={() => navigate(to)}
                    >
                        <i className={`bi bi-${icon} ${isCompact ? 'text-lg' : 'text-base'}`}></i>
                        {!isCompact && (isMobile ? mLabel : label)}
                    </button>
                ))}

                {paymentMethods.length === 0 && (
                    <button
                        className={`nav-icon-btn bg-amber-500/80 hover:bg-amber-600/90 text-white border border-amber-550 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
                            isMobile
                                ? 'px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0'
                                : isCompact
                                    ? 'p-3'
                                    : 'px-4.5 py-3 font-semibold text-sm'
                        }`}
                        data-tooltip="Sincronizar Métodos de Pago"
                        onClick={clearStaticCache}
                        title="Sincronizar Métodos de Pago"
                    >
                        <i className="bi bi-arrow-clockwise"></i>
                        {!isCompact && (isMobile ? 'Sync' : 'Sincronizar Pagos')}
                    </button>
                )}
            </div>

            {/* Modal de resumen de mesa ocupada - TODAS LAS ORDENES DEL DIA */}
            {selectedOrderModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-600 p-4 px-5 flex justify-between items-center text-white shrink-0">
                            <div>
                                <div className="text-lg font-bold">
                                    🪑 Mesa {selectedOrderModal.number}
                                </div>
                                <div className="text-xs opacity-80 mt-0.5">
                                    {tableOrders.length} orden{tableOrders.length !== 1 ? 'es' : ''} hoy
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="bg-transparent border-none text-indigo-200 hover:text-white text-2xl cursor-pointer p-0 leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Body Container Split */}
                        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} flex-1 overflow-hidden`}>
                            {/* Lado Izquierdo: Lista de Productos */}
                            <div className="flex-1 overflow-y-auto flex flex-col border-r border-slate-700">
                                {tableOrders.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">
                                        No hay órdenes registradas hoy para esta mesa.
                                    </div>
                                )}

                                {tableOrders.length > 0 && (
                                    <div className="grid grid-cols-[1fr_auto_auto] px-5 py-2 bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>Producto</span>
                                        <span className="text-center pr-5">Cant.</span>
                                        <span className="text-right">Total</span>
                                    </div>
                                )}

                                {groupedItemsForModal.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`grid grid-cols-[1fr_auto_auto] items-center px-5 py-3 border-b border-slate-700/40 ${
                                            idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                                        } ${item.is_paid ? 'opacity-40' : 'opacity-100'}`}
                                    >
                                        <div>
                                            <div className={`font-semibold text-sm text-slate-200 ${item.is_paid ? 'line-through' : ''}`}>
                                                {item.name} {item.is_paid && <span className="ml-1 text-emerald-400 text-xs font-semibold">(COBRADO)</span>}
                                            </div>
                                            {item.notes && (
                                                <div className="text-xs text-slate-400 italic mt-0.5">{item.notes}</div>
                                            )}
                                        </div>
                                        <span className="text-center pr-5 font-bold text-slate-400 text-sm">
                                            x{item.quantity}
                                        </span>
                                        <span className={`text-right font-bold text-emerald-400 text-sm ${item.is_paid ? 'line-through' : ''}`}>
                                            ${item.line_total.toFixed(2)}
                                        </span>
                                    </div>
                                ))}

                                <div className="flex gap-2.5 p-4 mt-auto">
                                    <button
                                        onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1&newOrder=1`)}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border-none rounded-xl cursor-pointer text-indigo-400 font-semibold text-sm transition-colors"
                                    >
                                        <span className="text-lg font-bold">+</span>
                                        <span>Añadir Productos</span>
                                    </button>

                                    <button
                                        onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1`)}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 border-none rounded-xl cursor-pointer text-amber-400 font-semibold text-sm transition-colors"
                                    >
                                        <i className="bi bi-pencil-square text-amber-400"></i>
                                        <span>Editar / Ver Orden</span>
                                    </button>
                                </div>
                            </div>

                            {/* Lado Derecho: Pagos y Footer */}
                            <div className={`w-full ${isMobile ? 'w-full' : 'w-[420px]'} bg-slate-950 p-5 shrink-0 overflow-y-auto`}>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-slate-450">Total Pendiente</span>
                                    <span className="text-2xl font-black text-amber-400">
                                        {formatCurrency(calculateTotalToPay(), 'USD')}
                                    </span>
                                </div>

                                {/* SECCIÓN: PAGOS MÚLTIPLES */}
                                <div className="mb-4 bg-slate-900 border border-slate-700 rounded-xl p-4">
                                    <h4 className="m-0 mb-3 text-slate-200 text-sm font-bold border-b border-slate-700 pb-1.5 flex items-center gap-1">
                                        💳 Agregar Pago
                                    </h4>

                                    <div className="flex gap-2.5 mb-3">
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Método</label>
                                            <select
                                                value={selectedPaymentMethod}
                                                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs outline-none focus:border-indigo-500"
                                            >
                                                {paymentMethods.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Moneda</label>
                                            <select
                                                value={selectedCurrency}
                                                onChange={(e) => setSelectedCurrency(e.target.value)}
                                                className="w-full p-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-xs outline-none focus:border-indigo-500"
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="COP">COP ($)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Ingreso de monto sugerido */}
                                    <div className="mb-3">
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Monto Entregado ({selectedCurrency})</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={inputCash}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputCash(val);
                                                    setCashGiven(val ? parseFloat(val) : null);
                                                }}
                                                placeholder={`Monto en ${selectedCurrency}`}
                                                className="flex-1 p-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 text-sm outline-none focus:border-indigo-500"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (!cashGiven || cashGiven <= 0) return alert('Ingreso de monto inválido');

                                                    let appliedUSD = 0;
                                                    if (selectedCurrency === 'COP') {
                                                        appliedUSD = cashGiven / parseFloat(exchangeRate || '4000');
                                                    } else {
                                                        appliedUSD = cashGiven;
                                                    }

                                                    const totalPendiente = calculateTotalToPay() - paymentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0);

                                                    let finalAppliedUSD = appliedUSD;
                                                    let methodChange = 0;

                                                    if (appliedUSD > totalPendiente) {
                                                        finalAppliedUSD = totalPendiente;
                                                        if (selectedCurrency === 'COP') {
                                                            methodChange = cashGiven - (totalPendiente * parseFloat(exchangeRate || '4000'));
                                                        } else {
                                                            methodChange = cashGiven - totalPendiente;
                                                        }
                                                    }

                                                    const methodObj = paymentMethods.find(m => String(m.id) === selectedPaymentMethod);

                                                    setPaymentSplits([...paymentSplits, {
                                                        payment_method_id: selectedPaymentMethod,
                                                        method_name: methodObj ? methodObj.name : 'Unknown',
                                                        amount_applied: finalAppliedUSD,
                                                        amount_received: cashGiven,
                                                        currency_code: selectedCurrency,
                                                        change_amount: methodChange
                                                    }]);

                                                    setCashGiven(null);
                                                    setInputCash('');
                                                }}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 border-none rounded-lg text-white font-bold text-xs cursor-pointer transition-colors shadow-sm"
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Atajos de billetes */}
                                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                                        {(selectedCurrency === 'COP' ? [2000, 5000, 10000, 20000, 50000, 100000] : [1, 5, 10, 20, 50, 100]).map(bill => (
                                            <button
                                                key={bill}
                                                onClick={() => {
                                                    const newVal = (cashGiven || 0) + bill;
                                                    setCashGiven(newVal);
                                                    setInputCash(newVal.toString());
                                                }}
                                                className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 rounded text-slate-400 text-[10px] font-bold cursor-pointer transition-colors"
                                            >
                                                + {bill}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* RESUMEN DE PAGOS */}
                                <div className="mb-4 bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                                    <h4 className="m-0 mb-2 text-slate-400 text-xs font-semibold">Pagos Registrados</h4>
                                    {paymentSplits.length === 0 ? (
                                        <div className="text-slate-500 text-xs italic">Sin pagos añadidos aún...</div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {paymentSplits.map((p, idx) => (
                                                <div key={idx} className="flex justify-between items-center border-b border-slate-800 border-dashed pb-1.5 text-xs">
                                                    <span className="text-slate-300">{p.method_name} ({p.currency_code})</span>
                                                    <div className="flex gap-2 items-center">
                                                        <span className="text-emerald-400 font-bold">+{formatCurrency(p.amount_applied, 'USD')}</span>
                                                        <button
                                                            onClick={() => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                                            className="bg-transparent border-none text-rose-500 cursor-pointer text-base leading-none p-0"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                                        <span className="text-slate-200 font-bold text-xs">SALDO PENDIENTE:</span>
                                        <span className={`font-bold text-sm ${
                                            (calculateTotalToPay() - paymentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0)) <= 0.01
                                                ? 'text-emerald-400'
                                                : 'text-rose-500'
                                        }`}>
                                            {formatCurrency(Math.max(0, calculateTotalToPay() - paymentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0)), 'USD')}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-3.5">
                                    <button
                                        onClick={() => {
                                            setPartialAmount('');
                                            setShowPartialPayment(true);
                                        }}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 border-none rounded-xl text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <i className="bi bi-pie-chart-fill"></i> Pago Parcial
                                    </button>
                                    <button
                                        onClick={() => {
                                            const initialSel: Record<string, number> = {};
                                            groupedItemsForSplit.forEach(item => {
                                                if (item.product_id) initialSel[item.product_id] = 0;
                                            });
                                            setSplitItemsSelection(initialSel);
                                            setShowSplitItems(true);
                                        }}
                                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 border-none rounded-xl text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <i className="bi bi-layout-split"></i> Separar Cta
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            const lastOrder = tableOrders[tableOrders.length - 1];
                                            if (!lastOrder) return alert('No hay orden activa');

                                            const totalToPay = calculateTotalToPay();
                                            const totalPaidNow = paymentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0);

                                            if (totalToPay > 0.01) {
                                                if (paymentSplits.length === 0) {
                                                    paymentSplits.push({
                                                        payment_method_id: selectedPaymentMethod,
                                                        method_name: paymentMethods.find(m => String(m.id) === selectedPaymentMethod)?.name || 'Default',
                                                        amount_applied: totalToPay,
                                                        amount_received: selectedCurrency === 'COP' ? totalToPay * parseFloat(exchangeRate) : totalToPay,
                                                        currency_code: selectedCurrency,
                                                        change_amount: 0
                                                    });
                                                } else if (totalPaidNow < totalToPay - 0.01) {
                                                    return alert(`El pago total (${formatCurrency(totalPaidNow, 'USD')}) no cubre la cuenta (${formatCurrency(totalToPay, 'USD')})`);
                                                }
                                            }

                                            try {
                                                await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/checkout/`, {
                                                    payments_list: paymentSplits
                                                });

                                                await printerServiceRestaurant.printReceipt({
                                                    ...lastOrder,
                                                    payments_list: paymentSplits
                                                });

                                                closeModal();
                                                await refreshTables();
                                            } catch (e: any) {
                                                alert('Error al cobrar: ' + (e.response?.data?.error || e.message || e));
                                            }
                                        }}
                                        className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 border-none rounded-xl text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2 transition-colors shadow-lg"
                                    >
                                        <i className="bi bi-wallet2"></i> Cobrar e Imprimir
                                    </button>

                                    <button
                                        onClick={async () => {
                                            try {
                                                const lastOrder = tableOrders[tableOrders.length - 1];
                                                if (lastOrder) await printerServiceRestaurant.printReceipt(lastOrder);
                                            } catch (e: any) {
                                                alert('Error al imprimir: ' + (e.message || e));
                                            }
                                        }}
                                        className="flex-1 py-3 bg-slate-650 hover:bg-slate-700 border-none rounded-xl text-slate-200 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                        title="Imprimir Pre-Cuenta sin cobrar"
                                    >
                                        <i className="bi bi-printer"></i> Solo Imp.
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sub-modal Pago Parcial */}
                    {showPartialPayment && (
                        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 w-full max-w-xs shadow-2xl">
                                <h4 className="text-white m-0 mb-2.5 font-bold">Pago Parcial</h4>
                                <div className="text-slate-400 text-xs mb-4">
                                    Ingresa el monto exacto a pagar en esta transacción.
                                </div>
                                <div className="relative mb-5">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450 text-xl font-semibold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={partialAmount}
                                        onChange={(e) => setPartialAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-750 rounded-xl text-white text-xl font-bold outline-none focus:border-indigo-500"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => setShowPartialPayment(false)}
                                        className="flex-1 py-2.5 bg-transparent border border-slate-600 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer hover:bg-slate-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!partialAmount || isNaN(Number(partialAmount)) || parseFloat(partialAmount) <= 0) return alert('Ingresa un monto válido');
                                            try {
                                                const lastOrder = tableOrders[tableOrders.length - 1];
                                                await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/partial_checkout/`, {
                                                    amount: parseFloat(partialAmount),
                                                    payment_method_id: selectedPaymentMethod,
                                                });

                                                await printerServiceRestaurant.printReceipt(lastOrder);
                                                closeModal();
                                                await refreshTables();
                                            } catch (e: any) {
                                                alert('Error al realizar pago parcial: ' + (e.response?.data?.error || e.message || e));
                                            }
                                        }}
                                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 border-none text-white rounded-lg font-semibold text-xs cursor-pointer transition-colors"
                                    >
                                        Pagar ${parseFloat(partialAmount || '0').toFixed(2)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showSplitItems && (
                        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
                            <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-lg flex flex-col max-h-[95vh] overflow-hidden shadow-2xl">
                                {/* Header */}
                                <div className="p-4 px-5 border-b border-slate-700">
                                    <h4 className="text-white m-0 font-bold">✂️ Separar Cuenta</h4>
                                    <div className="text-slate-400 text-xs mt-1">
                                        Selecciona los productos a cobrar en esta separación.
                                    </div>
                                </div>

                                {/* Lista de productos */}
                                <div className="overflow-y-auto flex-1 divide-y divide-slate-800">
                                    {groupedItemsForSplit.map(item => {
                                        if (!item.product_id) return null;
                                        const totalQty = item.quantity;
                                        const selQty = splitItemsSelection[item.product_id] || 0;

                                        return (
                                            <div key={item.product_id} className="flex items-center justify-between p-3.5 px-5">
                                                <div>
                                                    <div className="text-slate-200 font-semibold text-sm">{item.name}</div>
                                                    <div className="text-slate-400 text-xs mt-0.5">
                                                        Disp: {totalQty} &nbsp;·&nbsp;
                                                        <span className="text-emerald-400">${((item.line_total || 0) / (item.quantity || 1)).toFixed(2)} c/u</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                                                    <button
                                                        onClick={() => setSplitItemsSelection(p => ({ ...p, [item.product_id!]: Math.max(0, selQty - 1) }))}
                                                        className="w-7 h-7 border-none rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-white font-bold w-5 text-center text-sm">{selQty}</span>
                                                    <button
                                                        onClick={() => setSplitItemsSelection(p => ({ ...p, [item.product_id!]: Math.min(totalQty, selQty + 1) }))}
                                                        className="w-7 h-7 border-none rounded bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── Total de esta separación ── */}
                                {(() => {
                                    const splitTotal = Object.entries(splitItemsSelection).reduce((acc, [prodId, qty]) => {
                                        const item = groupedItemsForSplit.find(i => i.product_id === prodId);
                                        if (!item || qty <= 0) return acc;
                                        const unitPrice = (item.line_total || 0) / (item.quantity || 1);
                                        return acc + unitPrice * qty;
                                    }, 0);
                                    const splitPaid = splitPaymentSplits.reduce((a, b) => a + b.amount_applied, 0);
                                    const splitPending = Math.max(0, splitTotal - splitPaid);

                                    return (
                                        <div className="p-4 px-5 border-t border-slate-700 bg-slate-950">
                                            <div className="flex justify-between mb-3 text-xs">
                                                <span className="text-slate-400">Subtotal selección:</span>
                                                <span className="text-amber-400 font-bold text-sm">{formatCurrency(splitTotal, 'USD')}</span>
                                            </div>

                                            {/* Widget de pagos múltiples dentro de Separar Cuenta */}
                                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4.5 mb-4">
                                                <h4 className="m-0 mb-3 text-slate-200 text-xs font-bold border-b border-slate-800 pb-1.5">
                                                    💳 Forma de Pago
                                                </h4>

                                                {/* Método + Moneda */}
                                                <div className="flex gap-2.5 mb-3">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Método</label>
                                                        <select
                                                            value={splitPaymentMethod}
                                                            onChange={(e) => setSplitPaymentMethod(e.target.value)}
                                                            className="w-full p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs outline-none"
                                                        >
                                                            {paymentMethods.map(m => (
                                                                <option key={m.id} value={m.id}>{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Moneda</label>
                                                        <select
                                                            value={splitCurrency}
                                                            onChange={(e) => setSplitCurrency(e.target.value)}
                                                            className="w-full p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs outline-none"
                                                        >
                                                            <option value="USD">USD ($)</option>
                                                            <option value="COP">COP ($)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Monto + Botón */}
                                                <div className="flex gap-2 mb-3">
                                                    <input
                                                        type="number"
                                                        value={splitInputCash}
                                                        onChange={(e) => {
                                                            setSplitInputCash(e.target.value);
                                                            setSplitCashGiven(e.target.value ? parseFloat(e.target.value) : null);
                                                        }}
                                                        placeholder={`Monto en ${splitCurrency}`}
                                                        className="flex-1 p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm outline-none"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!splitCashGiven || splitCashGiven <= 0) return alert('Ingresa un monto válido');

                                                            let appliedUSD = splitCurrency === 'COP'
                                                                ? splitCashGiven / parseFloat(exchangeRate || '4000')
                                                                : splitCashGiven;

                                                            const pendiente = Math.max(0, splitTotal - splitPaymentSplits.reduce((a, b) => a + b.amount_applied, 0));
                                                            let finalApplied = appliedUSD;
                                                            let change = 0;
                                                            if (appliedUSD > pendiente) {
                                                                finalApplied = pendiente;
                                                                change = splitCurrency === 'COP'
                                                                    ? splitCashGiven - (pendiente * parseFloat(exchangeRate || '4000'))
                                                                    : splitCashGiven - pendiente;
                                                            }

                                                            const methodObj = paymentMethods.find(m => String(m.id) === splitPaymentMethod);
                                                            setSplitPaymentSplits([...splitPaymentSplits, {
                                                                payment_method_id: splitPaymentMethod,
                                                                method_name: methodObj ? methodObj.name : 'Unknown',
                                                                amount_applied: finalApplied,
                                                                amount_received: splitCashGiven,
                                                                currency_code: splitCurrency,
                                                                change_amount: change
                                                            }]);
                                                            setSplitInputCash('');
                                                            setSplitCashGiven(null);
                                                        }}
                                                        className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 border-none rounded-lg text-white font-bold text-xs cursor-pointer"
                                                    >
                                                        + Añadir
                                                    </button>
                                                </div>

                                                {/* Atajos de billetes */}
                                                <div className="grid grid-cols-3 gap-1.5 mb-3">
                                                    {(splitCurrency === 'COP' ? [2000, 5000, 10000, 20000, 50000, 100000] : [1, 5, 10, 20, 50, 100]).map(bill => (
                                                        <button
                                                            key={bill}
                                                            onClick={() => {
                                                                const newVal = (splitCashGiven || 0) + bill;
                                                                setSplitCashGiven(newVal);
                                                                setSplitInputCash(newVal.toString());
                                                            }}
                                                            className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded text-slate-400 text-[10px] font-bold cursor-pointer"
                                                        >
                                                            +{bill}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Lista de pagos añadidos */}
                                                {splitPaymentSplits.length > 0 && (
                                                    <div className="space-y-1">
                                                        {splitPaymentSplits.map((p, idx) => (
                                                            <div key={idx} className="flex justify-between items-center border-b border-slate-800 border-dashed pb-1 text-[11px]">
                                                                <span className="text-slate-300">{p.method_name} ({p.currency_code})</span>
                                                                <div className="flex gap-2 items-center">
                                                                    <span className="text-emerald-400 font-bold">+{formatCurrency(p.amount_applied, 'USD')}</span>
                                                                    <button
                                                                        onClick={() => setSplitPaymentSplits(splitPaymentSplits.filter((_, i) => i !== idx))}
                                                                        className="bg-transparent border-none text-rose-500 cursor-pointer text-base leading-none p-0"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Saldo pendiente de esta separación */}
                                                <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-slate-800">
                                                    <span className="text-slate-200 font-bold text-xs">SALDO PENDIENTE:</span>
                                                    <span className={`font-bold text-sm ${splitPending <= 0.01 ? 'text-emerald-400' : 'text-rose-550'}`}>
                                                        {formatCurrency(splitPending, 'USD')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Botones */}
                                            <div className="flex gap-2.5">
                                                <button
                                                    onClick={() => {
                                                        setShowSplitItems(false);
                                                        setSplitPaymentSplits([]);
                                                        setSplitInputCash('');
                                                        setSplitCashGiven(null);
                                                        setSplitItemsSelection({});
                                                    }}
                                                    className="flex-1 py-2.5 bg-transparent border border-slate-600 text-slate-300 rounded-lg font-semibold text-xs cursor-pointer hover:bg-slate-700 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const itemsToSplit = Object.entries(splitItemsSelection)
                                                            .filter(([_, qty]) => qty > 0)
                                                            .map(([prodId, qty]) => ({ product_id: prodId, quantity: qty }));

                                                        if (itemsToSplit.length === 0) return alert('Debes seleccionar al menos un producto para cobrar');

                                                        if (splitTotal > 0.01) {
                                                            const splitPaidNow = splitPaymentSplits.reduce((a, b) => a + b.amount_applied, 0);
                                                            if (splitPaymentSplits.length === 0) {
                                                                splitPaymentSplits.push({
                                                                    payment_method_id: splitPaymentMethod,
                                                                    method_name: paymentMethods.find(m => String(m.id) === splitPaymentMethod)?.name || 'Default',
                                                                    amount_applied: splitTotal,
                                                                    amount_received: splitTotal,
                                                                    currency_code: splitCurrency,
                                                                    change_amount: 0
                                                                });
                                                            } else if (splitPaidNow < splitTotal - 0.01) {
                                                                return alert(`El pago (${formatCurrency(splitPaidNow, 'USD')}) no cubre el subtotal (${formatCurrency(splitTotal, 'USD')}). Añade más pagos.`);
                                                            }
                                                        }

                                                        try {
                                                            const lastOrder = tableOrders[tableOrders.length - 1];
                                                            const res = await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/split_checkout/`, {
                                                                items: itemsToSplit,
                                                                payments_list: splitPaymentSplits,
                                                                payment_method: splitPaymentMethod,
                                                                currency_code: splitCurrency
                                                            });

                                                            const splitPrintItems = itemsToSplit.map(si => {
                                                                const found = groupedItemsForSplit.find(g => g.product_id === si.product_id);
                                                                const unitPrice = found ? parseFloat(String(found.line_total || 0)) / (found.quantity || 1) : 0;
                                                                return {
                                                                    name: found ? found.name : si.product_id,
                                                                    quantity: si.quantity,
                                                                    price: unitPrice,
                                                                    total: unitPrice * si.quantity,
                                                                    note: found ? (found.notes || '') : ''
                                                                };
                                                            });
                                                            const splitSubtotal = splitPrintItems.reduce((s, i) => s + i.total, 0);
                                                            const splitPayload = {
                                                                order_number: res.data.order_number || '',
                                                                table_number: lastOrder.table_number || 'N/A',
                                                                customer_name: 'CONSUMIDOR FINAL',
                                                                items: splitPrintItems,
                                                                subtotal: splitSubtotal,
                                                                discount: 0,
                                                                total: splitSubtotal,
                                                                notes: res.data.notes || '',
                                                                printed_at: new Date().toISOString()
                                                            };
                                                            await api.post('/api/restaurant/hardware/print/order/pos/', splitPayload);

                                                            setSplitPaymentSplits([]);
                                                            setSplitInputCash('');
                                                            setSplitCashGiven(null);
                                                            setShowSplitItems(false);
                                                            setSplitItemsSelection({});

                                                            const lastOrderNumber = lastOrder.order_number || lastOrder.id;
                                                            try {
                                                                const refreshed = await api.get(`/api/restaurant/orders/orders/${lastOrderNumber}/`);
                                                                const allItems = refreshed.data.items || [];
                                                                const unpaidItems = allItems.filter((i: any) => !i.is_paid);
                                                                if (unpaidItems.length > 0) {
                                                                    setTableOrders([refreshed.data]);
                                                                } else {
                                                                    closeModal();
                                                                    await refreshTables();
                                                                }
                                                            } catch (_) {
                                                                closeModal();
                                                                await refreshTables();
                                                            }
                                                        } catch (e: any) {
                                                            alert('Error al separar cuenta: ' + (e.response?.data?.error || e.message || e));
                                                        }
                                                    }}
                                                    className="flex-[2] py-2.5 bg-purple-650 hover:bg-purple-700 border-none text-white rounded-lg font-semibold text-xs cursor-pointer transition-colors"
                                                >
                                                    ✂️ Separar y Cobrar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Croquis */}
            <div className="flex-1">
                <TableCroquis tables={tables} onSelectTable={handleTableSelect} isEmbedded={true} />
            </div>
        </div>
    );
};

export default PanelRestaurant;
