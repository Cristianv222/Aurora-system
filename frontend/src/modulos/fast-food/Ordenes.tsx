import React, { useState, useEffect, KeyboardEvent } from 'react';
import api from '../../services/api';
import printerService from '../../services/printerService';

const ORDERS_PER_PAGE = 10;

interface OrderItem {
    id?: string;
    product_details?: { name: string };
    product_name?: string;
    quantity: number;
    unit_price: string | number;
    line_total?: string | number;
    subtotal?: string | number;
    notes?: string;
}

interface Order {
    id: string;
    order_number: string;
    customer_name?: string;
    order_type?: string;
    order_type_display?: string;
    status?: string;
    status_display?: string;
    total: string | number;
    subtotal?: string | number;
    tax_amount?: number;
    discount_amount?: number;
    table_number?: string;
    notes?: string;
    created_at: string;
    items?: OrderItem[];
    loading?: boolean;
}

const Ordenes: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/api/orders/orders/', { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
                setOrders(response.data.results || response.data || []);
            } catch (err) {
                console.error('Error fetching orders:', err);
                setError('Error al cargar las órdenes');
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    useEffect(() => {
        const handleEscape = (e: Event) => {
            if ((e as unknown as KeyboardEvent).key === 'Escape' && showModal) closeModal();
        };
        if (showModal) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [showModal]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

    const isOrderCompleted = (order: Order) =>
        ['completado', 'completed'].includes(order.status_display?.toLowerCase() || '') ||
        ['completed'].includes(order.status?.toLowerCase() || '');

    const handleStatusChange = async (orderNumber: string, newStatus: string, e: React.MouseEvent | React.ChangeEvent) => {
        e.stopPropagation();
        setUpdatingStatus(prev => ({ ...prev, [orderNumber]: true }));
        try {
            const response = await api.post(
                `/api/orders/orders/${orderNumber}/update_status/`,
                { status: newStatus },
                { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE }
            );
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_number === orderNumber ? { ...order, ...response.data } : order
                )
            );
        } catch (err: any) {
            alert(`Error al actualizar el estado: ${err.response?.data?.detail || err.message}`);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [orderNumber]: false }));
        }
    };

    const handleRowClick = async (order: Order) => {
        setShowModal(true);
        setSelectedOrder({ ...order, loading: true });
        try {
            const response = await api.get(`/api/orders/orders/${order.order_number}/`, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            const orderData = response.data;
            setSelectedOrder({ ...orderData, customer_name: orderData.customer_name || order.customer_name });
        } catch {
            alert('Error al cargar los detalles de la orden');
            setShowModal(false);
            setSelectedOrder(null);
        }
    };

    const closeModal = () => { setShowModal(false); setSelectedOrder(null); };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;
        if (!window.confirm(`¿Eliminar la Orden ${selectedOrder.order_number}? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/api/orders/orders/${selectedOrder.order_number}/`, { baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE });
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            alert('Orden eliminada exitosamente');
            closeModal();
        } catch {
            alert('Error al eliminar la orden');
        }
    };

    const handlePrintTicket = async () => {
        if (!selectedOrder) return;
        try {
            const receiptData = {
                order_number: selectedOrder.order_number,
                customer_name: selectedOrder.customer_name || 'CONSUMIDOR FINAL',
                table_number: selectedOrder.table_number || (selectedOrder.order_type === 'takeout' ? 'PARA LLEVAR' : 'MESA GENÉRICA'),
                items: (selectedOrder.items || []).map(item => ({
                    name: item.product_details?.name || item.product_name || 'Producto',
                    quantity: item.quantity,
                    price: parseFloat(String(item.unit_price)),
                    total: parseFloat(String(item.line_total || item.subtotal)),
                    note: item.notes || ''
                })),
                subtotal: parseFloat(String(selectedOrder.subtotal)),
                discount: parseFloat(String(selectedOrder.discount_amount || 0)),
                tax: parseFloat(String(selectedOrder.tax_amount || 0)),
                total: parseFloat(String(selectedOrder.total))
            };
            await printerService.printReceipt(receiptData);
            alert('Ticket enviado a la impresora');
        } catch {
            alert('Error al imprimir el ticket. Verifique la conexión con el agente de impresión.');
        }
    };

    const getStatusKey = (statusDisplay?: string) => {
        const map: Record<string, string> = { 'Pendiente': 'pending', 'Completado': 'completed' };
        return map[statusDisplay || ''] || statusDisplay?.toLowerCase() || '';
    };

    const sortedFiltered = orders
        .filter(order => {
            const matchSearch =
                order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchFilter =
                filterStatus === 'all' ||
                (filterStatus === 'pending' && !isOrderCompleted(order)) ||
                (filterStatus === 'completed' && isOrderCompleted(order));
            return matchSearch && matchFilter;
        })
        .sort((a, b) => {
            const aC = isOrderCompleted(a), bC = isOrderCompleted(b);
            if (aC !== bC) return aC ? 1 : -1;
            if (!aC) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    const totalPages = Math.ceil(sortedFiltered.length / ORDERS_PER_PAGE);
    const paginatedOrders = sortedFiltered.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);
    const pendingCount = orders.filter(o => !isOrderCompleted(o)).length;
    const completedCount = orders.filter(o => isOrderCompleted(o)).length;
    const totalRevenue = orders.filter(o => isOrderCompleted(o)).reduce((sum, o) => sum + parseFloat(String(o.total || 0)), 0);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mr-3"></div>
            <span className="text-slate-500 text-sm font-medium">Cargando órdenes...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl max-w-sm">
                <p className="text-red-700 font-semibold">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Gestión de Órdenes</h1>
                <p className="text-sm text-slate-500 mt-1">Visualiza y administra todas las órdenes del sistema</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Órdenes', value: orders.length,                    color: 'border-l-slate-700',   text: 'text-slate-800' },
                    { label: 'Pendientes',    value: pendingCount,                     color: 'border-l-amber-400',   text: 'text-amber-700' },
                    { label: 'Completadas',   value: completedCount,                   color: 'border-l-emerald-500', text: 'text-emerald-700' },
                    { label: 'Ingresos',      value: `$${totalRevenue.toFixed(2)}`,    color: 'border-l-blue-500',    text: 'text-blue-700' },
                ].map(s => (
                    <div key={s.label} className={`bg-white border border-slate-200 ${s.color} border-l-4 rounded-xl p-4`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center shadow-sm">
                <div className="flex-1 min-w-[200px] relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Buscar por N° orden o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-slate-800 transition bg-slate-50"
                    />
                </div>
                {['all', 'pending', 'completed'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilterStatus(f)}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition ${filterStatus === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                <th className="px-6 py-3.5">N° Orden</th>
                                <th className="px-6 py-3.5">Cliente</th>
                                <th className="px-6 py-3.5">Tipo</th>
                                <th className="px-6 py-3.5 w-28">Total</th>
                                <th className="px-6 py-3.5 w-36">Estado</th>
                                <th className="px-6 py-3.5 w-44">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        {searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
                                    </td>
                                </tr>
                            ) : paginatedOrders.map(order => {
                                const completed = isOrderCompleted(order);
                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => handleRowClick(order)}
                                        className={`hover:bg-slate-50/50 transition cursor-pointer ${completed ? 'opacity-60' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-700">#{order.order_number}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{order.customer_name || 'Consumidor Final'}</td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">{order.order_type_display}</td>
                                        <td className="px-6 py-4 font-semibold text-emerald-700">${order.total}</td>
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <select
                                                value={getStatusKey(order.status_display) || order.status}
                                                onChange={(e) => handleStatusChange(order.order_number, e.target.value, e)}
                                                disabled={updatingStatus[order.order_number]}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border outline-none cursor-pointer ${
                                                    completed
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}
                                            >
                                                <option value="pending">Pendiente</option>
                                                <option value="completed">Completado</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-xs whitespace-nowrap">
                                            {new Date(order.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500 flex-wrap gap-2">
                        <span>Mostrando {Math.min((currentPage - 1) * ORDERS_PER_PAGE + 1, sortedFiltered.length)}–{Math.min(currentPage * ORDERS_PER_PAGE, sortedFiltered.length)} de {sortedFiltered.length} órdenes</span>
                        <div className="flex gap-1">
                            <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                .map((p, i, arr) => (
                                    <React.Fragment key={p}>
                                        {i > 0 && arr[i - 1] !== p - 1 && <span className="w-8 h-8 flex items-center justify-center text-slate-400">…</span>}
                                        <button
                                            className={`w-8 h-8 rounded-lg border flex items-center justify-center font-semibold ${currentPage === p ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:bg-slate-50'}`}
                                            onClick={() => setCurrentPage(p)}
                                        >{p}</button>
                                    </React.Fragment>
                                ))}
                            <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                        </div>
                    </div>
                )}
                {totalPages <= 1 && sortedFiltered.length > 0 && (
                    <div className="px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500">{sortedFiltered.length} órdenes en total</div>
                )}
            </div>

            {/* Detail Modal */}
            {showModal && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={closeModal}>
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Orden #{selectedOrder.order_number}</h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {selectedOrder.created_at && new Date(selectedOrder.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handlePrintTicket} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                        Imprimir
                                    </button>
                                    <button onClick={closeModal} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition">×</button>
                                </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {(selectedOrder.customer_name || 'C')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cliente</p>
                                    <p className="font-semibold text-slate-800">{selectedOrder.customer_name || 'Consumidor Final'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Info */}
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Información</p>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Tipo de orden</span>
                                        <span className="font-semibold text-slate-800">{selectedOrder.order_type_display}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Estado</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isOrderCompleted(selectedOrder) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                            {selectedOrder.status_display}
                                        </span>
                                    </div>
                                    {selectedOrder.table_number && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Mesa</span>
                                            <span className="font-semibold text-slate-800">{selectedOrder.table_number}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Productos */}
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Productos</p>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    {selectedOrder.loading ? (
                                        <div className="p-8 text-center text-slate-400 text-sm">Cargando productos...</div>
                                    ) : (selectedOrder.items?.length ?? 0) > 0 ? selectedOrder.items!.map((item, idx) => (
                                        <div key={idx} className={`flex justify-between items-start p-4 ${idx < selectedOrder.items!.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-sm">{item.product_details?.name || item.product_name || 'Producto'}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{item.quantity} × ${item.unit_price}</p>
                                                {item.notes && <span className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block">📝 {item.notes}</span>}
                                            </div>
                                            <span className="font-bold text-emerald-700 text-sm">${item.line_total || item.subtotal}</span>
                                        </div>
                                    )) : (
                                        <div className="p-6 text-center text-slate-400 text-sm">No hay productos en esta orden</div>
                                    )}
                                </div>
                            </div>

                            {/* Resumen */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="text-slate-700 font-medium">${selectedOrder.subtotal}</span></div>
                                {(selectedOrder.tax_amount || 0) > 0 && <div className="flex justify-between text-slate-500"><span>Impuestos</span><span className="text-slate-700 font-medium">${selectedOrder.tax_amount}</span></div>}
                                {(selectedOrder.discount_amount || 0) > 0 && <div className="flex justify-between text-slate-500"><span>Descuento</span><span className="text-red-600 font-medium">-${selectedOrder.discount_amount}</span></div>}
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-800 text-base">Total</span>
                                    <span className="font-bold text-emerald-700 text-lg">${selectedOrder.total}</span>
                                </div>
                            </div>

                            {selectedOrder.notes && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <p className="text-xs font-bold text-amber-700 uppercase mb-1">Notas</p>
                                    <p className="text-sm text-amber-800">{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 flex justify-between gap-2">
                            <button onClick={handleDeleteOrder} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-red-200 transition">
                                Eliminar Orden
                            </button>
                            <button onClick={closeModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Ordenes;
