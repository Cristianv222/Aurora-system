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
    const [lastChangeGiven, setLastChangeGiven] = useState<number | null>(null);
    const [lastCashReceived, setLastCashReceived] = useState<number | null>(null);

    const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);

    // Estado independiente para el widget de pagos en "Separar Cuenta"
    const [splitPaymentSplits, setSplitPaymentSplits] = useState<PaymentSplit[]>([]);
    const [splitInputCash, setSplitInputCash] = useState<string>('');
    const [splitCashGiven, setSplitCashGiven] = useState<number | null>(null);
    const [lastSplitChangeGiven, setLastSplitChangeGiven] = useState<number | null>(null);
    const [lastSplitCashReceived, setLastSplitCashReceived] = useState<number | null>(null);
    const [splitPaymentMethod, setSplitPaymentMethod] = useState<string>('');
    const [splitCurrency, setSplitCurrency] = useState<string>('USD');
    const [isDrawerExpanded, setIsDrawerExpanded] = useState<boolean>(false);

    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 600);
    const [isCompact, setIsCompact] = useState<boolean>(window.innerWidth > 600 && window.innerWidth <= 1024);

    const [dragY, setDragY] = useState<number>(0);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const startTouchY = useRef<number>(0);
    const currentTranslateY = useRef<number>(0);
    const drawerHeight = useRef<number>(0);
    const drawerRef = useRef<HTMLDivElement | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const rect = drawerRef.current?.getBoundingClientRect();
        const height = rect ? rect.height : window.innerHeight * 0.8;
        drawerHeight.current = height;
        startTouchY.current = e.touches[0].clientY;
        currentTranslateY.current = isDrawerExpanded ? 0 : height - 76;
        setDragY(currentTranslateY.current);
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const deltaY = e.touches[0].clientY - startTouchY.current;
        let newY = currentTranslateY.current + deltaY;
        const maxLimit = drawerHeight.current - 76;
        newY = Math.max(0, Math.min(newY, maxLimit));
        setDragY(newY);
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        const threshold = drawerHeight.current * 0.25;
        const collapsedPos = drawerHeight.current - 76;
        
        if (isDrawerExpanded) {
            if (dragY > threshold) {
                setIsDrawerExpanded(false);
            }
        } else {
            if (dragY < collapsedPos - threshold) {
                setIsDrawerExpanded(true);
            }
        }
    };

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
        setLastChangeGiven(null);
        setLastCashReceived(null);
        setPaymentSplits([]);
        setSplitPaymentSplits([]);
        setSplitInputCash('');
        setSplitCashGiven(null);
        setLastSplitChangeGiven(null);
        setLastSplitCashReceived(null);
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
            const unpaidItemsTotal = (o.items || [])
                .filter((i: any) => !i.is_paid)
                .reduce((acc: number, i: any) => acc + parseFloat(i.line_total || (parseFloat(i.unit_price || 0) * (i.quantity || 1))), 0);
            return sum + unpaidItemsTotal;
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

    const renderPaymentForm = () => {
        const totalToPay = calculateTotalToPay();
        const alreadyPaidUSD = paymentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0);
        const saldoPendienteUSD = Math.max(0, totalToPay - alreadyPaidUSD);

        const rate = selectedCurrency === 'COP' ? parseFloat(exchangeRate || '4000') : 1;
        const saldoPendienteCur = selectedCurrency === 'COP' ? saldoPendienteUSD * rate : saldoPendienteUSD;

        const cashEntered = cashGiven || 0;
        const cashEnteredUSD = selectedCurrency === 'COP' ? cashEntered / rate : cashEntered;

        return (
            <>
                {/* SECCIÓN: REGISTRO DE PAGO Y CAMBIO */}
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="m-0 mb-3 text-slate-800 text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-2 flex items-center gap-2">
                        <i className="bi bi-wallet2 text-indigo-600 text-base"></i> Registrar Pago y Cambio
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Método de Pago</label>
                            <select
                                value={selectedPaymentMethod}
                                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold outline-none focus:border-indigo-500"
                            >
                                {paymentMethods.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Moneda</label>
                            <select
                                value={selectedCurrency}
                                onChange={(e) => setSelectedCurrency(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-semibold outline-none focus:border-indigo-500"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="COP">COP ($)</option>
                            </select>
                        </div>
                    </div>

                    {/* INGRESO MANUAL DE DINERO RECIBIDO EN FÍSICO */}
                    <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] uppercase font-bold text-slate-600">
                                Dinero Recibido en Físico ({selectedCurrency})
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const exact = selectedCurrency === 'COP'
                                        ? Math.round(saldoPendienteUSD * rate)
                                        : Math.round(saldoPendienteUSD * 100) / 100;
                                    setCashGiven(exact);
                                    setInputCash(exact.toString());
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                                Monto Exacto ({formatCurrency(saldoPendienteUSD, 'USD')})
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">
                                    $
                                </span>
                                <input
                                    type="number"
                                    step="any"
                                    value={inputCash}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setInputCash(val);
                                        setCashGiven(val ? parseFloat(val) : null);
                                    }}
                                    placeholder={selectedCurrency === 'COP' ? "Ej: 20000" : "Ej: 20.00"}
                                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-lg font-black outline-none focus:border-indigo-600 shadow-inner"
                                />
                            </div>
                            {inputCash && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInputCash('');
                                        setCashGiven(null);
                                    }}
                                    className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                                    title="Limpiar"
                                >
                                    ✕
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (!cashGiven || cashGiven <= 0) return alert('Por favor ingresa un monto válido recibido en físico');

                                    const appliedUSD = Math.min(cashEnteredUSD, saldoPendienteUSD);
                                    let changeForMethod = 0;
                                    if (cashEnteredUSD > saldoPendienteUSD) {
                                        changeForMethod = selectedCurrency === 'COP'
                                            ? cashGiven - (appliedUSD * rate)
                                            : cashGiven - appliedUSD;
                                    }

                                    const methodObj = paymentMethods.find(m => String(m.id) === selectedPaymentMethod);

                                    setPaymentSplits([...paymentSplits, {
                                        payment_method_id: selectedPaymentMethod,
                                        method_name: methodObj ? methodObj.name : 'Efectivo',
                                        amount_applied: appliedUSD,
                                        amount_received: cashGiven,
                                        currency_code: selectedCurrency,
                                        change_amount: changeForMethod
                                    }]);

                                    setLastChangeGiven(changeForMethod);
                                    setLastCashReceived(cashGiven);
                                    setCashGiven(null);
                                    setInputCash('');
                                }}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                                <i className="bi bi-plus-lg"></i> Añadir
                            </button>
                        </div>
                    </div>

                    {/* TARJETA DE CAMBIO EN VIVO / VUELTO (VISIBILIDAD MÁXIMA) */}
                    {cashGiven !== null && cashGiven > 0 ? (
                        <div className={`p-4 rounded-xl border transition-all animate-fade-in ${
                            cashGiven >= saldoPendienteCur - 0.01
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm'
                                : 'bg-amber-50 border-amber-300 text-amber-950 shadow-sm'
                        }`}>
                            <div className="grid grid-cols-2 gap-2 text-xs border-b border-black/10 pb-2 mb-2">
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Monto A Cobrar:</span>
                                    <span className="font-extrabold text-sm text-slate-800">
                                        {formatCurrency(saldoPendienteCur, selectedCurrency)}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Dinero Recibido:</span>
                                    <span className="font-extrabold text-sm text-indigo-700">
                                        {formatCurrency(cashGiven, selectedCurrency)}
                                    </span>
                                </div>
                            </div>

                            {cashGiven >= saldoPendienteCur - 0.01 ? (
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                        <i className="bi bi-cash-stack text-lg text-emerald-600"></i> CAMBIO / VUELTO:
                                    </span>
                                    <span className="text-2xl font-black text-emerald-600 tracking-tight">
                                        {formatCurrency(cashGiven - saldoPendienteCur, selectedCurrency)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-xs uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                        <i className="bi bi-exclamation-triangle-fill text-amber-600"></i> FALTA POR CUBRIR:
                                    </span>
                                    <span className="text-xl font-black text-amber-600 tracking-tight">
                                        {formatCurrency(saldoPendienteCur - cashGiven, selectedCurrency)}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : lastChangeGiven !== null && lastChangeGiven > 0 ? (
                        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex justify-between items-center text-emerald-900 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <i className="bi bi-check-circle-fill text-emerald-600 text-xl"></i>
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">Último Cambio Entregado</span>
                                    <span className="text-xs font-semibold text-slate-600">De pago recibido de {formatCurrency(lastCashReceived || 0, selectedCurrency)}</span>
                                </div>
                            </div>
                            <span className="text-xl font-black text-emerald-600">
                                {formatCurrency(lastChangeGiven, selectedCurrency)}
                            </span>
                        </div>
                    ) : null}
                </div>

                {/* RESUMEN DE PAGOS REGISTRADOS */}
                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <h4 className="m-0 mb-2 text-slate-500 text-xs font-semibold">Pagos Registrados</h4>
                    {paymentSplits.length === 0 ? (
                        <div className="text-slate-400 text-xs italic">Sin pagos añadidos aún...</div>
                    ) : (
                        <div className="space-y-2">
                            {paymentSplits.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center border-b border-slate-200 border-dashed pb-2 text-xs">
                                    <div>
                                        <span className="text-slate-800 font-bold">{p.method_name} ({p.currency_code})</span>
                                        {p.amount_received && p.amount_received > p.amount_applied && (
                                            <div className="text-[10px] text-slate-500">
                                                Recibido: {formatCurrency(p.amount_received, p.currency_code)} &nbsp;➔&nbsp;
                                                <strong className="text-emerald-700">Vuelto: {formatCurrency(p.change_amount || 0, p.currency_code)}</strong>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-emerald-600 font-bold">+{formatCurrency(p.amount_applied, 'USD')}</span>
                                        <button
                                            onClick={() => setPaymentSplits(paymentSplits.filter((_, i) => i !== idx))}
                                            className="bg-transparent border-none text-rose-500 cursor-pointer text-base leading-none p-0"
                                        >
                                            <i className="bi bi-x-circle-fill hover:text-rose-600 transition-colors"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                        <span className="text-slate-700 font-bold text-xs">SALDO PENDIENTE:</span>
                        <span className={`font-bold text-sm ${saldoPendienteUSD <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(saldoPendienteUSD, 'USD')}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2 mb-3.5">
                    <button
                        onClick={() => {
                            setPartialAmount('');
                            setShowPartialPayment(true);
                        }}
                        className="flex-1 py-2.5 bg-[#1a2e4a] hover:bg-[#243b5e] border border-slate-350 rounded-xl text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-sm"
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
                        <i className="bi bi-scissors"></i> Separar Cta
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            const lastOrder = tableOrders[tableOrders.length - 1];
                            if (!lastOrder) return alert('No hay orden activa');

                            const totalToPay = calculateTotalToPay();
                            let currentSplits = [...paymentSplits];
                            const currentPaidNow = currentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0);
                            const pendingToCover = totalToPay - currentPaidNow;

                            if (pendingToCover > 0.01) {
                                let rawCash = cashGiven || 0;
                                let appliedUSD = 0;
                                let changeAmount = 0;

                                if (rawCash > 0) {
                                    const rawCashUSD = selectedCurrency === 'COP' ? rawCash / rate : rawCash;
                                    appliedUSD = Math.min(rawCashUSD, pendingToCover);
                                    if (selectedCurrency === 'COP') {
                                        changeAmount = Math.max(0, rawCash - (appliedUSD * rate));
                                    } else {
                                        changeAmount = Math.max(0, rawCash - appliedUSD);
                                    }
                                } else {
                                    appliedUSD = pendingToCover;
                                    rawCash = selectedCurrency === 'COP' ? pendingToCover * rate : pendingToCover;
                                    changeAmount = 0;
                                }

                                const methodObj = paymentMethods.find(m => String(m.id) === selectedPaymentMethod);
                                currentSplits.push({
                                    payment_method_id: selectedPaymentMethod,
                                    method_name: methodObj ? methodObj.name : 'Efectivo',
                                    amount_applied: appliedUSD,
                                    amount_received: rawCash,
                                    currency_code: selectedCurrency,
                                    change_amount: changeAmount
                                });
                            }

                            const finalTotalPaid = currentSplits.reduce((acc, curr) => acc + curr.amount_applied, 0);
                            if (totalToPay > 0.01 && finalTotalPaid < totalToPay - 0.01) {
                                return alert(`El pago total (${formatCurrency(finalTotalPaid, 'USD')}) no cubre la cuenta (${formatCurrency(totalToPay, 'USD')})`);
                            }

                            try {
                                await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/checkout/`, {
                                    payments_list: currentSplits
                                });

                                await printerServiceRestaurant.printReceipt({
                                    ...lastOrder,
                                    payments_list: currentSplits
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
                        className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        title="Imprimir Pre-Cuenta sin cobrar"
                    >
                        <i className="bi bi-printer text-slate-600"></i> Solo Imp.
                    </button>
                </div>
            </>
        );
    };

    return (
        <div className="h-[calc(100vh-60px)] relative bg-slate-100 overflow-hidden flex flex-col">
            {/* Ocultar scrollbar en navegadores Webkit */}
            <style>{`.nav-scroll::-webkit-scrollbar { display: none; }`}</style>

            {/* Legend (Semáforo) */}
            <div className="absolute top-5 right-5 z-10 bg-white/90 backdrop-blur border border-slate-200 rounded-xl p-2.5 flex flex-row sm:flex-col gap-2.5 shadow-lg text-slate-800 text-xs font-semibold">
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
                        background: rgba(255,255,255,0.98);
                        color: #1e293b;
                        padding: 5px 10px;
                        border-radius: 8px;
                        font-size: 0.78rem;
                        font-weight: 600;
                        white-space: nowrap;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.15s;
                        border: 1px solid rgba(0,0,0,0.1);
                        z-index: 999;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
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
                        className={`nav-icon-btn bg-white/90 hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
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
                        className={`nav-icon-btn bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[95vh] sm:h-auto sm:max-h-[92vh] transition-all">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#1a2e4a] to-[#243b5e] border-b border-[#1a2e4a]/10 p-4 px-5 flex justify-between items-center text-white shrink-0">
                            <div>
                                <div className="text-lg font-bold flex items-center gap-2">
                                    <i className="bi bi-grid-3x3-gap-fill text-slate-200"></i>
                                    <span>{String(selectedOrderModal.number).toLowerCase().startsWith('mesa') ? selectedOrderModal.number : `Mesa ${selectedOrderModal.number}`}</span>
                                </div>
                                <div className="text-xs opacity-80 mt-0.5">
                                    {tableOrders.length} orden{tableOrders.length !== 1 ? 'es' : ''} hoy
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                className="bg-transparent border-none text-indigo-100 hover:text-white text-xl cursor-pointer p-1 leading-none transition-colors"
                            >
                                <i className="bi bi-x-lg text-lg"></i>
                            </button>
                        </div>

                        {/* Body Container Split */}
                        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative bg-slate-50">
                            {/* Lado Izquierdo: Lista de Productos */}
                            <div className={`flex-1 overflow-y-auto flex flex-col border-r border-slate-200 ${isMobile ? 'pb-[85px]' : ''}`}>
                                {tableOrders.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">
                                        No hay órdenes registradas hoy para esta mesa.
                                    </div>
                                )}

                                {tableOrders.length > 0 && (
                                    <div className="grid grid-cols-[1fr_auto_auto] px-5 py-2 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                        <span>Producto</span>
                                        <span className="text-center pr-5">Cant.</span>
                                        <span className="text-right">Total</span>
                                    </div>
                                )}

                                {groupedItemsForModal.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`grid grid-cols-[1fr_auto_auto] items-center px-5 py-3 border-b border-slate-200/50 ${
                                            idx % 2 === 0 ? 'bg-transparent' : 'bg-white/40'
                                        } ${item.is_paid ? 'opacity-40' : 'opacity-100'}`}
                                    >
                                        <div>
                                            <div className={`font-semibold text-sm text-slate-800 ${item.is_paid ? 'line-through' : ''}`}>
                                                {item.name} {item.is_paid && (
                                                    <span className="ml-1 text-emerald-600 text-xs font-semibold">
                                                        <i className="bi bi-check-circle-fill"></i> COBRADO
                                                    </span>
                                                )}
                                            </div>
                                            {item.notes && (
                                                <div className="text-xs text-slate-500 italic mt-0.5">{item.notes}</div>
                                            )}
                                        </div>
                                        <span className="text-center pr-5 font-bold text-slate-500 text-sm">
                                            x{item.quantity}
                                        </span>
                                        <span className={`text-right font-bold text-emerald-600 text-sm ${item.is_paid ? 'line-through' : ''}`}>
                                            ${item.line_total.toFixed(2)}
                                        </span>
                                    </div>
                                ))}

                                <div className="flex gap-2.5 p-4 mt-auto">
                                    <button
                                        onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1`)}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-[#1a2e4a]/10 hover:bg-[#1a2e4a]/20 border border-[#1a2e4a]/20 rounded-xl cursor-pointer text-[#1a2e4a] font-semibold text-sm transition-colors"
                                    >
                                        <i className="bi bi-plus-lg text-lg"></i>
                                        <span>Añadir Productos</span>
                                    </button>

                                    <button
                                        onClick={() => navigate(`/restaurant/pos?table=${encodeURIComponent(selectedOrderModal.number)}&restaurantMode=1`)}
                                        className="flex-1 flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl cursor-pointer text-amber-600 font-semibold text-sm transition-colors"
                                    >
                                        <i className="bi bi-pencil-square text-amber-600"></i>
                                        <span>Editar / Ver Orden</span>
                                    </button>
                                </div>
                            </div>

                            {/* Lado Derecho: Pagos y Cobro (Sliding Drawer on Mobile, Sidebar on Desktop) */}
                            {isMobile ? (
                                <div
                                    ref={drawerRef}
                                    style={{
                                        transform: `translateY(${
                                            isDragging
                                                ? dragY
                                                : isDrawerExpanded
                                                ? 0
                                                : drawerHeight.current
                                                ? drawerHeight.current - 76
                                                : window.innerHeight * 0.85 - 76
                                        }px)`,
                                        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                    className="absolute inset-x-0 bottom-0 bg-white border-t border-slate-200 flex flex-col z-35 h-[85vh] rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
                                >
                                    {/* Drawer Clickable Header */}
                                    <div
                                        onTouchStart={handleTouchStart}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        onClick={() => {
                                            if (Math.abs(dragY - currentTranslateY.current) < 5) {
                                                setIsDrawerExpanded(!isDrawerExpanded);
                                            }
                                        }}
                                        className="h-[76px] flex flex-col justify-center items-center px-5 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 shrink-0 select-none bg-white rounded-t-2xl"
                                    >
                                        <div className="w-12 h-1 bg-slate-300 rounded-full mb-2" />
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                    {isDrawerExpanded ? 'Opciones de Pago' : 'Pago de la Mesa'}
                                                </span>
                                                <i className={`bi bi-chevron-${isDrawerExpanded ? 'down' : 'up'} text-xs text-slate-500`}></i>
                                            </div>
                                            {!isDrawerExpanded ? (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-black text-amber-600">
                                                        {formatCurrency(calculateTotalToPay(), 'USD')}
                                                    </span>
                                                    <span className="px-3.5 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg flex items-center gap-1">
                                                        <i className="bi bi-wallet2"></i> Cobrar
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
                                                    Ver Productos
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Drawer Content */}
                                    <div className="flex-1 overflow-y-auto p-5 pb-16 bg-white">
                                        {isDrawerExpanded && renderPaymentForm()}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-[420px] bg-white p-5 shrink-0 overflow-y-auto border-l border-slate-200 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm font-bold text-slate-500">Total Pendiente</span>
                                            <span className="text-2xl font-black text-amber-600">
                                                {formatCurrency(calculateTotalToPay(), 'USD')}
                                            </span>
                                        </div>
                                        {renderPaymentForm()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Sub-modal Pago Parcial */}
                    {showPartialPayment && (
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 w-full max-w-xs shadow-2xl">
                                <h4 className="text-slate-800 m-0 mb-2.5 font-bold flex items-center gap-2">
                                    <i className="bi bi-pie-chart-fill text-indigo-650"></i>
                                    <span>Pago Parcial</span>
                                </h4>
                                <div className="text-slate-500 text-xs mb-4">
                                    Ingresa el monto exacto a pagar en esta transacción.
                                </div>
                                <div className="relative mb-5">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-semibold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={partialAmount}
                                        onChange={(e) => setPartialAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xl font-bold outline-none focus:border-indigo-550"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => setShowPartialPayment(false)}
                                        className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
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
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg flex flex-col max-h-[95vh] overflow-hidden shadow-2xl">
                                {/* Header */}
                                <div className="p-4 px-5 border-b border-slate-200">
                                    <h4 className="text-slate-800 m-0 font-bold flex items-center gap-2">
                                        <i className="bi bi-scissors text-slate-500"></i>
                                        <span>Separar Cuenta</span>
                                    </h4>
                                    <div className="text-slate-500 text-xs mt-1">
                                        Selecciona los productos a cobrar en esta separación.
                                    </div>
                                </div>

                                {/* Lista de productos */}
                                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-slate-50/50">
                                    {groupedItemsForSplit.map(item => {
                                        if (!item.product_id) return null;
                                        const totalQty = item.quantity;
                                        const selQty = splitItemsSelection[item.product_id] || 0;

                                        return (
                                            <div key={item.product_id} className="flex items-center justify-between p-3.5 px-5">
                                                <div>
                                                    <div className="text-slate-800 font-semibold text-sm">{item.name}</div>
                                                    <div className="text-slate-500 text-xs mt-0.5">
                                                        Disp: {totalQty} &nbsp;·&nbsp;
                                                        <span className="text-emerald-600">${((item.line_total || 0) / (item.quantity || 1)).toFixed(2)} c/u</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 bg-white p-1 rounded-lg border border-slate-200">
                                                    <button
                                                        onClick={() => setSplitItemsSelection(p => ({ ...p, [item.product_id!]: Math.max(0, selQty - 1) }))}
                                                        className="w-7 h-7 border-none rounded bg-[#1a2e4a] hover:bg-[#243b5e] text-white font-bold cursor-pointer transition-colors"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-slate-800 font-bold w-5 text-center text-sm">{selQty}</span>
                                                    <button
                                                        onClick={() => setSplitItemsSelection(p => ({ ...p, [item.product_id!]: Math.min(totalQty, selQty + 1) }))}
                                                        className="w-7 h-7 border-none rounded bg-purple-600 hover:bg-purple-750 text-white font-bold cursor-pointer transition-colors"
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

                                    const splitRate = splitCurrency === 'COP' ? parseFloat(exchangeRate || '4000') : 1;
                                    const splitPendingCur = splitCurrency === 'COP' ? splitPending * splitRate : splitPending;

                                    const splitCashEntered = splitCashGiven || 0;
                                    const splitCashEnteredUSD = splitCurrency === 'COP' ? splitCashEntered / splitRate : splitCashEntered;

                                    return (
                                        <div className="p-4 px-5 border-t border-slate-200 bg-white">
                                            <div className="flex justify-between mb-3 text-xs">
                                                <span className="text-slate-500 font-bold">Subtotal Selección:</span>
                                                <span className="text-amber-600 font-extrabold text-sm">{formatCurrency(splitTotal, 'USD')}</span>
                                            </div>

                                            {/* Widget de pagos múltiples dentro de Separar Cuenta */}
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
                                                <h4 className="m-0 mb-3 text-slate-800 text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                                                    <i className="bi bi-wallet2 text-purple-600 text-base"></i> Forma de Pago (Separación)
                                                </h4>

                                                {/* Método + Moneda */}
                                                <div className="grid grid-cols-2 gap-2.5 mb-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Método</label>
                                                        <select
                                                            value={splitPaymentMethod}
                                                            onChange={(e) => setSplitPaymentMethod(e.target.value)}
                                                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs outline-none focus:border-purple-500"
                                                        >
                                                            {paymentMethods.map(m => (
                                                                <option key={m.id} value={m.id}>{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Moneda</label>
                                                        <select
                                                            value={splitCurrency}
                                                            onChange={(e) => setSplitCurrency(e.target.value)}
                                                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs outline-none focus:border-purple-500"
                                                        >
                                                            <option value="USD">USD ($)</option>
                                                            <option value="COP">COP ($)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* INGRESO DE MONTO EN FÍSICO */}
                                                <div className="mb-3">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="block text-[10px] uppercase font-bold text-slate-600">
                                                            Dinero Recibido en Físico ({splitCurrency})
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const exact = splitCurrency === 'COP'
                                                                    ? Math.round(splitPending * splitRate)
                                                                    : Math.round(splitPending * 100) / 100;
                                                                setSplitCashGiven(exact);
                                                                setSplitInputCash(exact.toString());
                                                            }}
                                                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                                        >
                                                            Monto Exacto ({formatCurrency(splitPending, 'USD')})
                                                        </button>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">$</span>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={splitInputCash}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setSplitInputCash(val);
                                                                    setSplitCashGiven(val ? parseFloat(val) : null);
                                                                }}
                                                                placeholder={splitCurrency === 'COP' ? "Ej: 20000" : "Ej: 20.00"}
                                                                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-black outline-none focus:border-purple-600 shadow-inner"
                                                            />
                                                        </div>
                                                        {splitInputCash && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSplitInputCash('');
                                                                    setSplitCashGiven(null);
                                                                }}
                                                                className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                                                                title="Limpiar"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                if (!splitCashGiven || splitCashGiven <= 0) return alert('Por favor ingresa un monto válido recibido en físico');

                                                                const appliedUSD = Math.min(splitCashEnteredUSD, splitPending);
                                                                let changeForMethod = 0;
                                                                if (splitCashEnteredUSD > splitPending) {
                                                                    changeForMethod = splitCurrency === 'COP'
                                                                        ? splitCashGiven - (appliedUSD * splitRate)
                                                                        : splitCashGiven - appliedUSD;
                                                                }

                                                                const methodObj = paymentMethods.find(m => String(m.id) === splitPaymentMethod);
                                                                setSplitPaymentSplits([...splitPaymentSplits, {
                                                                    payment_method_id: splitPaymentMethod,
                                                                    method_name: methodObj ? methodObj.name : 'Efectivo',
                                                                    amount_applied: appliedUSD,
                                                                    amount_received: splitCashGiven,
                                                                    currency_code: splitCurrency,
                                                                    change_amount: changeForMethod
                                                                }]);

                                                                setLastSplitChangeGiven(changeForMethod);
                                                                setLastSplitCashReceived(splitCashGiven);
                                                                setSplitInputCash('');
                                                                setSplitCashGiven(null);
                                                            }}
                                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 border-none text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                                                        >
                                                            <i className="bi bi-plus-lg"></i> Añadir
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* TARJETA DE CAMBIO EN VIVO EN SEPARACIÓN DE CUENTA */}
                                                {splitCashGiven !== null && splitCashGiven > 0 ? (
                                                    <div className={`p-3.5 rounded-xl border text-xs mb-3 animate-fade-in ${
                                                        splitCashGiven >= splitPendingCur - 0.01
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                                            : 'bg-amber-50 border-amber-300 text-amber-950'
                                                    }`}>
                                                        <div className="grid grid-cols-2 gap-2 border-b border-black/10 pb-1.5 mb-1.5">
                                                            <div>
                                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Subtotal A Cobrar:</span>
                                                                <span className="font-extrabold text-xs text-slate-800">
                                                                    {formatCurrency(splitPendingCur, splitCurrency)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Dinero Recibido:</span>
                                                                <span className="font-extrabold text-xs text-purple-700">
                                                                    {formatCurrency(splitCashGiven, splitCurrency)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {splitCashGiven >= splitPendingCur - 0.01 ? (
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-extrabold text-[11px] uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                                                    <i className="bi bi-cash-stack text-base text-emerald-600"></i> CAMBIO / VUELTO:
                                                                </span>
                                                                <span className="text-xl font-black text-emerald-600">
                                                                    {formatCurrency(splitCashGiven - splitPendingCur, splitCurrency)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-extrabold text-[11px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
                                                                    <i className="bi bi-exclamation-triangle-fill text-amber-600"></i> FALTA POR CUBRIR:
                                                                </span>
                                                                <span className="text-lg font-black text-amber-600">
                                                                    {formatCurrency(splitPendingCur - splitCashGiven, splitCurrency)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : lastSplitChangeGiven !== null && lastSplitChangeGiven > 0 ? (
                                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex justify-between items-center text-emerald-900 mb-3 animate-fade-in text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <i className="bi bi-check-circle-fill text-emerald-600 text-lg"></i>
                                                            <span className="font-bold text-[10px] uppercase text-emerald-800">Último Cambio:</span>
                                                        </div>
                                                        <span className="text-lg font-black text-emerald-600">
                                                            {formatCurrency(lastSplitChangeGiven, splitCurrency)}
                                                        </span>
                                                    </div>
                                                ) : null}

                                                {/* Lista de pagos añadidos */}
                                                {splitPaymentSplits.length > 0 && (
                                                    <div className="space-y-1.5 mb-2">
                                                        {splitPaymentSplits.map((p, idx) => (
                                                            <div key={idx} className="flex justify-between items-center border-b border-slate-200 border-dashed pb-1.5 text-[11px]">
                                                                <div>
                                                                    <span className="text-slate-800 font-bold">{p.method_name} ({p.currency_code})</span>
                                                                    {p.amount_received && p.amount_received > p.amount_applied && (
                                                                        <div className="text-[9px] text-slate-500">
                                                                            Recibido: {formatCurrency(p.amount_received, p.currency_code)} &nbsp;➔&nbsp;
                                                                            <strong className="text-emerald-700">Vuelto: {formatCurrency(p.change_amount || 0, p.currency_code)}</strong>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-2 items-center">
                                                                    <span className="text-emerald-600 font-bold">+{formatCurrency(p.amount_applied, 'USD')}</span>
                                                                    <button
                                                                        onClick={() => setSplitPaymentSplits(splitPaymentSplits.filter((_, i) => i !== idx))}
                                                                        className="bg-transparent border-none text-rose-500 cursor-pointer text-base leading-none p-0"
                                                                    >
                                                                        <i className="bi bi-x-circle-fill hover:text-rose-600 transition-colors"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Saldo pendiente de esta separación */}
                                                <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-slate-200">
                                                    <span className="text-slate-700 font-bold text-xs">SALDO PENDIENTE:</span>
                                                    <span className={`font-bold text-sm ${splitPending <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                                                        setLastSplitChangeGiven(null);
                                                        setLastSplitCashReceived(null);
                                                        setSplitItemsSelection({});
                                                    }}
                                                    className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const itemsToSplit = Object.entries(splitItemsSelection)
                                                            .filter(([_, qty]) => qty > 0)
                                                            .map(([prodId, qty]) => ({ product_id: prodId, quantity: qty }));

                                                        if (itemsToSplit.length === 0) return alert('Debes seleccionar al menos un producto para cobrar');

                                                        let currentSplits = [...splitPaymentSplits];
                                                        const splitPaidNow = currentSplits.reduce((a, b) => a + b.amount_applied, 0);
                                                        const pendingSplitToCover = splitTotal - splitPaidNow;

                                                        if (pendingSplitToCover > 0.01) {
                                                            let rawCash = splitCashGiven || 0;
                                                            let appliedUSD = 0;
                                                            let changeAmount = 0;

                                                            if (rawCash > 0) {
                                                                const rawCashUSD = splitCurrency === 'COP' ? rawCash / splitRate : rawCash;
                                                                appliedUSD = Math.min(rawCashUSD, pendingSplitToCover);
                                                                if (splitCurrency === 'COP') {
                                                                    changeAmount = Math.max(0, rawCash - (appliedUSD * splitRate));
                                                                } else {
                                                                    changeAmount = Math.max(0, rawCash - appliedUSD);
                                                                }
                                                            } else {
                                                                appliedUSD = pendingSplitToCover;
                                                                rawCash = splitCurrency === 'COP' ? pendingSplitToCover * splitRate : pendingSplitToCover;
                                                                changeAmount = 0;
                                                            }

                                                            const methodObj = paymentMethods.find(m => String(m.id) === splitPaymentMethod);
                                                            currentSplits.push({
                                                                payment_method_id: splitPaymentMethod,
                                                                method_name: methodObj ? methodObj.name : 'Efectivo',
                                                                amount_applied: appliedUSD,
                                                                amount_received: rawCash,
                                                                currency_code: splitCurrency,
                                                                change_amount: changeAmount
                                                            });
                                                        }

                                                        const finalPaidTotal = currentSplits.reduce((a, b) => a + b.amount_applied, 0);
                                                        if (splitTotal > 0.01 && finalPaidTotal < splitTotal - 0.01) {
                                                            return alert(`El pago (${formatCurrency(finalPaidTotal, 'USD')}) no cubre el subtotal (${formatCurrency(splitTotal, 'USD')}). Añade más pagos.`);
                                                        }

                                                        try {
                                                            const lastOrder = tableOrders[tableOrders.length - 1];
                                                            const res = await api.post(`/api/restaurant/orders/orders/${lastOrder.order_number || lastOrder.id}/split_checkout/`, {
                                                                items: itemsToSplit,
                                                                payments_list: currentSplits,
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
                                                            setLastSplitChangeGiven(null);
                                                            setLastSplitCashReceived(null);
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
                                                    className="flex-[2] py-2.5 bg-purple-600 hover:bg-purple-700 border-none text-white rounded-lg font-semibold text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <i className="bi bi-scissors"></i> Separar y Cobrar
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
