import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import printerService from '../../services/printerService';
const Ordenes = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showModal, setShowModal] = useState(false);



    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/api/orders/orders/', {
                    baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
                });
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
        const handleEscape = (e) => {
            if (e.key === 'Escape' && showModal) {
                closeModal();
            }
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

    const handleStatusChange = async (orderNumber, newStatus, event) => {
        event.stopPropagation();
        setUpdatingStatus(prev => ({ ...prev, [orderNumber]: true }));
        try {
            const response = await api.post(
                `/api/orders/orders/${orderNumber}/update_status/`,
                { status: newStatus },
                { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }
            );

            console.log('Status update successful:', response.data);

            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_number === orderNumber
                        ? { ...order, ...response.data }
                        : order
                )
            );
        } catch (err) {
            console.error('Error updating status:', err);
            console.error('Error details:', err.response?.data);
            alert(`Error al actualizar el estado: ${err.response?.data?.detail || err.message}`);
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [orderNumber]: false }));
        }
    };

    const handleRowClick = async (order) => {
        setShowModal(true);
        // Usamos los datos que ya tenemos del listado
        setSelectedOrder({ ...order, loading: true });

        try {
            const response = await api.get(
                `/api/orders/orders/${order.order_number}/`,
                { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }
            );
            // Preservamos el customer_name del listado por si la respuesta no lo incluye

            const orderData = response.data;
            setSelectedOrder({
                ...orderData,
                customer_name: orderData.customer_name || order.customer_name
            });
        } catch (err) {
            console.error('Error fetching order details:', err);
            alert('Error al cargar los detalles de la orden');
            setShowModal(false);
            setSelectedOrder(null);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedOrder(null);
    };

    const handleDeleteOrder = async () => {
        if (!selectedOrder) return;

        if (!window.confirm(`¿Estás seguro de que quieres eliminar la Orden ${selectedOrder.order_number}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await api.delete(`/api/orders/orders/${selectedOrder.order_number}/`, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            // Eliminar del estado local
            setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
            alert('Orden eliminada exitosamente');
            closeModal();
        } catch (err) {
            console.error('Error deleting order:', err);
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
                items: selectedOrder.items.map(item => ({
                    name: item.product_details?.name || item.product_name || 'Producto',
                    quantity: item.quantity,
                    price: parseFloat(item.unit_price),
                    total: parseFloat(item.line_total || item.subtotal),
                    note: item.notes || ''
                })),
                subtotal: parseFloat(selectedOrder.subtotal),
                discount: parseFloat(selectedOrder.discount_amount || 0),
                tax: parseFloat(selectedOrder.tax_amount || 0),
                total: parseFloat(selectedOrder.total)
            };

            await printerService.printReceipt(receiptData);
            alert('Ticket enviado a la impresora');
        } catch (error) {
            console.error('Error printing ticket:', error);
            alert('Error al imprimir el ticket. Verifique la conexión con el agente de impresión.');
        }
    };




    const getStatusDisplay = (status) => {
        const statusMap = {
            'pending': 'Pendiente',
            'completed': 'Completado'
        };
        return statusMap[status] || status;
    };

    const getStatusColor = (status) => {
        const statusColors = {
            'completado': 'bg-green-100 text-green-700 border-green-200',
            'completed': 'bg-green-100 text-green-700 border-green-200',
            'pendiente': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'pending': 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
        return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const getStatusKey = (statusDisplay) => {
        const reverseMap = {
            'Pendiente': 'pending',
            'Completado': 'completed'
        };
        return reverseMap[statusDisplay] || statusDisplay.toLowerCase();
    };

    const sortedAndFilteredOrders = orders
        .filter(order =>
            order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            const aCompleted = ['completado', 'completed'].includes(a.status_display?.toLowerCase()) ||
                ['completed'].includes(a.status?.toLowerCase());
            const bCompleted = ['completado', 'completed'].includes(b.status_display?.toLowerCase()) ||
                ['completed'].includes(b.status?.toLowerCase());

            if (aCompleted !== bCompleted) {
                return aCompleted ? 1 : -1;
            }

            if (!aCompleted) {
                return new Date(a.created_at) - new Date(b.created_at);
            } else {
                return new Date(b.created_at) - new Date(a.created_at);
            }
        });

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-block',
                        width: '48px',
                        height: '48px',
                        border: '4px solid #e5e7eb',
                        borderTopColor: '#2563eb',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ marginTop: '16px', color: '#4b5563', fontWeight: '500' }}>Cargando órdenes...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
                <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '448px' }}>
                    <p style={{ color: '#991b1b', fontWeight: '500' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f9fafb, #f3f4f6)', padding: '24px' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Órdenes</h1>
                    <p style={{ color: '#6b7280' }}>Gestiona y visualiza todas las órdenes del restaurante</p>
                </div>

                {/* Search Bar */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '24px' }}>
                    <input
                        type="text"
                        placeholder="Buscar por número de orden o cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            outline: 'none',
                            fontSize: '14px',
                            transition: 'all 0.2s'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                {/* Orders Table */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'linear-gradient(to right, #f9fafb, #f3f4f6)', borderBottom: '1px solid #e5e7eb' }}>
                                <tr>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        N° Orden
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Cliente
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Tipo
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Total
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Estado
                                    </th>
                                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Fecha
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAndFilteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '48px 24px', textAlign: 'center' }}>
                                            <p style={{ color: '#6b7280', fontWeight: '500', fontSize: '16px' }}>
                                                {searchTerm ? 'No se encontraron órdenes' : 'No hay órdenes registradas'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedAndFilteredOrders.map(order => {
                                        const isCompleted = ['completado', 'completed'].includes(order.status_display?.toLowerCase()) ||
                                            ['completed'].includes(order.status?.toLowerCase());
                                        return (
                                            <tr
                                                key={order.id}
                                                onClick={() => handleRowClick(order)}
                                                style={{
                                                    borderBottom: '1px solid #e5e7eb',
                                                    transition: 'background-color 0.2s',
                                                    opacity: isCompleted ? 0.6 : 1,
                                                    cursor: 'pointer'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: '600', color: '#2563eb' }}>
                                                        {order.order_number}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: '#374151' }}>
                                                        {order.customer_name || 'Cliente Casual'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ color: '#4b5563' }}>
                                                        {order.order_type_display}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontWeight: '600', color: '#059669' }}>
                                                        ${order.total}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <select
                                                        value={getStatusKey(order.status_display)}
                                                        onChange={(e) => handleStatusChange(order.order_number, e.target.value, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        disabled={updatingStatus[order.order_number]}
                                                        className={getStatusColor(order.status_display)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '9999px',
                                                            fontSize: '12px',
                                                            fontWeight: '500',
                                                            border: '1px solid',
                                                            cursor: updatingStatus[order.order_number] ? 'wait' : 'pointer',
                                                            outline: 'none'
                                                        }}
                                                    >
                                                        <option value="pending">Pendiente</option>
                                                        <option value="completed">Completado</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ fontSize: '14px', color: '#4b5563' }}>
                                                        {new Date(order.created_at).toLocaleString('es-ES', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Stats */}
                {sortedAndFilteredOrders.length > 0 && (
                    <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', padding: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#4b5563' }}>
                            Mostrando <span style={{ fontWeight: '600', color: '#1f2937' }}>{sortedAndFilteredOrders.length}</span> de{' '}
                            <span style={{ fontWeight: '600', color: '#1f2937' }}>{orders.length}</span> órdenes
                        </p>
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {showModal && selectedOrder && (
                <div
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        {/* Modal Header */}
                        <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                                        Orden {selectedOrder.order_number}
                                    </h2>
                                    <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                                        {new Date(selectedOrder.created_at).toLocaleString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <button
                                    onClick={closeModal}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '24px',
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        padding: '4px 8px',
                                        lineHeight: 1
                                    }}
                                    aria-label="Cerrar modal"
                                >
                                    ×
                                </button>
                                
                                <button
                                    onClick={handlePrintTicket}
                                    style={{
                                        background: '#059669',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '8px 16px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        marginLeft: '8px'
                                    }}
                                    aria-label="Imprimir orden"
                                >
                                    Imprimir
                                </button>
                            </div>

                            {/* Cliente destacado en el header */}
                            <div style={{
                                backgroundColor: '#eff6ff',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid #bfdbfe',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <svg
                                    style={{ width: '20px', height: '20px', color: '#2563eb' }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>Cliente</p>
                                    <p style={{ margin: 0, fontSize: '16px', color: '#1e3a8a', fontWeight: '600' }}>
                                        {selectedOrder.customer_name || 'Cliente Casual'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px' }}>
                            {/* Order Info */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                    Información de la Orden
                                </h3>
                                <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#1f2937' }}>
                                        <strong>Tipo de Orden:</strong> {selectedOrder.order_type_display}
                                    </p>
                                    <p style={{ margin: '0 0 8px 0', color: '#1f2937' }}>
                                        <strong>Estado:</strong>{' '}
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '9999px',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            backgroundColor: selectedOrder.status_display?.toLowerCase() === 'completado' || selectedOrder.status?.toLowerCase() === 'completed' ? '#dcfce7' : '#fef3c7',
                                            color: selectedOrder.status_display?.toLowerCase() === 'completado' || selectedOrder.status?.toLowerCase() === 'completed' ? '#166534' : '#92400e'
                                        }}>
                                            {selectedOrder.status_display || getStatusDisplay(selectedOrder.status)}
                                        </span>
                                    </p>
                                    {selectedOrder.table_number && (
                                        <p style={{ margin: '0', color: '#1f2937' }}>
                                            <strong>Mesa:</strong> {selectedOrder.table_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                    Productos
                                </h3>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    {selectedOrder.loading ? (
                                        <div style={{ padding: '32px', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                width: '32px',
                                                height: '32px',
                                                border: '3px solid #e5e7eb',
                                                borderTopColor: '#2563eb',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite'
                                            }}></div>
                                            <p style={{ marginTop: '12px', color: '#6b7280' }}>Cargando productos...</p>
                                        </div>
                                    ) : (
                                        // MODO VISUALIZACIÓN: LISTA NORMAL (Código Original)
                                        selectedOrder.items && selectedOrder.items.length > 0 ? (
                                            selectedOrder.items.map((item, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderBottom: index < selectedOrder.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: '500', color: '#1f2937' }}>
                                                            {item.product_details?.name || item.product_name || 'Producto'}
                                                        </p>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
                                                            Cantidad: {item.quantity} × ${item.unit_price}
                                                        </p>
                                                        {item.notes && (
                                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#d97706', fontStyle: 'italic', backgroundColor: '#fffbeb', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                                                Nota: {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: 0, fontWeight: '600', color: '#059669' }}>
                                                        ${item.line_total || item.subtotal}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ padding: '16px', margin: 0, color: '#6b7280', textAlign: 'center' }}>
                                                No hay productos en esta orden
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Order Summary */}
                            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#6b7280' }}>Subtotal:</span>
                                    <span style={{ fontWeight: '500', color: '#1f2937' }}>${selectedOrder.subtotal}</span>
                                </div>
                                {selectedOrder.tax_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#6b7280' }}>Impuestos:</span>
                                        <span style={{ fontWeight: '500', color: '#1f2937' }}>${selectedOrder.tax_amount}</span>
                                    </div>
                                )}
                                {selectedOrder.discount_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: '#6b7280' }}>Descuento:</span>
                                        <span style={{ fontWeight: '500', color: '#ef4444' }}>-${selectedOrder.discount_amount}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>Total:</span>
                                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>${selectedOrder.total}</span>
                                </div>
                            </div>

                            {/* Notes */}


                            {/* SECCIÓN DE EDICIÓN DE NOTAS */}
                            {selectedOrder.notes && (
                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
                                        Notas
                                    </h3>
                                    <p style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', margin: 0, color: '#92400e' }}>
                                        {selectedOrder.notes}
                                    </p>
                                </div>
                            )}

                            {/* BOTONES DE ACCIÓN (FOOTER) */}
                            <div style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={handleDeleteOrder}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#fee2e2',
                                        color: '#b91c1c',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        marginRight: 'auto'
                                    }}
                                >
                                    Eliminar Orden
                                </button>
                                <button
                                    onClick={closeModal}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#f3f4f6',
                                        color: '#374151',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Ordenes;