import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const PuntosVenta = () => {
    // Estado de datos
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estado del POS
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [processingOrder, setProcessingOrder] = useState(false);

    // Cargar datos iniciales
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, categoriesRes] = await Promise.all([
                    api.get('/api/menu/products/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE }),
                    api.get('/api/menu/categories/', { baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE })
                ]);
                setProducts(productsRes.data.results || productsRes.data || []);
                setCategories(categoriesRes.data.results || categoriesRes.data || []);
            } catch (err) {
                console.error('Error loading POS data:', err);
                setError('Error al cargar productos y categorías');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Lógica del Carrito
    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItemIndex = prevCart.findIndex(item => item.product_id === product.id);
            if (existingItemIndex >= 0) {
                const newCart = [...prevCart];
                newCart[existingItemIndex].quantity += 1;
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
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
    };

    const updateQuantity = (productId, delta) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.product_id === productId) {
                    const newQuantity = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
    };

    // Filtrado de productos
    const filteredProducts = products.filter(product => {
        const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Enviar Orden
    const handlePlaceOrder = async () => {
        if (cart.length === 0) return;
        setProcessingOrder(true);

        const orderPayload = {
            order_type: 'dine_in', // Por defecto para POS
            table_number: 'POS-01', // Mesa genérica para venta rápida
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity
            }))
        };

        try {
            await api.post('/api/orders/orders/', orderPayload, {
                baseURL: process.env.REACT_APP_FAST_FOOD_SERVICE
            });
            alert('¡Orden creada exitosamente!');
            setCart([]); // Limpiar carrito
        } catch (err) {
            console.error('Error placing order:', err);
            const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la orden. Intente nuevamente.';
            alert(`Error: ${errorMsg}`);
        } finally {
            setProcessingOrder(false);
        }
    };

    if (loading) return <div className="p-4">Cargando POS...</div>;
    if (error) return <div className="p-4 text-red-500">{error}</div>;

    return (
        <div className="flex h-screen bg-gray-100" style={{ height: 'calc(100vh - 64px)', display: 'flex' }}>
            {/* Panel Izquierdo: Productos */}
            <div className="w-2/3 p-4 overflow-y-auto" style={{ flex: '2', padding: '1rem', overflowY: 'auto', borderRight: '1px solid #ddd' }}>

                {/* Filtros */}
                <div className="mb-4 flex gap-2 overflow-x-auto pb-2" style={{ display: 'flex', gap: '10px', marginBottom: '1rem', overflowX: 'auto' }}>
                    <button
                        className={`px-4 py-2 rounded-full ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '9999px',
                            border: '1px solid #ddd',
                            backgroundColor: selectedCategory === 'all' ? '#007bff' : 'white',
                            color: selectedCategory === 'all' ? 'white' : '#333',
                            cursor: 'pointer'
                        }}
                        onClick={() => setSelectedCategory('all')}
                    >
                        Todos
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            className={`px-4 py-2 rounded-full whitespace-nowrap ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '9999px',
                                border: '1px solid #ddd',
                                backgroundColor: selectedCategory === cat.id ? '#007bff' : 'white',
                                color: selectedCategory === cat.id ? 'white' : '#333',
                                cursor: 'pointer'
                            }}
                            onClick={() => setSelectedCategory(cat.id)}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Grid de Productos */}
                <div className="grid grid-cols-3 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="bg-white rounded-lg shadow p-3 cursor-pointer hover:shadow-lg transition-shadow"
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                textAlign: 'center'
                            }}
                            onClick={() => addToCart(product)}
                        >
                            {product.image ? (
                                <img
                                    src={product.image.startsWith('http') ? product.image : `${process.env.REACT_APP_FAST_FOOD_SERVICE}${product.image}`}
                                    alt={product.name}
                                    className="w-full h-32 object-cover rounded-md mb-2"
                                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '0.375rem', marginBottom: '0.5rem' }}
                                />
                            ) : (
                                <div className="w-full h-32 bg-gray-200 rounded-md mb-2 flex items-center justify-center text-gray-400"
                                    style={{ width: '100%', height: '120px', backgroundColor: '#e5e7eb', borderRadius: '0.375rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Sin imagen
                                </div>
                            )}
                            <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                            <p className="text-blue-600 font-bold">${product.price}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Panel Derecho: Carrito */}
            <div className="w-1/3 bg-white border-l p-4 flex flex-col" style={{ flex: '1', backgroundColor: 'white', borderLeft: '1px solid #ddd', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Orden Actual</h2>

                <div className="flex-1 overflow-y-auto mb-4" style={{ flex: '1', overflowY: 'auto', marginBottom: '1rem' }}>
                    {cart.length === 0 ? (
                        <p className="text-gray-500 text-center mt-10">El carrito está vacío</p>
                    ) : (
                        cart.map((item, index) => (
                            <div key={index} className="flex justify-between items-center mb-3 p-2 bg-gray-50 rounded" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.25rem' }}>
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-gray-500">${item.price} x {item.quantity}</p>
                                </div>
                                <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                        onClick={() => updateQuantity(item.product_id, -1)}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e5e7eb', border: 'none', cursor: 'pointer' }}
                                    >
                                        -
                                    </button>
                                    <span className="font-medium w-4 text-center">{item.quantity}</span>
                                    <button
                                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                        onClick={() => updateQuantity(item.product_id, 1)}
                                        style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e5e7eb', border: 'none', cursor: 'pointer' }}
                                    >
                                        +
                                    </button>
                                    <button
                                        className="text-red-500 ml-2 hover:text-red-700"
                                        onClick={() => removeFromCart(item.product_id)}
                                        style={{ marginLeft: '0.5rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="border-t pt-4" style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                    <div className="flex justify-between text-xl font-bold mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                        <span>Total:</span>
                        <span>${calculateTotal()}</span>
                    </div>

                    <button
                        className={`w-full py-3 rounded-lg text-white font-bold text-lg ${cart.length === 0 || processingOrder ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
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
    );
};

export default PuntosVenta;
