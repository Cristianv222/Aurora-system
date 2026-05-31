// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { getCleanImageUrl } from '../../utils/image';
import printerService from '../../services/printerService';

// ====================================================================
// 1. Funciones de Ayuda (Definiciones de formato)
// ====================================================================

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-US', {
        style: 'currency',
        currency: 'USD',
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

// Constantes para áreas táctiles (mínimo 44x44px)
const TOUCH_MIN_SIZE = '44px';

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
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);
    const [showOrderDetails, setShowOrderDetails] = useState(false);
    const [editingNoteForItem, setEditingNoteForItem] = useState(null);
    const [noteText, setNoteText] = useState('');

    // 2. ESTADO DEL PUNTO DE VENTA
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('takeout');
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(null);

    const [showReviewModal, setShowReviewModal] = useState(false);

    // 3.5 ESTADO DE CALCULADORA DE VUELTO
    const [cashGiven, setCashGiven] = useState(null);
    const [inputCash, setInputCash] = useState('');

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

    // States for Payment Methods and SRI Invoicing
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [processSRI, setProcessSRI] = useState(false);
    const [billingIdentType, setBillingIdentType] = useState('05');
    const [billingIdent, setBillingIdent] = useState('');
    const [billingName, setBillingName] = useState('');
    const [billingEmail, setBillingEmail] = useState('');
    const [billingPhone, setBillingPhone] = useState('');
    const [billingAddress, setBillingAddress] = useState('');

    // Auto-populate SRI billing info from selected customer or default to Consumidor Final
    useEffect(() => {
        if (selectedCustomer) {
            setBillingIdent(selectedCustomer.cedula || '');
            setBillingName(`${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim());
            setBillingEmail(selectedCustomer.email || '');
            setBillingPhone(selectedCustomer.phone || '');
            setBillingAddress(selectedCustomer.address || 'Quito');
            if (selectedCustomer.cedula) {
                if (selectedCustomer.cedula.length === 13) {
                    setBillingIdentType('04'); // RUC
                } else if (selectedCustomer.cedula.length === 10) {
                    setBillingIdentType('05'); // Cédula
                } else {
                    setBillingIdentType('07'); // Consumidor Final / Otro
                }
            } else {
                setBillingIdentType('07');
            }
        } else {
            if (processSRI) {
                setBillingIdentType('07'); // Consumidor Final
                setBillingIdent('9999999999999');
                setBillingName('CONSUMIDOR FINAL');
                setBillingEmail('facturacion@consumidorfinal.com');
                setBillingPhone('9999999999');
                setBillingAddress('Quito');
            } else {
                setBillingIdent('');
                setBillingName('');
                setBillingEmail('');
                setBillingPhone('');
                setBillingAddress('');
                setBillingIdentType('05');
            }
        }
    }, [selectedCustomer, processSRI]);

    // =====================================
    // 4. EFECTOS - CARGA INICIAL DE DATOS Y RESPONSIVIDAD
    // =====================================
    // Inject custom scrollbar styles
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            ::-webkit-scrollbar-track {
                background: #f1f1f1; 
            }
            ::-webkit-scrollbar-thumb {
                background: #c7d2fe; 
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #a5b4fc; 
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const productsRes = await api.get('/api/menu/products/', {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;

                const rawProducts = productsRes.data.results || (Array.isArray(productsRes.data) ? productsRes.data : []);
                const loadedProducts = Array.isArray(rawProducts) ? rawProducts : [];
                setProducts(loadedProducts);

            } catch (err) {
                console.error('Error cargando productos:', err);
            }

            try {
                const categoriesRes = await api.get('/api/menu/categories/', {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;

                const rawCategories = categoriesRes.data.results || (Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
                const loadedCategories = Array.isArray(rawCategories) ? rawCategories : [];
                setCategories(loadedCategories);

            } catch (err) {
                console.error('Error cargando categorías:', err);
            }

            try {
                const tablesRes = await api.get('/api/pos/tables/', {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });

                if (!isMounted) return;
                setTables(tablesRes.data.results || (Array.isArray(tablesRes.data) ? tablesRes.data : []));

            } catch (err) {
                console.warn('Mesas no disponibles');
                if (isMounted) {
                    setTables([]);
                }
            }

            try {
                const paymentsRes = await api.get('/api/payments/payment-methods/active/', {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });
                if (!isMounted) return;
                const methods = paymentsRes.data.results || paymentsRes.data || [];
                setPaymentMethods(methods);
                if (methods.length > 0) {
                    const cashMethod = methods.find(m => m.method_type === 'cash');
                    setSelectedPaymentMethod(cashMethod ? cashMethod.id : methods[0].id);
                }
            } catch (err) {
                console.warn('Métodos de pago no disponibles', err);
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

    // Detectar tamaño de pantalla
    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };

        handleResize(); // Ejecutar al inicio
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
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
                    image: product.image,
                    note: '' // Nueva propiedad para notas
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

    // Función para agregar/editar nota
    const handleAddNote = (productId) => {
        const item = cart.find(item => item.product_id === productId);
        setEditingNoteForItem(productId);
        setNoteText(item?.note || '');
    };

    const saveNote = () => {
        if (!editingNoteForItem) return;

        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product_id === editingNoteForItem) {
                    return { ...item, note: noteText.trim() };
                }
                return item;
            });
        });

        setEditingNoteForItem(null);
        setNoteText('');
    };

    const cancelNote = () => {
        setEditingNoteForItem(null);
        setNoteText('');
    };

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
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
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
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
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
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
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
            const isAvailable = product.is_active && product.is_available;

            return matchesCategory && matchesSearch && isAvailable;
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

        // Preparar notas con información de pago
        let orderNotes = '';
        if (cashGiven) {
            const change = cashGiven - calculateTotal;
            orderNotes = `Pago con: ${formatCurrency(cashGiven)} - Cambio: ${formatCurrency(change)}`;
        }

        // Modificado para incluir notas en los items
        const orderPayload = {
            order_type: orderType,
            table_number: tableNumber,
            notes: orderNotes, // Nueva nota general
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.note || '' // Corregido: 'notes' (plural) para coincidir con el serializer
            })),
            discount_code: appliedDiscount ? appliedDiscount.code : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null
        };

        try {
            // 1. CREAR LA ORDEN
            const orderResponse = await api.post('/api/orders/orders/', orderPayload, {
                baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
            });

            const createdOrder = orderResponse.data;

            // 1.5. CREAR EL PAGO Y PROCESAR FACTURACIÓN ELECTRÓNICA
            try {
                const paymentPayload = {
                    order_id: createdOrder.id,
                    payment_method_id: selectedPaymentMethod,
                    currency_code: 'USD',
                    amount: calculateTotal,
                    amount_received: cashGiven || calculateTotal,
                    process_sri: processSRI,
                    billing_data: processSRI ? {
                        identification_type: billingIdentType,
                        identification: billingIdent,
                        name: billingName,
                        email: billingEmail,
                        phone: billingPhone,
                        address: billingAddress
                    } : {}
                };

                const paymentResponse = await api.post('/api/payments/payments/', paymentPayload, {
                    baseURL: import.meta.env.VITE_FAST_FOOD_SERVICE
                });

                const paymentData = paymentResponse.data;

                if (processSRI && paymentData.invoice_error) {
                    alert(`⚠️ Pago registrado pero hubo un problema con la factura electrónica SRI:\n\n${paymentData.invoice_error}`);
                } else if (processSRI && paymentData.sri_status === 'AUTHORIZED') {
                    alert(`✅ Factura electrónica SRI autorizada exitosamente.\nClave de Acceso: ${paymentData.sri_access_key}\nNúmero de Factura: ${paymentData.sri_number}`);
                }
            } catch (payError) {
                console.error('⚠️ Error al registrar el pago / SRI:', payError);
                const payErrMsg = payError.response?.data?.detail || payError.response?.data?.error || JSON.stringify(payError.response?.data || payError.message);
                alert(`⚠️ Se creó la orden pero no se pudo registrar el pago ni procesar el SRI:\n\n${payErrMsg}`);
            }

            // 2. PREPARAR DATOS PARA EL TICKET (incluyendo notas)
            const receiptData = {
                order_number: createdOrder.order_number || createdOrder.id,
                customer_name: selectedCustomer
                    ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                    : 'CONSUMIDOR FINAL',
                table_number: selectedTable === 'takeout' ? 'PARA LLEVAR' : (selectedTable || 'MESA GENÉRICA'),
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    total: parseFloat(item.price * item.quantity),
                    note: item.note || '' // Incluir nota en los datos del ticket
                })),
                subtotal: parseFloat(calculateSubtotal),
                discount: parseFloat(calculateDiscountAmount),
                tax: parseFloat(calculateSubtotal * 0.12), // IVA 12%
                total: parseFloat(calculateTotal),
                printed_at: new Date().toISOString() // Hora del cliente para el ticket
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

            // 4. LIMPIAR EL CARRITO Y ESTADOS SRI
            setCart([]);
            setAppliedDiscount(null);
            setDiscountCode('');
            setSelectedTable('takeout');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCashGiven(null); // Resetear calculadora
            setInputCash('');
            setProcessSRI(false);

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

    // =====================================
    // 10. COMPONENTES DE RENDERIZADO
    // =====================================

    const renderReviewDetails = () => (
        <div style={{ padding: screenWidth <= 1366 ? '0.5rem' : '0 1rem' }}>
            {/* Sección de configuración de orden */}
            <div style={{
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                padding: screenWidth <= 1366 ? '0.75rem' : '1rem',
                marginBottom: '1rem'
            }}>
                {/* Cliente */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                    }}>
                        Cliente
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input
                                type="text"
                                placeholder="Buscar por nombre, cédula o teléfono..."
                                style={{
                                    width: '100%',
                                    padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                                    border: '2px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                    transition: 'all 0.2s',
                                    minHeight: TOUCH_MIN_SIZE
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
                                                transition: 'background-color 0.15s',
                                                minHeight: TOUCH_MIN_SIZE,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                setCustomers([]);
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                                        >
                                            <div>
                                                <p style={{
                                                    fontWeight: '600',
                                                    color: '#1f2937',
                                                    marginBottom: '0.25rem',
                                                    fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem'
                                                }}>
                                                    {c.first_name} {c.last_name}
                                                </p>
                                                <p style={{
                                                    fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8125rem',
                                                    color: '#6b7280',
                                                    margin: 0
                                                }}>
                                                    {c.email} {c.cedula && `(${c.cedula})`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            style={{
                                width: TOUCH_MIN_SIZE,
                                height: TOUCH_MIN_SIZE,
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
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                            onClick={() => setShowCustomerModal(true)}
                            title="Agregar nuevo cliente"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Mesa/Tipo de Orden */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem'
                    }}>
                        Mesa / Tipo de Orden
                    </label>
                    <select
                        style={{
                            width: '100%',
                            padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                            border: '2px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            color: '#1f2937',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
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

                {/* Código de Descuento */}
                <div>
                    <label style={{
                        display: 'block',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.875rem',
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
                                padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                                border: '2px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                transition: 'all 0.2s',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value)}
                        />
                        <button
                            style={{
                                padding: screenWidth <= 1366 ? '0 0.75rem' : '0 1.5rem',
                                backgroundColor: '#fbbf24',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#78350f',
                                fontWeight: '600',
                                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                minHeight: TOUCH_MIN_SIZE,
                                minWidth: TOUCH_MIN_SIZE
                            }}
                            onClick={handleApplyDiscount}
                        >
                            {screenWidth <= 1366 ? 'Aplicar' : 'Aplicar'}
                        </button>
                    </div>
                    {appliedDiscount && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.75rem',
                            backgroundColor: '#d1fae5',
                            border: '2px solid #86efac',
                            borderRadius: '8px',
                            fontSize: screenWidth <= 1366 ? '0.75rem' : '0.875rem',
                            fontWeight: '600',
                            color: '#065f46'
                        }}>
                            Descuento aplicado: {appliedDiscount.name}
                        </div>
                    )}
                </div>
            </div>

            {/* Resumen de productos */}
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                <p style={{ fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem', fontWeight: 'bold', color: '#1f2937' }}>
                    Cliente: {selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'CONSUMIDOR FINAL'}
                </p>
                <p style={{ fontSize: screenWidth <= 1366 ? '0.75rem' : '0.9rem', color: '#4b5563' }}>
                    Mesa/Tipo: {selectedTable === 'takeout' ? 'Para Llevar' : selectedTable || 'Mesa Genérica (DINE-IN)'}
                </p>
            </div>

            <div style={{
                maxHeight: screenWidth <= 1366 ? '40vh' : '30vh',
                overflowY: 'auto',
                marginBottom: '1rem',
                fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f3f4f6' }}>
                        <tr>
                            <th style={{
                                textAlign: 'left',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>PRODUCTO</th>
                            <th style={{
                                width: '15%',
                                textAlign: 'right',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>CANT.</th>
                            <th style={{
                                width: '25%',
                                textAlign: 'right',
                                padding: screenWidth <= 1366 ? '0.25rem' : '0.5rem',
                                fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                color: '#4b5563'
                            }}>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map((item, index) => (
                            <React.Fragment key={index}>
                                <tr>
                                    <td style={{
                                        padding: screenWidth <= 1366 ? '0.25rem 0' : '0.5rem 0',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
                                    }}>
                                        <div>
                                            {item.name}
                                            {item.note && (
                                                <div style={{
                                                    fontSize: screenWidth <= 1366 ? '0.75rem' : '0.8rem',
                                                    color: '#6b7280',
                                                    fontStyle: 'italic',
                                                    marginTop: '2px'
                                                }}>
                                                    ({item.note})
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{
                                        textAlign: 'right',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem'
                                    }}>{item.quantity}</td>
                                    <td style={{
                                        textAlign: 'right',
                                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9rem',
                                        fontWeight: '600'
                                    }}>
                                        {formatCurrency(item.price * item.quantity)}
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* SECCIÓN: CALCULADORA DE VUELTO */}
            <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#eef2ff',
                borderRadius: '8px',
                border: '1px solid #c7d2fe'
            }}>
                <h4 style={{
                    margin: '0 0 0.5rem 0',
                    color: '#3730a3',
                    fontSize: screenWidth <= 1366 ? '0.9rem' : '1rem'
                }}>
                    <i className="bi bi-calculator"></i> Calculadora de Vuelto
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#374151' }}>
                        Ingreso Manual:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            value={inputCash}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInputCash(val);
                                setCashGiven(val ? parseFloat(val) : null);
                            }}
                            placeholder="0.00"
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '1rem'
                            }}
                        />
                        <button
                            onClick={() => {
                                setCashGiven(null);
                                setInputCash('');
                            }}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #ef4444',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Borrar
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[1, 2, 5, 10, 20, 50, 100].map(bill => (
                        <button
                            key={bill}
                            onClick={() => {
                                const newVal = (cashGiven || 0) + bill;
                                setCashGiven(newVal);
                                setInputCash(newVal.toString());
                            }}
                            style={{
                                padding: '0.5rem',
                                backgroundColor: '#ffffff',
                                color: '#3730a3',
                                border: '1px solid #c7d2fe',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                        >
                            + ${bill}
                        </button>
                    ))}
                </div>

                {cashGiven !== null && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e0e7ff',
                        textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Total a Pagar:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatCurrency(calculateTotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Efectivo Recibido:</span>
                            <span style={{ fontWeight: 'bold', color: '#4f46e5' }}>{formatCurrency(cashGiven)}</span>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '0.5rem',
                            paddingTop: '0.5rem',
                            borderTop: '1px dashed #c7d2fe',
                            fontSize: '1.2rem',
                            fontWeight: '800'
                        }}>
                            <span style={{ color: '#3730a3' }}>VUELTO:</span>
                            <span style={{ color: (cashGiven - calculateTotal) < 0 ? '#ef4444' : '#059669' }}>
                                {formatCurrency(cashGiven - calculateTotal)}
                            </span>
                        </div>
                        {(cashGiven - calculateTotal) < 0 && (
                            <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                    <i className="bi bi-exclamation-triangle-fill"></i> Monto insuficiente
                                </span>
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Método de Pago Selector */}
            <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                }}>
                    Método de Pago
                </label>
                <select
                    style={{
                        width: '100%',
                        padding: screenWidth <= 1366 ? '0.5rem' : '0.75rem',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                        color: '#1f2937',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minHeight: TOUCH_MIN_SIZE
                    }}
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                >
                    {paymentMethods.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>

            {/* Toggle SRI Invoicing */}
            <div className="flex items-center justify-between border-y border-slate-200 py-3 my-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                        <i className="bi bi-receipt-cutoff text-lg text-indigo-600"></i>
                    </div>
                    <div className="text-left">
                        <span className="text-xs font-bold text-slate-700 block">Emitir Factura Electrónica (SRI)</span>
                        <span className="text-[10px] text-slate-500 block">Conectar al portal de SRI FactuExpress</span>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={processSRI} 
                        onChange={e => setProcessSRI(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
            </div>

            {/* SRI Billing fields conditionally shown */}
            {processSRI && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 mb-4 text-left animate-in slide-in-from-top-4 duration-150">
                    <h4 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5"><i className="bi bi-person-badge-fill text-slate-500"></i> Datos de Emisión</h4>
                    
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Tipo ID</label>
                            <select 
                                value={billingIdentType} 
                                onChange={e => setBillingIdentType(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl p-2 text-xs bg-white text-slate-850"
                            >
                                <option value="07">Consumidor Final</option>
                                <option value="05">Cédula</option>
                                <option value="04">RUC</option>
                                <option value="06">Pasaporte</option>
                                <option value="08">ID Exterior</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">N. Identificación</label>
                            <input 
                                type="text" 
                                value={billingIdent}
                                onChange={e => setBillingIdent(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-850 bg-white" 
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Razón Social / Nombre</label>
                        <input 
                            type="text" 
                            value={billingName}
                            onChange={e => setBillingName(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-850 bg-white" 
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Email Destinatario</label>
                            <input 
                                type="email" 
                                value={billingEmail}
                                onChange={e => setBillingEmail(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-850 bg-white" 
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Teléfono</label>
                            <input 
                                type="text" 
                                value={billingPhone}
                                onChange={e => setBillingPhone(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-850 bg-white" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Dirección Fiscal</label>
                        <input 
                            type="text" 
                            value={billingAddress}
                            onChange={e => setBillingAddress(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl p-2 text-xs text-slate-850 bg-white" 
                        />
                    </div>
                </div>
            )}

            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                    fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem',
                    color: '#6b7280'
                }}>
                    <span>Subtotal</span>
                    <span>{formatCurrency(calculateSubtotal)}</span>
                </div>

                {appliedDiscount && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                        color: '#dc2626',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem'
                    }}>
                        <span>Descuento</span>
                        <span>- {formatCurrency(calculateDiscountAmount)}</span>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: screenWidth <= 1366 ? '1.25rem' : '1.5rem',
                    fontWeight: 'bold',
                    borderTop: '1px solid #ccc',
                    paddingTop: '0.75rem'
                }}>
                    <span>Total Final</span>
                    <span style={{ color: '#059669' }}>{formatCurrency(calculateTotal)}</span>
                </div>
            </div>
        </div>
    );

    // Modal para agregar nota
    const renderNoteModal = () => (
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
            zIndex: 1001,
            padding: screenWidth <= 1366 ? '0.5rem' : '1rem'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: screenWidth <= 1366 ? '95%' : '500px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                padding: screenWidth <= 1366 ? '1rem' : '1.5rem'
            }}>
                <div style={{
                    marginBottom: '1rem',
                    borderBottom: '2px solid #e5e7eb',
                    paddingBottom: '0.75rem'
                }}>
                    <h3 style={{
                        fontSize: screenWidth <= 1366 ? '1.125rem' : '1.25rem',
                        fontWeight: '700',
                        color: '#111827',
                        margin: 0
                    }}>
                        Agregar Nota Especial
                    </h3>
                    <p style={{
                        fontSize: screenWidth <= 1366 ? '0.75rem' : '0.875rem',
                        color: '#6b7280',
                        marginTop: '0.25rem'
                    }}>
                        Escribe las especificaciones del producto (aparecerá entre paréntesis en el ticket)
                    </p>
                </div>

                <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Ej: Sin cebolla, extra queso, bien cocido, etc."
                    style={{
                        width: '100%',
                        height: '120px',
                        padding: '0.75rem',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: screenWidth <= 1366 ? '0.875rem' : '1rem',
                        fontFamily: 'inherit',
                        resize: 'none',
                        boxSizing: 'border-box',
                        marginBottom: '1.5rem'
                    }}
                    maxLength={100}
                />

                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        style={{
                            padding: screenWidth <= 1366 ? '0.5rem 1rem' : '0.75rem 1.5rem',
                            backgroundColor: '#ffffff',
                            border: '2px solid #d1d5db',
                            borderRadius: '8px',
                            color: '#374151',
                            fontWeight: '600',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
                        }}
                        onClick={cancelNote}
                    >
                        Cancelar
                    </button>
                    <button
                        style={{
                            padding: screenWidth <= 1366 ? '0.5rem 1rem' : '0.75rem 1.5rem',
                            backgroundColor: '#4f46e5',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: '600',
                            fontSize: screenWidth <= 1366 ? '0.875rem' : '0.9375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            minHeight: TOUCH_MIN_SIZE
                        }}
                        onClick={saveNote}
                    >
                        Guardar Nota
                    </button>
                </div>
            </div>
        </div>
    );

    // Renderizar vista con botones abajo (para pantallas <= 1366px - menos de 16 pulgadas)
    const renderCompactView = () => (
        <div style={{
            height: '100dvh', // Usar dvh para móviles/tablets
            maxHeight: '-webkit-fill-available', // Fallback iOS
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f9fafb',
            overflow: 'hidden',
            position: 'fixed', // Fijar viewport
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '2px solid #e5e7eb',
                padding: '0.75rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                flexShrink: 0,
                zIndex: 10
            }}>
                <h1 style={{
                    fontSize: screenWidth <= 768 ? '1.25rem' : '1.5rem',
                    fontWeight: '700',
                    color: '#111827',
                    margin: 0,
                    textAlign: 'center'
                }}>
                    Punto de Venta
                </h1>
            </div>

            {/* Contenido principal - Alterna entre productos y orden */}
            {!showOrderDetails ? (
                // Vista de productos
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0, // Clave para que el scroll interno funcione en flex
                    overflow: 'hidden'
                }}>
                    {/* Filtros */}
                    <div style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '0.5rem',
                            paddingBottom: '0.25rem'
                        }}>
                            <button
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '12px',
                                    border: selectedCategory === 'all' ? 'none' : '1px solid #e2e8f0',
                                    backgroundColor: selectedCategory === 'all' ? '#4f46e5' : '#ffffff',
                                    color: selectedCategory === 'all' ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    minHeight: TOUCH_MIN_SIZE
                                }}
                                onClick={() => setSelectedCategory('all')}
                            >
                                Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '12px',
                                        border: selectedCategory === cat.id ? 'none' : '1px solid #e2e8f0',
                                        backgroundColor: selectedCategory === cat.id ? '#4f46e5' : '#ffffff',
                                        color: selectedCategory === cat.id ? '#ffffff' : '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setSelectedCategory(cat.id)}
                                >
                                    {cat.name.length > 12 ? cat.name.substring(0, 10) + '...' : cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid Productos */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0.75rem',
                        backgroundColor: '#f9fafb'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: screenWidth <= 768 ?
                                'repeat(auto-fill, minmax(140px, 1fr))' :
                                'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '0.75rem'
                        }}>
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '1px solid #e5e7eb',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                    }}
                                    onClick={() => addToCart(product)}
                                    onMouseEnter={screenWidth > 768 ? (e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                                        e.currentTarget.style.borderColor = '#4f46e5';
                                    } : undefined}
                                    onMouseLeave={screenWidth > 768 ? (e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                    } : undefined}
                                >
                                    <div style={{
                                        height: screenWidth <= 768 ? '80px' : '100px',
                                        backgroundColor: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.5rem'
                                    }}>
                                        {product.image ? (
                                            <img
                                                src={getCleanImageUrl(product.image)}
                                                alt={product.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = '/logo-aurora.png';
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
                                    <div style={{ padding: '0.5rem' }}>
                                        <h3 style={{
                                            fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                            fontWeight: '600',
                                            color: '#1f2937',
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {product.name}
                                        </h3>
                                        <p style={{
                                            fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
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
            ) : (
                // Vista de orden
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Header de orden */}
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        flexShrink: 0,
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{
                            fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                            fontWeight: '700',
                            color: '#111827',
                            margin: 0
                        }}>
                            Orden Actual ({cart.length})
                        </h3>
                        <button
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#4f46e5',
                                border: 'none',
                                borderRadius: '12px',
                                color: '#ffffff',
                                fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                minHeight: TOUCH_MIN_SIZE
                            }}
                            onClick={() => setShowOrderDetails(false)}
                        >
                            ← Productos
                        </button>
                    </div>

                    {/* Contenido del carrito */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {cart.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                color: '#9ca3af',
                                fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem'
                            }}>
                                <p style={{ margin: 0 }}>No hay productos en el carrito</p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                flex: 1
                            }}>
                                {cart.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '0.75rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {/* Información del producto */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{
                                                    fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                                    fontWeight: '600',
                                                    color: '#1f2937',
                                                    marginBottom: '0.25rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {item.name}
                                                </h4>
                                                <p style={{
                                                    fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
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
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ffffff'
                                                }}>
                                                    <button
                                                        style={{
                                                            width: screenWidth <= 768 ? '36px' : '40px',
                                                            height: screenWidth <= 768 ? '36px' : '40px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: screenWidth <= 768 ? '1rem' : '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item.product_id, -1)}
                                                    >
                                                        −
                                                    </button>
                                                    <span style={{
                                                        width: screenWidth <= 768 ? '30px' : '34px',
                                                        textAlign: 'center',
                                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                                        fontWeight: '600',
                                                        color: '#1f2937'
                                                    }}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        style={{
                                                            width: screenWidth <= 768 ? '36px' : '40px',
                                                            height: screenWidth <= 768 ? '36px' : '40px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: screenWidth <= 768 ? '1rem' : '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item.product_id, 1)}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button
                                                    style={{
                                                        width: screenWidth <= 768 ? '36px' : '40px',
                                                        height: screenWidth <= 768 ? '36px' : '40px',
                                                        backgroundColor: '#fee2e2',
                                                        border: '2px solid #fecaca',
                                                        borderRadius: '6px',
                                                        color: '#dc2626',
                                                        fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    title="Eliminar producto"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>

                                        {/* Nota del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '0.5rem',
                                            borderTop: '1px dashed #e5e7eb'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                {item.note ? (
                                                    <div style={{
                                                        fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                        color: '#6b7280',
                                                        fontStyle: 'italic',
                                                        backgroundColor: '#f3f4f6',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        <strong>Nota:</strong> {item.note}
                                                    </div>
                                                ) : (
                                                    <span style={{
                                                        fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                        color: '#9ca3af',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        Sin notas especiales
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    backgroundColor: item.note ? '#fef3c7' : '#f3f4f6',
                                                    border: `1px solid ${item.note ? '#fbbf24' : '#d1d5db'}`,
                                                    borderRadius: '4px',
                                                    color: item.note ? '#92400e' : '#374151',
                                                    fontSize: screenWidth <= 768 ? '0.75rem' : '0.8125rem',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    marginLeft: '0.5rem',
                                                    whiteSpace: 'nowrap',
                                                    minHeight: TOUCH_MIN_SIZE
                                                }}
                                                onClick={() => handleAddNote(item.product_id)}
                                            >
                                                {item.note ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-chat-left-text"></i> Editar
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-pencil"></i> Nota
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Sección de Pago y Facturación Directa en el POS (Compacto) */}
                                <div style={{
                                    marginTop: '1rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px solid #e2e8f0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <h4 style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        marginBottom: '0.125rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <i className="bi bi-wallet2 text-indigo-600"></i> Configuración de Pago
                                    </h4>

                                    {/* Mesa / Tipo de Orden */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem' }}>
                                            Mesa / Tipo de Orden
                                        </label>
                                        <select
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '8px',
                                                fontSize: '0.8125rem',
                                                color: '#1e293b',
                                                backgroundColor: '#ffffff'
                                            }}
                                            value={selectedTable}
                                            onChange={(e) => setSelectedTable(e.target.value)}
                                        >
                                            <option value="takeout">Para Llevar (Takeout)</option>
                                            {tables.map(table => (
                                                <option key={table.id} value={table.number} disabled={table.status !== 'available'}>
                                                    Mesa {table.number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Cliente Selector */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem' }}>
                                            Cliente
                                        </label>
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8125rem',
                                                        backgroundColor: '#ffffff'
                                                    }}
                                                    value={customerSearch}
                                                    onChange={(e) => searchCustomers(e.target.value)}
                                                />
                                                {customers.length > 0 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        zIndex: 2000,
                                                        width: '100%',
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                                        marginTop: '0.25rem',
                                                        maxHeight: '150px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        {customers.map(c => (
                                                            <div
                                                                key={c.id}
                                                                style={{
                                                                    padding: '0.5rem 0.75rem',
                                                                    cursor: 'pointer',
                                                                    borderBottom: '1px solid #f1f5f9',
                                                                    fontSize: '0.75rem'
                                                                }}
                                                                onClick={() => {
                                                                    setSelectedCustomer(c);
                                                                    setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                                    setCustomers([]);
                                                                }}
                                                            >
                                                                <strong>{c.first_name} {c.last_name}</strong>
                                                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{c.cedula}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    backgroundColor: '#4f46e5',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setShowCustomerModal(true)}
                                            >
                                                +
                                            </button>
                                        </div>
                                        {selectedCustomer && (
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginTop: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '6px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.75rem'
                                            }}>
                                                <span>{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCustomer(null);
                                                        setCustomerSearch('');
                                                    }}
                                                    style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold' }}
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Método de Pago */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem' }}>
                                            Método de Pago
                                        </label>
                                        <select
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '8px',
                                                fontSize: '0.8125rem',
                                                color: '#1e293b',
                                                backgroundColor: '#ffffff'
                                            }}
                                            value={selectedPaymentMethod}
                                            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                        >
                                            {paymentMethods.length > 0 ? (
                                                paymentMethods.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="cash-default">Efectivo</option>
                                                    <option value="card-default">Tarjeta</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Facturación SRI Switch */}
                                    <div className="flex items-center justify-between border-y border-slate-150 py-2 my-1">
                                        <div className="text-left">
                                            <span className="text-xs font-bold text-slate-700 block">Emitir Factura SRI</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={processSRI} 
                                                onChange={e => setProcessSRI(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    {/* Campos SRI Condicionales */}
                                    {processSRI && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2 text-left animate-in slide-in-from-top-4 duration-150">
                                            <div className="grid grid-cols-3 gap-1.5">
                                                <div>
                                                    <select 
                                                        value={billingIdentType} 
                                                        onChange={e => setBillingIdentType(e.target.value)}
                                                        className="w-full border border-slate-300 rounded p-1 text-[10px] bg-white text-slate-800"
                                                    >
                                                        <option value="07">C. Final</option>
                                                        <option value="05">Cédula</option>
                                                        <option value="04">RUC</option>
                                                        <option value="06">Pasaporte</option>
                                                        <option value="08">Exterior</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Identificación"
                                                        value={billingIdent}
                                                        onChange={e => setBillingIdent(e.target.value)}
                                                        className="w-full border border-slate-300 rounded p-1 text-[10px] text-slate-800 bg-white" 
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Razón Social / Nombre"
                                                value={billingName}
                                                onChange={e => setBillingName(e.target.value)}
                                                className="w-full border border-slate-300 rounded p-1 text-[10px] text-slate-800 bg-white" 
                                                required
                                            />
                                            <input 
                                                type="email" 
                                                placeholder="Email"
                                                value={billingEmail}
                                                onChange={e => setBillingEmail(e.target.value)}
                                                className="w-full border border-slate-300 rounded p-1 text-[10px] text-slate-800 bg-white" 
                                                required
                                            />
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <input 
                                                    type="text" 
                                                    placeholder="Teléfono"
                                                    value={billingPhone}
                                                    onChange={e => setBillingPhone(e.target.value)}
                                                    className="w-full border border-slate-300 rounded p-1 text-[10px] text-slate-800 bg-white" 
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Dirección"
                                                    value={billingAddress}
                                                    onChange={e => setBillingAddress(e.target.value)}
                                                    className="w-full border border-slate-300 rounded p-1 text-[10px] text-slate-800 bg-white" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Calculadora de Vuelto Compacta */}
                                    <div style={{
                                        padding: '0.5rem',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyStyle: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                                                Efectivo Recibido:
                                            </span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                style={{
                                                    width: '80px',
                                                    padding: '0.25rem',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8125rem',
                                                    textAlign: 'right'
                                                }}
                                                value={inputCash}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputCash(val);
                                                    setCashGiven(val ? parseFloat(val) : null);
                                                }}
                                            />
                                        </div>
                                        {cashGiven !== null && (
                                            <div style={{
                                                paddingTop: '0.25rem',
                                                borderTop: '1px dashed #cbd5e1',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.75rem',
                                                fontWeight: '700'
                                            }}>
                                                <span style={{ color: '#475569' }}>Vuelto:</span>
                                                <span style={{ color: (cashGiven - calculateTotal) < 0 ? '#ef4444' : '#10b981' }}>
                                                    {formatCurrency(cashGiven - calculateTotal)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Totales y Botones */}
                        {cart.length > 0 && (
                            <div style={{
                                marginTop: 'auto',
                                paddingTop: '1rem',
                                borderTop: '2px solid #e5e7eb'
                            }}>
                                {/* Totales */}
                                <div style={{
                                    paddingBottom: '1rem',
                                    marginBottom: '0.75rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.5rem',
                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                        color: '#6b7280'
                                    }}>
                                        <span>Subtotal</span>
                                        <span style={{ fontWeight: '600' }}>{formatCurrency(calculateSubtotal)}</span>
                                    </div>

                                    {appliedDiscount && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.5rem',
                                            fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
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
                                        paddingTop: '0.75rem',
                                        borderTop: '2px solid #e5e7eb',
                                        fontSize: screenWidth <= 768 ? '1.25rem' : '1.5rem',
                                        fontWeight: '700',
                                        color: '#111827'
                                    }}>
                                        <span>Total</span>
                                        <span style={{ color: '#059669' }}>{formatCurrency(calculateTotal)}</span>
                                    </div>
                                </div>

                                {/* Botones principales */}
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: processingOrder ? '#d1d5db' : '#4f46e5',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        fontSize: screenWidth <= 768 ? '1rem' : '1.125rem',
                                        fontWeight: '700',
                                        cursor: processingOrder ? 'not-allowed' : 'pointer',
                                        marginBottom: '0.5rem',
                                        boxShadow: processingOrder ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.2)',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={finalPlaceOrder}
                                    disabled={processingOrder}
                                >
                                    {processingOrder ? 'Procesando...' : 'Confirmar y Pagar'}
                                </button>

                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        color: '#475569',
                                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={handleOpenCashDrawer}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <i className="bi bi-unlock"></i> Abrir Caja
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Barra inferior con botones */}
            <div style={{
                backgroundColor: '#ffffff',
                borderTop: '2px solid #e5e7eb',
                padding: '0.5rem',
                display: 'flex',
                gap: '0.5rem',
                flexShrink: 0
            }}>
                <button
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: showOrderDetails ? '#e5e7eb' : '#4f46e5',
                        border: 'none',
                        borderRadius: '12px',
                        color: showOrderDetails ? '#374151' : '#ffffff',
                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: TOUCH_MIN_SIZE
                    }}
                    onClick={() => setShowOrderDetails(false)}
                >
                    Productos
                </button>
                <button
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        backgroundColor: !showOrderDetails ? '#e5e7eb' : '#4f46e5',
                        border: 'none',
                        borderRadius: '12px',
                        color: !showOrderDetails ? '#374151' : '#ffffff',
                        fontSize: screenWidth <= 768 ? '0.875rem' : '0.9375rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        minHeight: TOUCH_MIN_SIZE,
                        position: 'relative'
                    }}
                    onClick={() => setShowOrderDetails(true)}
                >
                    Orden {cart.length > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-5px',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    // Renderizar vista de escritorio dividida (para pantallas > 1366px - más de 16 pulgadas)
    const renderDesktopView = () => (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f9fafb',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '2px solid #e5e7eb',
                padding: '1rem 1.5rem',
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

            <div style={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                flexDirection: 'row'
            }}>
                {/* Panel Izquierdo: Catálogo */}
                <div style={{
                    flex: '1 1 60%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#ffffff',
                    borderRight: '2px solid #e5e7eb',
                    minHeight: 'auto'
                }}>
                    {/* Filtros */}
                    <div style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        flexShrink: 0
                    }}>
                        <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            overflowX: 'auto',
                            paddingBottom: '0.25rem'
                        }}>
                            <button
                                style={{
                                    padding: '0.625rem 1.25rem',
                                    borderRadius: '12px',
                                    border: selectedCategory === 'all' ? 'none' : '1px solid #e2e8f0',
                                    backgroundColor: selectedCategory === 'all' ? '#4f46e5' : '#ffffff',
                                    color: selectedCategory === 'all' ? '#ffffff' : '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    boxShadow: selectedCategory === 'all' ? '0 4px 12px rgba(79, 70, 229, 0.2)' : 'none',
                                    minHeight: TOUCH_MIN_SIZE
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
                                        borderRadius: '12px',
                                        border: selectedCategory === cat.id ? 'none' : '1px solid #e2e8f0',
                                        backgroundColor: selectedCategory === cat.id ? '#4f46e5' : '#ffffff',
                                        color: selectedCategory === cat.id ? '#ffffff' : '#374151',
                                        fontWeight: '600',
                                        fontSize: '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        boxShadow: selectedCategory === cat.id ? '0 4px 12px rgba(79, 70, 229, 0.2)' : 'none',
                                        minHeight: TOUCH_MIN_SIZE
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
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: '1rem'
                        }}>
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '1px solid #f1f5f9',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                                    }}
                                    onClick={() => addToCart(product)}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.1)';
                                        e.currentTarget.style.borderColor = '#4f46e5';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                                        e.currentTarget.style.borderColor = '#f1f5f9';
                                    }}
                                >
                                    <div style={{
                                        height: '140px',
                                        backgroundColor: '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0.75rem'
                                    }}>
                                        {product.image ? (
                                            <img
                                                src={getCleanImageUrl(product.image)}
                                                alt={product.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain'
                                                }}
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = '/logo-aurora.png';
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

                {/* Panel Derecho: Orden Actual */}
                <div style={{
                    flex: '0 0 400px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
                    flexShrink: 0
                }}>
                    {/* Header de Orden Actual */}
                    <div style={{
                        padding: '1.25rem 1.5rem',
                        backgroundColor: '#ffffff',
                        flexShrink: 0,
                        borderBottom: '1px solid #f1f5f9'
                    }}>
                        <h3 style={{
                            fontSize: '1.125rem',
                            fontWeight: '800',
                            color: '#0f172a',
                            margin: 0
                        }}>
                            Orden Actual
                        </h3>
                    </div>

                    {/* Contenido del Carrito */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {cart.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem 1rem',
                                color: '#9ca3af',
                                fontSize: '0.875rem'
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
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                flex: 1
                            }}>
                                {cart.map((item, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #f1f5f9',
                                            borderRadius: '14px',
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                        }}
                                    >
                                        {/* Información del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '0.75rem'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{
                                                    fontSize: '0.9375rem',
                                                    fontWeight: '600',
                                                    color: '#1f2937',
                                                    marginBottom: '0.375rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
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
                                                            width: '36px',
                                                            height: '36px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item.product_id, -1)}
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
                                                            width: '36px',
                                                            height: '36px',
                                                            border: 'none',
                                                            backgroundColor: 'transparent',
                                                            color: '#6b7280',
                                                            fontSize: '1.25rem',
                                                            fontWeight: '600',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onClick={() => updateQuantity(item.product_id, 1)}
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <button
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        backgroundColor: '#fee2e2',
                                                        border: '2px solid #fecaca',
                                                        borderRadius: '8px',
                                                        color: '#dc2626',
                                                        fontSize: '1.125rem',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    title="Eliminar producto"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>

                                        {/* Nota del producto */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '0.75rem',
                                            borderTop: '1px dashed #e5e7eb'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                {item.note ? (
                                                    <div style={{
                                                        fontSize: '0.8125rem',
                                                        color: '#6b7280',
                                                        fontStyle: 'italic',
                                                        backgroundColor: '#f3f4f6',
                                                        padding: '0.375rem 0.75rem',
                                                        borderRadius: '4px',
                                                        wordBreak: 'break-word'
                                                    }}>
                                                        <strong>Nota:</strong> {item.note}
                                                    </div>
                                                ) : (
                                                    <span style={{
                                                        fontSize: '0.8125rem',
                                                        color: '#9ca3af',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        Sin notas especiales
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                style={{
                                                    padding: '0.375rem 0.75rem',
                                                    backgroundColor: item.note ? '#fef3c7' : '#f3f4f6',
                                                    border: `1px solid ${item.note ? '#fbbf24' : '#d1d5db'}`,
                                                    borderRadius: '4px',
                                                    color: item.note ? '#92400e' : '#374151',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: '500',
                                                    cursor: 'pointer',
                                                    marginLeft: '0.5rem',
                                                    whiteSpace: 'nowrap',
                                                    minHeight: TOUCH_MIN_SIZE,
                                                    minWidth: '60px'
                                                }}
                                                onClick={() => handleAddNote(item.product_id)}
                                                title={item.note ? "Editar nota" : "Agregar nota"}
                                            >
                                                {item.note ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-chat-left-text"></i> Editar
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <i className="bi bi-pencil"></i> Nota
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Sección de Pago y Facturación Directa en el POS (Desktop) */}
                                <div style={{
                                    marginTop: '1.5rem',
                                    paddingTop: '1.5rem',
                                    borderTop: '1px solid #cbd5e1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <h4 style={{
                                        fontSize: '1rem',
                                        fontWeight: '850',
                                        color: '#0f172a',
                                        marginBottom: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <i className="bi bi-wallet2 text-indigo-650"></i> Configuración de Pago
                                    </h4>

                                    {/* Mesa / Tipo de Orden */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: '#475569', marginBottom: '0.375rem' }}>
                                            Mesa / Tipo de Orden
                                        </label>
                                        <select
                                            style={{
                                                width: '100%',
                                                padding: '0.625rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                fontSize: '0.875rem',
                                                color: '#1e293b',
                                                backgroundColor: '#ffffff'
                                            }}
                                            value={selectedTable}
                                            onChange={(e) => setSelectedTable(e.target.value)}
                                        >
                                            <option value="takeout">Para Llevar (Takeout)</option>
                                            {tables.map(table => (
                                                <option key={table.id} value={table.number} disabled={table.status !== 'available'}>
                                                    Mesa {table.number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Cliente Selector */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: '#475569', marginBottom: '0.375rem' }}>
                                            Cliente
                                        </label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.625rem',
                                                        border: '1px solid #cbd5e1',
                                                        borderRadius: '10px',
                                                        fontSize: '0.875rem',
                                                        backgroundColor: '#ffffff'
                                                    }}
                                                    value={customerSearch}
                                                    onChange={(e) => searchCustomers(e.target.value)}
                                                />
                                                {customers.length > 0 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        zIndex: 2000,
                                                        width: '100%',
                                                        backgroundColor: '#ffffff',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '10px',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                                        marginTop: '0.25rem',
                                                        maxHeight: '150px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        {customers.map(c => (
                                                            <div
                                                                key={c.id}
                                                                style={{
                                                                    padding: '0.625rem 0.875rem',
                                                                    cursor: 'pointer',
                                                                    borderBottom: '1px solid #f1f5f9',
                                                                    fontSize: '0.8125rem'
                                                                }}
                                                                onClick={() => {
                                                                    setSelectedCustomer(c);
                                                                    setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                                    setCustomers([]);
                                                                }}
                                                            >
                                                                <strong>{c.first_name} {c.last_name}</strong>
                                                                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{c.cedula}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    backgroundColor: '#4f46e5',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontSize: '1.25rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={() => setShowCustomerModal(true)}
                                            >
                                                +
                                            </button>
                                        </div>
                                        {selectedCustomer && (
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginTop: '0.375rem',
                                                padding: '0.375rem 0.75rem',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.8125rem'
                                            }}>
                                                <span>{selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedCustomer(null);
                                                        setCustomerSearch('');
                                                    }}
                                                    style={{ border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}
                                                >
                                                    Quitar
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Método de Pago */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', color: '#475569', marginBottom: '0.375rem' }}>
                                            Método de Pago
                                        </label>
                                        <select
                                            style={{
                                                width: '100%',
                                                padding: '0.625rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                fontSize: '0.875rem',
                                                color: '#1e293b',
                                                backgroundColor: '#ffffff'
                                            }}
                                            value={selectedPaymentMethod}
                                            onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                        >
                                            {paymentMethods.length > 0 ? (
                                                paymentMethods.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="cash-default">Efectivo</option>
                                                    <option value="card-default">Tarjeta</option>
                                                </>
                                            )}
                                        </select>
                                    </div>

                                    {/* Facturación SRI Switch */}
                                    <div className="flex items-center justify-between border-y border-slate-150 py-3 my-1">
                                        <div className="text-left">
                                            <span className="text-sm font-bold text-slate-700 block">Emitir Factura SRI</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={processSRI} 
                                                onChange={e => setProcessSRI(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>

                                    {/* Campos SRI Condicionales */}
                                    {processSRI && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-left animate-in slide-in-from-top-4 duration-150">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <select 
                                                        value={billingIdentType} 
                                                        onChange={e => setBillingIdentType(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white text-slate-800"
                                                    >
                                                        <option value="07">C. Final</option>
                                                        <option value="05">Cédula</option>
                                                        <option value="04">RUC</option>
                                                        <option value="06">Pasaporte</option>
                                                        <option value="08">Exterior</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Identificación"
                                                        value={billingIdent}
                                                        onChange={e => setBillingIdent(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 bg-white" 
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Razón Social / Nombre"
                                                value={billingName}
                                                onChange={e => setBillingName(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 bg-white" 
                                                required
                                            />
                                            <input 
                                                type="email" 
                                                placeholder="Email"
                                                value={billingEmail}
                                                onChange={e => setBillingEmail(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 bg-white" 
                                                required
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Teléfono"
                                                    value={billingPhone}
                                                    onChange={e => setBillingPhone(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 bg-white" 
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Dirección"
                                                    value={billingAddress}
                                                    onChange={e => setBillingAddress(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 bg-white" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Calculadora de Vuelto Compacta */}
                                    <div style={{
                                        padding: '0.75rem',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.375rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#475569' }}>
                                                Efectivo Recibido:
                                            </span>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                style={{
                                                    width: '100px',
                                                    padding: '0.375rem',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    textAlign: 'right'
                                                }}
                                                value={inputCash}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setInputCash(val);
                                                    setCashGiven(val ? parseFloat(val) : null);
                                                }}
                                            />
                                        </div>
                                        {cashGiven !== null && (
                                            <div style={{
                                                paddingTop: '0.375rem',
                                                borderTop: '1px dashed #cbd5e1',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: '0.8125rem',
                                                fontWeight: '700'
                                            }}>
                                                <span style={{ color: '#475569' }}>Vuelto:</span>
                                                <span style={{ color: (cashGiven - calculateTotal) < 0 ? '#ef4444' : '#10b981' }}>
                                                    {formatCurrency(cashGiven - calculateTotal)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Totales y Botones - SOLO se muestra cuando hay productos */}
                        {cart.length > 0 && (
                            <div style={{
                                marginTop: 'auto',
                                paddingTop: '1.5rem',
                                borderTop: '2px solid #e5e7eb'
                            }}>
                                {/* Totales */}
                                <div style={{
                                    paddingBottom: '1rem',
                                    marginBottom: '1rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: '0.5rem',
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
                                            marginBottom: '0.5rem',
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
                                        padding: '1rem',
                                        backgroundColor: processingOrder ? '#d1d5db' : '#4f46e5',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        fontSize: '1.125rem',
                                        fontWeight: '700',
                                        cursor: processingOrder ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: processingOrder ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.25)',
                                        marginBottom: '0.75rem',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={finalPlaceOrder}
                                    disabled={processingOrder}
                                >
                                    {processingOrder ? 'Procesando pedido...' : 'Confirmar y Pagar'}
                                </button>

                                {/* 🔓 Botón Abrir Caja */}
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        color: '#475569',
                                        fontSize: '0.9375rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={handleOpenCashDrawer}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <i className="bi bi-unlock"></i> Abrir Caja Registradora
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
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
    // 11. ESTRUCTURA PRINCIPAL CON RESPONSIVIDAD
    // =====================================

    // 1366px es aproximadamente el ancho de pantallas de 15.6" o menos
    const isSmallScreen = screenWidth <= 1366;

    return (
        <>
            {/* Vista responsiva basada en el tamaño de pantalla */}
            {isSmallScreen ? renderCompactView() : renderDesktopView()}

            {/* Modal para agregar nota */}
            {editingNoteForItem && renderNoteModal()}

            {/* Modal Confirmación (Desactivado para integración inline directa) */}
            {false && showReviewModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                            <div className="text-left">
                                <h3 className="text-base font-extrabold text-slate-900">Confirmación de Orden</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Revisa la orden y selecciona el método de pago.</p>
                            </div>
                            <button className="text-slate-400 hover:text-slate-650 bg-slate-50 hover:bg-slate-100 border-none rounded-xl w-8 h-8 text-xl font-medium flex items-center justify-center cursor-pointer transition-colors" onClick={() => setShowReviewModal(false)}>×</button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-6 bg-slate-50/50">
                            {renderReviewDetails()}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-150 flex gap-2.5 justify-end bg-white">
                            <button className="bg-slate-100 hover:bg-slate-200 text-slate-750 border-none px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer" onClick={() => setShowReviewModal(false)}>Editar Pedido</button>
                            <button className="bg-emerald-650 hover:bg-emerald-700 text-white border-none px-6 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer" onClick={finalPlaceOrder} disabled={processingOrder}>
                                {processingOrder ? 'Procesando...' : 'Confirmar y Pagar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Cliente (Compartido) */}
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
                    zIndex: 10000,
                    padding: isSmallScreen ? '0.5rem' : '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: isSmallScreen ? '95%' : '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{
                            padding: isSmallScreen ? '1rem' : '1.5rem',
                            borderBottom: '2px solid #e5e7eb',
                            backgroundColor: '#fafafa'
                        }}>
                            <h3 style={{
                                fontSize: isSmallScreen ? '1.25rem' : '1.5rem',
                                fontWeight: '700',
                                color: '#111827',
                                margin: 0
                            }}>
                                Nuevo Cliente
                            </h3>
                        </div>

                        <form onSubmit={handleCreateCustomer} style={{ padding: isSmallScreen ? '1rem' : '1.5rem' }}>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.75rem',
                                marginBottom: '1rem'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                            padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box',
                                            minHeight: TOUCH_MIN_SIZE
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                            padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                            transition: 'all 0.2s',
                                            boxSizing: 'border-box',
                                            minHeight: TOUCH_MIN_SIZE
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: isSmallScreen ? '0.875rem' : '0.875rem',
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
                                        padding: isSmallScreen ? '0.5rem' : '0.75rem',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        transition: 'all 0.2s',
                                        boxSizing: 'border-box',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                />
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                justifyContent: 'flex-end',
                                borderTop: '2px solid #e5e7eb',
                                paddingTop: '1rem'
                            }}>
                                <button
                                    type="button"
                                    style={{
                                        padding: isSmallScreen ? '0.5rem 1rem' : '0.75rem 1.5rem',
                                        backgroundColor: '#ffffff',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        color: '#374151',
                                        fontWeight: '600',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                    onClick={() => setShowCustomerModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: isSmallScreen ? '0.5rem 1rem' : '0.75rem 1.5rem',
                                        backgroundColor: '#8b5cf6',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: '600',
                                        fontSize: isSmallScreen ? '0.875rem' : '0.9375rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minHeight: TOUCH_MIN_SIZE
                                    }}
                                >
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default PuntosVenta;