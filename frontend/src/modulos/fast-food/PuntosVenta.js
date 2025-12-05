import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

const PuntosVenta = () => {
    // [Sección 1. ESTADO DE DATOS Y CARGA - CORRECCIÓN EN loading]
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [tables, setTables] = useState([]);
    // ERROR CORREGIDO: Se cambia '= true)' a '= useState(true)'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingOrder, setProcessingOrder] = useState(false);

    // [Sección 2. ESTADO DEL PUNTO DE VENTA - Sin cambios]
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [discountCode, setDiscountCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(null);

    // [Sección 3. ESTADO DE CLIENTES - Sin cambios]
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
        city: ''
    });

    // [Sección 4. EFECTOS - CARGA INICIAL DE DATOS - Sin cambios]
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, categoriesRes, tablesRes] = await Promise.all([
                    api.get('/api/menu/products/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }),
                    api.get('/api/menu/categories/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }),
                    api.get('/api/pos/tables/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE })
                ]);
                setProducts(productsRes.data.results || productsRes.data || []);
                setCategories(categoriesRes.data.results || categoriesRes.data || []);
                setTables(tablesRes.data.results || tablesRes.data || []);
            } catch (err) {
                console.error('Error loading POS data:', err);
                setError('Error al cargar datos del POS');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // [Sección 5. LÓGICA DEL CARRITO - Sin cambios]
    const addToCart = useCallback((product) => { /* ... lógica sin cambios ... */
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

    const removeFromCart = useCallback((productId) => { /* ... lógica sin cambios ... */
        setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
    }, []);

    const updateQuantity = useCallback((productId, delta) => { /* ... lógica sin cambios ... */
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

    // [Sección 6. CÁLCULOS DE PRECIOS - Sin cambios]
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
        return (subtotal - discount).toFixed(2);
    }, [calculateSubtotal, calculateDiscountAmount]);

    // [Sección 7. LÓGICA DE DESCUENTOS - Sin cambios]
    const handleApplyDiscount = async () => { /* ... lógica sin cambios ... */
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

    // [Sección 8. LÓGICA DE CLIENTES - Sin cambios de lógica]
    const searchCustomers = async (query) => { /* ... lógica sin cambios ... */
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

    const handleCreateCustomer = async (e) => { /* ... lógica sin cambios ... */
        e.preventDefault();
        try {
            const response = await api.post('/api/customers/register/', newCustomer, {
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
                city: ''
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

    // [Sección 9. LÓGICA DE FILTRADO Y PROCESAMIENTO - Sin cambios]
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchTerm]);

    const handlePlaceOrder = async () => { /* ... lógica sin cambios ... */
        if (cart.length === 0) return;
        if (!selectedTable && selectedTable !== 'takeout') {
            alert('Por favor seleccione una mesa o "Para Llevar"');
            return;
        }

        setProcessingOrder(true);

        const orderPayload = {
            order_type: selectedTable === 'takeout' ? 'takeout' : 'dine_in',
            table_number: selectedTable === 'takeout' ? "" : selectedTable,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity
            })),
            discount_code: appliedDiscount ? appliedDiscount.code : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null
        };

        try {
            await api.post('/api/orders/orders/', orderPayload, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            alert('¡Orden creada exitosamente!');
            setCart([]);
            setAppliedDiscount(null);
            setDiscountCode('');
            setSelectedTable('');
            setSelectedCustomer(null);
            setCustomerSearch('');
        } catch (err) {
            console.error('Error placing order:', err);
            const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la orden';
            alert(`Error: ${errorMsg}`);
        } finally {
            setProcessingOrder(false);
        }
    };

    // [Sección 10. RENDERIZADO CONDICIONAL - Sin cambios]
    if (loading) return <div className="p-4">Cargando POS...</div>;

    // =====================================
    // 11. ESTRUCTURA PRINCIPAL DEL POS - Sin cambios de estilo después de la corrección
    // =====================================

    return (
        <div className="page-container" style={{ height: 'calc(100vh - 64px)', padding: 0, maxWidth: 'none' }}>

            {/* Barra Superior */}
            <div className="page-header" style={{ padding: '1rem', margin: 0 }}>
                <h2>Punto de Venta</h2>
            </div>

            <div style={{ display: 'flex', height: 'calc(100% - 70px)' }}>

                {/* Panel Izquierdo: Productos */}
                <div className="w-2/3 p-4 overflow-y-auto" style={{ flex: '2', padding: '1rem', overflowY: 'auto', borderRight: '1px solid #ddd' }}>

                    {/* Filtros de Categoría */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        <button
                            className={`btn ${selectedCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedCategory('all')}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Grid de Productos */}
                    <div
                        className="dashboard-grid"
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}
                    >
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                className="card"
                                style={{
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'transform 0.2s',
                                    height: 'fit-content',
                                    borderRadius: '8px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                onClick={() => addToCart(product)}
                            >
                                {product.image ? (
                                    <img
                                        src={product.image.startsWith('http') ? product.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${product.image}`}
                                        alt={product.name}
                                        style={{
                                            width: '100%',
                                            height: '80px',
                                            // CLAVE: object-fit: contain para mostrar la imagen completa.
                                            objectFit: 'contain',
                                            borderRadius: '4px',
                                            marginBottom: '0.25rem',
                                            backgroundColor: '#f1f5f9'
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{ width: '100%', height: '80px', backgroundColor: '#f1f5f9', borderRadius: '4px', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}
                                    >
                                        Sin imagen
                                    </div>
                                )}
                                <h3 style={{ fontSize: '0.875rem', marginBottom: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</h3>
                                <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>${product.price}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel Derecho: Carrito y Resumen - Sin cambios */}
                <div className="w-1/3 bg-white border-l p-4 flex flex-col" style={{ flex: '1', backgroundColor: 'white', borderLeft: '1px solid #ddd', padding: '1rem', display: 'flex', flexDirection: 'column' }}>

                    {/* Selección de Mesa */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mesa / Tipo de Orden</label>
                        <select
                            className="w-full border rounded p-2"
                            value={selectedTable}
                            onChange={(e) => setSelectedTable(e.target.value)}
                        >
                            <option value="">Seleccionar...</option>
                            <option value="takeout">🥡 Para Llevar</option>
                            {tables.map(table => (
                                <option key={table.id} value={table.number} disabled={table.status !== 'available'}>
                                    Mesa {table.number} {table.status !== 'available' ? '(Ocupada)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selección de Cliente */}
                    <div className="mb-4 border-b pb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                        <div className="flex gap-2 mb-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    className="w-full border rounded p-2"
                                    value={customerSearch}
                                    onChange={(e) => searchCustomers(e.target.value)}
                                />
                                {customers.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                        {customers.map(c => (
                                            <div
                                                key={c.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                    setCustomers([]);
                                                }}
                                            >
                                                {c.first_name} {c.last_name} ({c.email})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700"
                                onClick={() => setShowCustomerModal(true)}
                            >
                                +
                            </button>
                        </div>
                        {selectedCustomer && (
                            <div className="text-sm text-blue-600 flex justify-between items-center bg-blue-50 p-2 rounded">
                                <span>Cliente: {selectedCustomer.first_name} {selectedCustomer.last_name}</span>
                                <button
                                    className="text-red-500 hover:text-red-700 font-bold"
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setCustomerSearch('');
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    <h2 className="text-xl font-bold mb-4 border-b pb-2">Orden Actual</h2>

                    <div className="flex-1 overflow-y-auto mb-4" style={{ flex: '1', overflowY: 'auto', marginBottom: '1rem' }}>
                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-center mt-10">El carrito está vacío</p>
                        ) : (
                            cart.map((item, index) => (
                                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <p style={{ fontWeight: '500' }}>{item.name}</p>
                                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>${item.price.toFixed(2)} x {item.quantity}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => updateQuantity(item.product_id, -1)}
                                            style={{ padding: '0.25rem 0.5rem' }}
                                        >
                                            -
                                        </button>
                                        <span style={{ fontWeight: '500', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => updateQuantity(item.product_id, 1)}
                                            style={{ padding: '0.25rem 0.5rem' }}
                                        >
                                            +
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => removeFromCart(item.product_id)}
                                            style={{ padding: '0.25rem 0.5rem', marginLeft: '0.5rem' }}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Descuentos */}
                    <div className="mb-4 border-t pt-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Código de Descuento"
                                className="border rounded p-2 flex-1"
                                value={discountCode}
                                onChange={(e) => setDiscountCode(e.target.value)}
                            />
                            <button
                                onClick={handleApplyDiscount}
                                className="bg-gray-200 px-3 rounded hover:bg-gray-300"
                            >
                                Aplicar
                            </button>
                        </div>
                        {appliedDiscount && (
                            <div className="text-green-600 text-sm mt-1">
                                Descuento aplicado: {appliedDiscount.name}
                            </div>
                        )}
                    </div>

                    {/* Resumen de Totales y Botón de Orden */}
                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                        <div className="flex justify-between mb-2">
                            <span>Subtotal:</span>
                            <span>${calculateSubtotal.toFixed(2)}</span>
                        </div>
                        {appliedDiscount && (
                            <div className="flex justify-between mb-2 text-green-600">
                                <span>Descuento:</span>
                                <span>-${calculateDiscountAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                            <span>Total:</span>
                            <span>${calculateTotal}</span>
                        </div>

                        <button
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '1.125rem',
                                backgroundColor: cart.length === 0 || processingOrder ? '#9ca3af' : '#16a34a',
                                cursor: cart.length === 0 || processingOrder ? 'not-allowed' : 'pointer',
                                border: 'none'
                            }}
                            onClick={handlePlaceOrder}
                            disabled={cart.length === 0 || processingOrder}
                        >
                            {processingOrder ? 'Procesando...' : 'Confirmar Pedido'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Crear Cliente */}
            {
                showCustomerModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Nuevo Cliente</h3>
                            <form onSubmit={handleCreateCustomer}>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={newCustomer.email}
                                        onChange={handleInputChange}
                                        required
                                        className="form-control"
                                    />
                                </div>
                                <div className="row">
                                    <div className="col-6">
                                        <div className="form-group">
                                            <label>Nombre</label>
                                            <input
                                                type="text"
                                                name="first_name"
                                                value={newCustomer.first_name}
                                                onChange={handleInputChange}
                                                required
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="form-group">
                                            <label>Apellido</label>
                                            <input
                                                type="text"
                                                name="last_name"
                                                value={newCustomer.last_name}
                                                onChange={handleInputChange}
                                                required
                                                className="form-control"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Teléfono</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={newCustomer.phone}
                                        onChange={handleInputChange}
                                        className="form-control"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ciudad</label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={newCustomer.city}
                                        onChange={handleInputChange}
                                        className="form-control"
                                    />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default PuntosVenta;