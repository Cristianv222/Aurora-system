import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import printerService from '../../services/printerService';

// ====================================================================
// 1. Funciones de Ayuda (Definiciones de formato)
// ====================================================================

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
};

const formatDate = (dateString) => {
    try {
        if (!dateString) return 'Fecha no disponible';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-MX', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
};

const PuntosVenta = () => {
    // =====================================
    // 1. ESTADO DE DATOS Y CARGA
    // =====================================
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingOrder, setProcessingOrder] = useState(false);

    // 2. ESTADO DEL PUNTO DE VENTA
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(null);
    
    const [showReviewModal, setShowReviewModal] = useState(false); 
    const [showInvoiceModal, setShowInvoiceModal] = useState(false); 

    // 3. ESTADO DE CLIENTES
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        email: '',
        password: 'Password123!',
        password_confirmation: 'Password123!',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        city: '',
        cedula: '' 
    });

    // =====================================
    // 4. EFECTOS - CARGA INICIAL DE DATOS
    // =====================================
    useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
        try {
            const productsRes = await api.get('/api/menu/products/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            
            if (!isMounted) return;
            
            const loadedProducts = productsRes.data.results || productsRes.data || [];
            setProducts(loadedProducts);
            
        } catch (err) {
            console.error('Error cargando productos:', err);
        }
        
        try {
            const categoriesRes = await api.get('/api/menu/categories/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            
            if (!isMounted) return;
            
            const loadedCategories = categoriesRes.data.results || categoriesRes.data || [];
            setCategories(loadedCategories);
            
        } catch (err) {
            console.error('Error cargando categorías:', err);
        }
        
        try {
            const tablesRes = await api.get('/api/pos/tables/', {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            
            if (!isMounted) return;
            setTables(tablesRes.data.results || tablesRes.data || []);
            
        } catch (err) {
            console.warn('Mesas no disponibles');
            if (isMounted) {
                setTables([]);
            }
        }
        
        if (isMounted) {
            setLoading(false);
        }
    };
    
    fetchData();
    
    return () => {
        isMounted = false;
    };
}, []);
    // =====================================
    // 5. LÓGICA DEL CARRITO
    // =====================================
    const addToCart = useCallback((product) => {
        setCart(prevCart => {
            const existingItemIndex = prevCart.findIndex(item => item.product_id === product.id);
            if (existingItemIndex >= 0) {
                const newCart = [...prevCart];
                newCart[existingItemIndex] = {
                    ...newCart[existingItemIndex],
                    quantity: newCart[existingItemIndex].quantity + 1
                };
                return newCart;
            } else {
                return [...prevCart, {
                    product_id: product.id,
                    name: product.name,
                    price: parseFloat(product.price),
                    quantity: 1,
                    image: product.image
                }];
            }
        });
    }, []);

    const removeFromCart = useCallback((productId) => {
        setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
    }, []);

    const updateQuantity = useCallback((productId, delta) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product_id === productId) {
                    const newQuantity = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    }, []);

    // =====================================
    // 6. CÁLCULOS DE PRECIOS
    // =====================================
    const calculateSubtotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    }, [cart]);

    const calculateDiscountAmount = useMemo(() => {
        if (!appliedDiscount) return 0;
        const subtotal = calculateSubtotal;
        if (appliedDiscount.discount_type === 'percentage') {
            return subtotal * (parseFloat(appliedDiscount.discount_value) / 100);
        } else if (appliedDiscount.discount_type === 'fixed_amount') {
            return Math.min(parseFloat(appliedDiscount.discount_value), subtotal);
        }
        return 0;
    }, [appliedDiscount, calculateSubtotal]);

    const calculateTotal = useMemo(() => {
        const subtotal = calculateSubtotal;
        const discount = calculateDiscountAmount;
        return (subtotal - discount); 
    }, [calculateSubtotal, calculateDiscountAmount]);

    // =====================================
    // 7. LÓGICA DE DESCUENTOS
    // =====================================
    const handleApplyDiscount = async () => {
        if (!discountCode) return;
        try {
            const response = await api.post('/api/pos/discounts/validate/', { code: discountCode }, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            if (response.data.valid) {
                setAppliedDiscount(response.data.discount);
                alert('Descuento aplicado correctamente');
            } else {
                alert(response.data.message || 'Código inválido');
                setAppliedDiscount(null);
            }
        } catch (err) {
            console.error('Error validating discount:', err);
            alert('Error al validar descuento');
            setAppliedDiscount(null);
        }
    };

    // =====================================
    // 8. LÓGICA DE CLIENTES
    // =====================================
    const searchCustomers = async (query) => {
        setCustomerSearch(query);
        if (query.length < 3) {
            setCustomers([]);
            return;
        }
        try {
            const response = await api.post('/api/customers/admin/search/', { query }, { 
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            setCustomers(response.data.data.customers || []);
        } catch (err) {
            console.error('Error searching customers:', err);
        }
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        try {
             const customerData = {
                ...newCustomer,
                cedula: newCustomer.cedula || null 
            };
            
            const response = await api.post('/api/customers/register/', customerData, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            alert('Cliente creado exitosamente');
            setShowCustomerModal(false);
            setSelectedCustomer(response.data.data.customer);
            setCustomerSearch(`${response.data.data.customer.first_name} ${response.data.data.customer.last_name}`);
            setCustomers([]);
            setNewCustomer({
                email: '',
                password: 'Password123!',
                password_confirmation: 'Password123!',
                first_name: '',
                last_name: '',
                phone: '',
                address: '',
                city: '',
                cedula: '' 
            });
        } catch (err) {
            console.error('Error creating customer:', err);
            const errorData = err.response?.data;
            let errorMessage = 'Error al crear cliente';

            if (errorData?.errors) {
                errorMessage += ':\n' + Object.entries(errorData.errors)
                    .map(([key, val]) => `- ${key}: ${val}`)
                    .join('\n');
            } else if (errorData?.message) {
                errorMessage += ': ' + errorData.message;
            } else {
                errorMessage += ': ' + err.message;
            }

            alert(errorMessage);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // =====================================
    // 9. LÓGICA DE PROCESAMIENTO PRINCIPAL
    // =====================================

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchTerm]);

    // 🖨️ FUNCIÓN PRINCIPAL CON IMPRESIÓN
    const finalPlaceOrder = async () => {
        if (cart.length === 0) return;
        
        setProcessingOrder(true);
        setShowReviewModal(false);

        let orderType = 'dine_in';
        let tableNumber = selectedTable;
        const DEFAULT_TABLE_NAME = 'GENERICA';

        if (selectedTable === 'takeout') {
            orderType = 'takeout';
            tableNumber = '';
        } else if (!selectedTable || selectedTable === 'Seleccionar mesa...') {
            orderType = 'dine_in';
            tableNumber = DEFAULT_TABLE_NAME;
        } else {
            orderType = 'dine_in';
            tableNumber = selectedTable;
        }

        const orderPayload = {
            order_type: orderType,
            table_number: tableNumber,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity
            })),
            discount_code: appliedDiscount ? appliedDiscount.code : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null
        };

        try {
            // 1. CREAR LA ORDEN
            const orderResponse = await api.post('/api/orders/orders/', orderPayload, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });

            const createdOrder = orderResponse.data;
            
            // 2. PREPARAR DATOS PARA EL TICKET
            const receiptData = {
                order_number: createdOrder.order_number || createdOrder.id,
                customer_name: selectedCustomer 
                    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` 
                    : 'CONTADO',
                table_number: selectedTable === 'takeout' ? 'PARA LLEVAR' : (selectedTable || 'MESA GENÉRICA'),
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    total: parseFloat(item.price * item.quantity)
                })),
                subtotal: parseFloat(calculateSubtotal),
                discount: parseFloat(calculateDiscountAmount),
                tax: parseFloat(calculateSubtotal * 0.12), // IVA 12%
                total: parseFloat(calculateTotal)
            };

            // 3. ENVIAR A IMPRIMIR (esto abre la caja automáticamente)
            try {
                const printResult = await printerService.printReceipt(receiptData);
                console.log('✅ Ticket enviado a impresión:', printResult);
                
                alert(
                    `✅ ¡Orden creada exitosamente!\n\n` +
                    `Orden: ${createdOrder.order_number || createdOrder.id}\n` +
                    `Ticket: ${printResult.job_number}\n\n` +
                    `🖨️ El ticket se está imprimiendo...\n` +
                    `🔓 La caja se abrirá automáticamente.`
                );
            } catch (printError) {
                console.error('⚠️ Error al imprimir:', printError);
                
                alert(
                    `⚠️ Orden creada pero no se pudo imprimir\n\n` +
                    `Orden: ${createdOrder.order_number || createdOrder.id}\n\n` +
                    `Error: ${printError.response?.data?.error || 'Error de conexión con la impresora'}\n\n` +
                    `Verifica que el agente de Windows esté ejecutándose.`
                );
            }

            // 4. LIMPIAR EL CARRITO
            setCart([]);
            setAppliedDiscount(null);
            setDiscountCode('');
            setSelectedTable('');
            setSelectedCustomer(null);
            setCustomerSearch('');

        } catch (err) {
            console.error('❌ Error al procesar la orden:', err);
            const errorMsg = err.response?.data 
                ? JSON.stringify(err.response.data) 
                : 'Error al procesar la orden';
            alert(`❌ Error: ${errorMsg}`);
        } finally {
            setProcessingOrder(false);
        }
    };
    
    // 🔓 FUNCIÓN PARA ABRIR CAJA MANUALMENTE
    const handleOpenCashDrawer = async () => {
        try {
            await printerService.openCashDrawer();
            alert('✅ Caja abierta');
        } catch (error) {
            alert('❌ Error al abrir caja. Verifica que el agente esté ejecutándose.');
        }
    };
    
    const openOrderConfirmationModal = () => {
        if (cart.length === 0) {
            alert("El carrito está vacío.");
            return;
        }
        setShowReviewModal(true);
    };

    const handleInvoiceClick = () => {
        setShowReviewModal(false);
        setShowInvoiceModal(true);
    };

    // =====================================
    // 10. COMPONENTES DE RENDERIZADO
    // =====================================

    const renderReviewDetails = () => (
        <div style={{ padding: '0 1rem' }}>
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1f2937' }}>
                    Cliente: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Casual'}
                </p>
                <p style={{ fontSize: '0.9rem', color: '#4b5563' }}>
                    Mesa/Tipo: {selectedTable === 'takeout' ? 'Para Llevar' : selectedTable || 'Mesa Genérica (DINE-IN)'}
                </p>
            </div>

            <div style={{ maxHeight: '30vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f3f4f6' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#4b5563' }}>PRODUCTO</th>
                            <th style={{ width: '15%', textAlign: 'right', padding: '0.5rem', fontSize: '0.8rem', color: '#4b5563' }}>CANT.</th>
                            <th style={{ width: '25%', textAlign: 'right', padding: '0.5rem', fontSize: '0.8rem', color: '#4b5563' }}>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map((item, index) => (
                            <tr key={index}>
                                <td style={{ padding: '0.5rem 0', fontSize: '0.9rem' }}>{item.name}</td>
                                <td style={{ textAlign: 'right', fontSize: '0.9rem' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: '600' }}>
                                    {formatCurrency(item.price * item.quantity)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem', color: '#6b7280' }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(calculateSubtotal)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#dc2626' }}>
                    <span>Descuento</span>
                    <span>- {formatCurrency(calculateDiscountAmount)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '0.75rem' }}>
                    <span>Total Final</span>
                    <span style={{ color: '#059669' }}>{formatCurrency(calculateTotal)}</span>
                </div>
            </div>
        </div>
    );
    
    const renderCartItems = () => (
        <div style={{ 
            flex: 1, 
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            borderBottom: '2px solid #e5e7eb',
            borderRight: '2px solid #e5e7eb'
        }}>
             <div style={{
                padding: '1rem 1.5rem 0.5rem 1.5rem',
                backgroundColor: '#f3f4f6',
                flexShrink: 0,
                borderBottom: '1px solid #e5e7eb'
            }}>
                <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: 0
                }}>
                    Orden Actual
                </h3>
            </div>
            
            <div style={{
                flex: 1, 
                overflowY: 'auto',
                padding: '1.5rem', 
            }}>
                {cart.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem 1rem',
                        color: '#9ca3af',
                        fontSize: '0.9375rem'
                    }}>
                        <p style={{ margin: 0 }}>No hay productos en el carrito</p>
                        <p style={{
                            margin: '0.5rem 0 0 0',
                            fontSize: '0.8125rem'
                        }}>
                            Selecciona productos para comenzar
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {cart.map((item, index) => (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{
                                        fontSize: '0.9375rem',
                                        fontWeight: '600',
                                        color: '#1f2937',
                                        marginBottom: '0.25rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.name}
                                    </h4>
                                    <p style={{
                                        fontSize: '0.8125rem',
                                        color: '#6b7280',
                                        margin: 0
                                    }}>
                                        {formatCurrency(item.price)} c/u
                                    </p>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        backgroundColor: '#ffffff'
                                    }}>
                                        <button
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                color: '#6b7280',
                                                fontSize: '1.25rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s'
                                            }}
                                            onClick={() => updateQuantity(item.product_id, -1)}
                                            onMouseEnter={(e) => {
                                                e.target.style.backgroundColor = '#f3f4f6';
                                                e.target.style.color = '#111827';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.backgroundColor = 'transparent';
                                                e.target.style.color = '#6b7280';
                                            }}
                                        >
                                            −
                                        </button>
                                        <span style={{
                                            width: '36px',
                                            textAlign: 'center',
                                            fontSize: '0.9375rem',
                                            fontWeight: '600',
                                            color: '#1f2937'
                                        }}>
                                            {item.quantity}
                                        </span>
                                        <button
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                color: '#6b7280',
                                                fontSize: '1.25rem',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s'
                                            }}
                                            onClick={() => updateQuantity(item.product_id, 1)}
                                            onMouseEnter={(e) => {
                                                e.target.style.backgroundColor = '#f3f4f6';
                                                e.target.style.color = '#111827';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.backgroundColor = 'transparent';
                                                e.target.style.color = '#6b7280';
                                            }}
                                        >
                                            +
                                        </button>
                                    </div>

                                    <button
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            backgroundColor: '#fee2e2',
                                            border: '2px solid #fecaca',
                                            borderRadius: '8px',
                                            color: '#dc2626',
                                            fontSize: '1.125rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.15s'
                                        }}
                                        onClick={() => removeFromCart(item.product_id)}
                                        onMouseEnter={(e) => {
                                            e.target.style.backgroundColor = '#dc2626';
                                            e.target.style.borderColor = '#dc2626';
                                            e.target.style.color = '#ffffff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.backgroundColor = '#fee2e2';
                                            e.target.style.borderColor = '#fecaca';
                                            e.target.style.color = '#dc2626';
                                        }}
                                        title="Eliminar producto"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
    
    if (loading) return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '1.125rem',
            color: '#6b7280'
        }}>
            Cargando sistema de punto de venta...
        </div>
    );

    // =====================================
    // 11. ESTRUCTURA PRINCIPAL DEL POS
    // =====================================

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f9fafb',
            overflow: 'hidden'
        }}>

            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '2px solid #e5e7eb',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: 0,
                    letterSpacing: '-0.025em'
                }}>
                    Punto de Venta
                </h1>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* Panel Izquierdo: Catálogo */}
                <div style={{
                    flex: '1 1 50%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    borderRight: '2px solid #e5e7eb'
                }}>

                    {/* Filtros */}
                    <div style={{
                        padding: '1.25rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            overflowX: 'auto',
                            paddingBottom: '0.5rem'
                        }}>
                            <button
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '6px',
                                    border: selectedCategory === 'all' ? 'none' : '2px solid #d1d5db',
                                    backgroundColor: selectedCategory === 'all' ? '#3b82f6' : '#ffffff',
                                    color: selectedCategory === 'all' ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    boxShadow: selectedCategory === 'all' ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
                                }}
                                onClick={() => setSelectedCategory('all')}
                            >
                                Todos los productos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    style={{
                                        padding: '0.625rem 1.25rem',
                                        borderRadius: '6px',
                                        border: selectedCategory === cat.id ? 'none' : '2px solid #d1d5db',
                                        backgroundColor: selectedCategory === cat.id ? '#3b82f6' : '#ffffff',
                                        color: selectedCategory === cat.id ? '#ffffff' : '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        boxShadow: selectedCategory === cat.id ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none'
                                    }}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Productos */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.5rem',
                        backgroundColor: '#f9fafb'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '1rem'
                        }}>
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onClick={() => addToCart(product)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                        e.currentTarget.style.borderColor = '#3b82f6';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                    }}
                                >
                                    <div style={{
                                        height: '120px',
                                        backgroundColor: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.75rem'
                                    }}>
                                        {product.image ? (
                                            <img
                                                src={product.image.startsWith('http') ? product.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${product.image}`}
                                                alt={product.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        ) : (
                                            <span style={{
                                                color: '#94a3b8',
                                                fontSize: '0.75rem',
                                                textAlign: 'center'
                                            }}>
                                                Sin imagen
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ padding: '0.875rem' }}>
                                        <h3 style={{
                                            fontSize: '0.9375rem',
                                            fontWeight: '600',
                                            color: '#1f2937',
                                            marginBottom: '0.375rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {product.name}
                                        </h3>
                                        <p style={{
                                            fontSize: '1.125rem',
                                            fontWeight: '700',
                                            color: '#059669',
                                            margin: 0
                                        }}>
                                            ${product.price}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Panel Central: Carrito */}
                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', borderRight: '2px solid #e5e7eb' }}>
                    {renderCartItems()}
                </div>

                {/* Panel Derecho: Checkout */}
                <div style={{
                    flex: '0 0 420px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
                    flexShrink: 0 
                }}>

                    {/* Información Orden */}
                    <div style={{
                        padding: '1.5rem',
                        borderBottom: '2px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        flexShrink: 0
                    }}>
                        {/* Mesa */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}>
                                Mesa / Tipo de Orden
                            </label>
                            <select
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '2px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.9375rem',
                                    color: '#1f2937',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                            >
                                <option value="">Seleccionar mesa...</option>
                                <option value="takeout">Para Llevar (Takeout)</option>
                                {tables.map(table => (
                                    <option
                                        key={table.id}
                                        value={table.number}
                                        disabled={table.status !== 'available'}
                                    >
                                        Mesa {table.number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Cliente */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}>
                                Cliente
                            </label>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, cédula o teléfono..." 
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s'
                                        }}
                                        value={customerSearch}
                                        onChange={(e) => searchCustomers(e.target.value)}
                                    />
                                    {customers.length > 0 && (
                                        <div style={{
                                            position: 'absolute',
                                            zIndex: 10,
                                            width: '100%',
                                            backgroundColor: '#ffffff',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                            marginTop: '0.25rem',
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}>
                                            {customers.map(c => (
                                                <div
                                                    key={c.id}
                                                    style={{
                                                        padding: '0.75rem',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #f3f4f6',
                                                        transition: 'background-color 0.15s'
                                                    }}
                                                    onClick={() => {
                                                        setSelectedCustomer(c);
                                                        setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                        setCustomers([]);
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                                >
                                                    <p style={{
                                                        fontWeight: '600',
                                                        color: '#1f2937',
                                                        marginBottom: '0.25rem',
                                                        fontSize: '0.9375rem'
                                                    }}>
                                                        {c.first_name} {c.last_name}
                                                    </p>
                                                    <p style={{
                                                        fontSize: '0.8125rem',
                                                        color: '#6b7280',
                                                        margin: 0
                                                    }}>
                                                        {c.email} {c.cedula && `(${c.cedula})`} 
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        backgroundColor: '#8b5cf6',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '1.5rem',
                                        fontWeight: '300',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onClick={() => setShowCustomerModal(true)}
                                    title="Agregar nuevo cliente"
                                >
                                    +
                                </button>
                            </div>

                            {selectedCustomer && (
                                <div style={{
                                    backgroundColor: '#f3e8ff',
                                    border: '2px solid #c084fc',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#6b21a8'
                                    }}>
                                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                                    </span>
                                    <button
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            color: '#dc2626',
                                            fontSize: '1.125rem',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            lineHeight: 1
                                        }}
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setCustomerSearch('');
                                        }}
                                        title="Quitar cliente"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Descuentos y Totales */}
                    <div style={{
                        borderTop: '2px solid #e5e7eb',
                        padding: '1.5rem',
                        backgroundColor: '#ffffff',
                        flexShrink: 0
                    }}>
                        {/* Descuento */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#374151',
                                marginBottom: '0.5rem'
                            }}>
                                Código de Descuento
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="Ingresa el código"
                                    style={{
                                        flex: 1,
                                        padding: '0.6rem', 
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s'
                                    }}
                                    value={discountCode}
                                    onChange={(e) => setDiscountCode(e.target.value)}
                                />
                                <button
                                    style={{
                                        padding: '0.6rem 1rem', 
                                        backgroundColor: '#fbbf24',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#78350f',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onClick={handleApplyDiscount}
                                >
                                    Aplicar
                                </button>
                            </div>
                            {appliedDiscount && (
                                <div style={{
                                    marginTop: '0.75rem',
                                    padding: '0.75rem',
                                    backgroundColor: '#d1fae5',
                                    border: '2px solid #86efac',
                                    borderRadius: '8px',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#065f46'
                                }}>
                                    Descuento aplicado: {appliedDiscount.name}
                                </div>
                            )}
                        </div>

                        {/* Totales */}
                        <div style={{
                            borderTop: '2px solid #e5e7eb',
                            paddingTop: '1rem'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '0.75rem',
                                fontSize: '0.9375rem',
                                color: '#6b7280'
                            }}>
                                <span>Subtotal</span>
                                <span style={{ fontWeight: '600' }}>{formatCurrency(calculateSubtotal)}</span>
                            </div>

                            {appliedDiscount && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.75rem',
                                    fontSize: '0.9375rem',
                                    color: '#dc2626',
                                    fontWeight: '600'
                                }}>
                                    <span>Descuento</span>
                                    <span>- {formatCurrency(calculateDiscountAmount)}</span>
                                </div>
                            )}

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingTop: '1rem',
                                borderTop: '2px solid #e5e7eb',
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: '#111827'
                            }}>
                                <span>Total</span>
                                <span style={{ color: '#059669' }}>{formatCurrency(calculateTotal)}</span>
                            </div>
                        </div>

                        {/* Botón Principal */}
                        <button
                            style={{
                                width: '100%',
                                marginTop: '1.5rem',
                                padding: '1rem',
                                backgroundColor: cart.length === 0 || processingOrder ? '#d1d5db' : '#3b82f6', 
                                border: 'none',
                                borderRadius: '10px',
                                color: '#ffffff',
                                fontSize: '1.125rem',
                                fontWeight: '700',
                                cursor: cart.length === 0 || processingOrder ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: cart.length === 0 || processingOrder ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}
                            onClick={openOrderConfirmationModal} 
                            disabled={cart.length === 0 || processingOrder}
                        >
                            {processingOrder ? 'Procesando pedido...' : 'Revisar y Pagar'}
                        </button>

                        {/* 🔓 Botón Abrir Caja */}
                        <button
                            style={{
                                width: '100%',
                                marginTop: '0.75rem',
                                padding: '0.75rem',
                                backgroundColor: '#f59e0b',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#ffffff',
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={handleOpenCashDrawer}
                        >
                            🔓 Abrir Caja Registradora
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Confirmación */}
            {showReviewModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '550px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '2px solid #e5e7eb',
                            backgroundColor: '#1f2937',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <div>
                                <h3 style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    color: '#ffffff',
                                    margin: 0
                                }}>
                                    Confirmación de Orden
                                </h3>
                                <p style={{ color: '#d1d5db', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                                    Confirma la orden antes de procesar el pago.
                                </p>
                            </div>
                            
                            <button
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #9ca3af',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontWeight: '500',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={handleInvoiceClick}
                            >
                                FACTURAR
                            </button>
                        </div>

                        {renderReviewDetails()}

                        <div style={{
                            padding: '1.5rem',
                            borderTop: '2px solid #e5e7eb',
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'space-between'
                        }}>
                            <button
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#9ca3af',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontWeight: '600',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    flex: 1
                                }}
                                onClick={() => setShowReviewModal(false)}
                            >
                                Editar Pedido
                            </button>
                            
                            <button
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#059669',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#ffffff',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    flex: 1
                                }}
                                onClick={finalPlaceOrder}
                                disabled={processingOrder}
                            >
                                Confirmar y Procesar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal Facturación */}
            {showInvoiceModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '2rem',
                        textAlign: 'center',
                        maxWidth: '400px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
                    }}>
                        <h3 style={{ color: '#f59e0b', margin: '0 0 1rem 0' }}>⚠️ FUNCIONALIDAD EN DESARROLLO</h3>
                        <p style={{ fontSize: '1rem', color: '#1f2937', marginBottom: '1.5rem' }}>
                            La ventana de facturación se implementará en una fase posterior.
                        </p>
                        <button
                            style={{
                                padding: '0.75rem 2rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}
                            onClick={() => setShowInvoiceModal(false)}
                        >
                            Aceptar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Crear Cliente */}
            {showCustomerModal && (
                <div style={{
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
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '2px solid #e5e7eb',
                            backgroundColor: '#fafafa'
                        }}>
                            <h3 style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: '#111827',
                                margin: 0
                            }}>
                                Nuevo Cliente
                            </h3>
                        </div>

                        <form onSubmit={handleCreateCustomer} style={{ padding: '1.5rem' }}>
                            
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Cédula / RUC (Identificación)
                                </label>
                                <input
                                    type="text"
                                    name="cedula"
                                    value={newCustomer.cedula}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                            
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={newCustomer.email}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                marginBottom: '1.25rem'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        name="first_name"
                                        value={newCustomer.first_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#374151',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Apellido
                                    </label>
                                    <input
                                        type="text"
                                        name="last_name"
                                        value={newCustomer.last_name}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Teléfono
                                </label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={newCustomer.phone}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#374151',
                                    marginBottom: '0.5rem'
                                }}>
                                    Ciudad
                                </label>
                                <input
                                    type="text"
                                    name="city"
                                    value={newCustomer.city}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                justifyContent: 'flex-end',
                                borderTop: '2px solid #e5e7eb',
                                paddingTop: '1.5rem'
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: '#ffffff',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        color: '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setShowCustomerModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: '#8b5cf6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PuntosVenta;