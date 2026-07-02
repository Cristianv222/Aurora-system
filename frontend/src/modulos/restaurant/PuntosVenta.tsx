import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import printerServiceRestaurant from '../../services/printerServiceRestaurant';
import { useLocation, useNavigate } from 'react-router-dom';
import TableCroquis from './TableCroquis';
import { getCleanImageUrl } from '../../utils/image';
import { Table, Product, Category, Customer } from '../../types';

// ====================================================================
// 1. Interfaces & Types
// ====================================================================
interface CartItem {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
    note: string;
    is_paid?: boolean;
    saved_quantity?: number;
}

interface SentItemRound {
    destination: string;
    timestamp: string;
    items: CartItem[];
}

interface PaymentMethod {
    id: string;
    name: string;
    method_type: 'cash' | 'card' | 'transfer' | 'other';
}

interface Discount {
    id: string;
    name: string;
    code: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: string;
}

// ====================================================================
// 2. Funciones de Ayuda (Definiciones de formato)
// ====================================================================
const formatCurrency = (amount: number | string | undefined | null, currency = 'USD'): string => {
    if (amount === undefined || amount === null) return currency === 'COP' ? '$0' : '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (currency === 'COP') {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num || 0);
    }

    return new Intl.NumberFormat('es-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
};

const PuntosVenta: React.FC = () => {
    // =====================================
    // 1. ESTADO DE DATOS Y CARGA
    // =====================================
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [rawMaterials, setRawMaterials] = useState<any[]>([]);
    const [dailyInventory, setDailyInventory] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [processingOrder, setProcessingOrder] = useState<boolean>(false);
    const [screenWidth, setScreenWidth] = useState<number>(window.innerWidth);
    const [showOrderDetails, setShowOrderDetails] = useState<boolean>(false);
    const [editingNoteForItem, setEditingNoteForItem] = useState<string | null>(null);
    const [noteText, setNoteText] = useState<string>('');

    // Obtener parámetros de la URL
    const location = useLocation();
    const navigate = useNavigate();

    // 2. ESTADO DEL PUNTO DE VENTA
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [showTableSelector, setShowTableSelector] = useState<boolean>(false);
    const [discountCode, setDiscountCode] = useState<string>('');
    const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);

    const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

    // 3.5 ESTADO DE CALCULADORA DE VUELTO, MONEDA Y MÉTODOS DE PAGO
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
    const [cashGiven, setCashGiven] = useState<number | null>(null);
    const [inputCash, setInputCash] = useState<string>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
    const [exchangeRate, setExchangeRate] = useState<string | number | null>(null);
    const [loadingRate, setLoadingRate] = useState<boolean>(false);

    // 3.6 ESTADO ORDEN PENDIENTE EN MESA
    const [currentOrder, setCurrentOrder] = useState<any>(null);
    const [sentItems, setSentItems] = useState<SentItemRound[]>([]);

    // 3. ESTADO DE CLIENTES
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerSearch, setCustomerSearch] = useState<string>('');
    const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
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
    // 4. EFECTOS - CARGA INICIAL DE DATOS Y RESPONSIVIDAD
    // =====================================
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            const fetchProducts = async () => {
                try {
                    const res = await api.get('/api/restaurant/menu/products/');
                    const data = res.data.results || res.data || [];
                    if (isMounted) setProducts(data);
                } catch (error) {
                    console.error('Error fetching products:', error);
                }
            };

            const fetchCategories = async () => {
                try {
                    const res = await api.get('/api/restaurant/menu/categories/');
                    const data = res.data.results || res.data || [];
                    if (isMounted) setCategories(data);
                } catch (error) {
                    console.error('Error fetching categories:', error);
                }
            };

            const fetchTables = async () => {
                const tablesRes = await api.get('/api/restaurant/pos/tables/');
                if (isMounted) setTables(tablesRes.data.results || tablesRes.data || []);
            };

            const fetchPayments = async () => {
                const paymentsRes = await api.get('/api/restaurant/payments/payment-methods/active/');
                if (!isMounted) return;
                const methods = paymentsRes.data.results || paymentsRes.data || [];
                setPaymentMethods(methods);
                if (methods.length > 0) {
                    const cashMethod = methods.find(m => m.method_type === 'cash');
                    setSelectedPaymentMethod(cashMethod ? cashMethod.id : methods[0].id);
                }
            };

            const fetchRates = async () => {
                if (isMounted) setLoadingRate(true);
                try {
                    const ratesRes = await api.get('/api/restaurant/payments/exchange-rates/active/');
                    if (!isMounted) return;
                    const rates = ratesRes.data.results || ratesRes.data || [];
                    const usdCopRate = rates.find((r: any) => r.from_currency === 'USD' && r.to_currency === 'COP');
                    if (usdCopRate) {
                        setExchangeRate(usdCopRate.rate);
                    } else {
                        setExchangeRate('4000');
                    }
                } catch (err) {
                    console.warn('Tasas de cambio no disponibles', err);
                    if (isMounted) setExchangeRate('4000');
                } finally {
                    if (isMounted) setLoadingRate(false);
                }
            };

            const fetchInventory = async () => {
                try {
                    const [rmRes, diRes] = await Promise.all([
                        api.get('/api/restaurant/inventory/raw-materials/'),
                        api.get('/api/restaurant/inventory/daily-inventory/')
                    ]);
                    if (isMounted) {
                        setRawMaterials(rmRes.data.results || rmRes.data || []);
                        setDailyInventory(diRes.data.results || diRes.data || []);
                    }
                } catch (err) {
                    console.warn('Error cargando inventario', err);
                }
            };

            const pReady = fetchProducts().catch(err => console.error('Error cargando productos:', err));
            const cReady = fetchCategories().catch(err => console.error('Error cargando categorías:', err));
            const iReady = fetchInventory();

            await Promise.all([pReady, cReady, iReady]);

            if (isMounted) {
                setLoading(false);
            }

            Promise.all([
                fetchTables().catch(err => {
                    console.warn('Mesas no disponibles', err);
                    if (isMounted) setTables([]);
                }),
                fetchPayments().catch(err => console.warn('Métodos de pago no disponibles', err)),
                fetchRates()
            ]).catch(err => console.error('Error global background fetch:', err));
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, []);

    // =====================================
    // 4.5 WEBSOCKET PARA INVENTARIO EN TIEMPO REAL
    // =====================================
    useEffect(() => {
        let ws: WebSocket;
        let isMounted = true;

        const connectWebSocket = () => {
            let wsUrl = import.meta.env.VITE_RESTAURANT_SERVICE || window.location.origin;
            wsUrl = wsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
            // Si la URL termina en un path base, extraemos el dominio
            try {
                const urlObj = new URL(wsUrl);
                wsUrl = `${urlObj.protocol}//${urlObj.host}`;
            } catch (e) {}
            
            ws = new WebSocket(`${wsUrl}/ws/inventory/`);
            
            ws.onopen = () => {
                console.log('✅ Conectado al WebSocket de Inventario');
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'inventory_update' && isMounted) {
                        console.log('🔄 Actualización de inventario recibida (Tiempo Real)');
                        const [rmRes, diRes] = await Promise.all([
                            api.get('/api/restaurant/inventory/raw-materials/'),
                            api.get('/api/restaurant/inventory/daily-inventory/')
                        ]);
                        setRawMaterials(rmRes.data.results || rmRes.data || []);
                        setDailyInventory(diRes.data.results || diRes.data || []);
                    }
                } catch (err) {
                    console.error('Error procesando mensaje WS', err);
                }
            };

            ws.onclose = () => {
                console.warn('⚠️ WebSocket desconectado. Reconectando en 5s...');
                if (isMounted) {
                    setTimeout(connectWebSocket, 5000);
                }
            };
        };

        connectWebSocket();

        return () => {
            isMounted = false;
            if (ws) ws.close();
        };
    }, []);

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const restaurantMode = queryParams.get('restaurantMode') === '1';

    useEffect(() => {
        const urlTable = queryParams.get('table');
        const newOrder = queryParams.get('newOrder') === '1';
        
        if (urlTable) {
            setSelectedTable(urlTable);
            setSentItems([]);

            if (newOrder) {
                setCart([]);
                setCurrentOrder(null);
                return;
            }
            
            api.get('/api/restaurant/pos/tables/')
                .then(res => {
                    const allTables = res.data.results || res.data || [];
                    const tInfo = allTables.find((t: Table) => t.number === urlTable);
                    if (tInfo && tInfo.status === 'occupied' && tInfo.current_order_number) {
                        return api.get(`/api/restaurant/orders/orders/${tInfo.current_order_number}/`);
                    }
                    return null;
                })
                .then(res => {
                    if (res) {
                        const order = res.data;
                        setCurrentOrder(order);
                        if (order.items) {
                            setCart(order.items.map((item: any) => ({
                                product_id: item.product_details ? item.product_details.id : item.product,
                                name: item.product_details ? item.product_details.name : 'Producto',
                                price: parseFloat(item.unit_price),
                                quantity: item.quantity,
                                note: item.notes || '',
                                is_paid: item.is_paid || false,
                                saved_quantity: item.quantity
                            })));
                        }
                    }
                })
                .catch(err => console.error("Error al cargar orden de la mesa", err));
        }
    }, [queryParams]);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchExchangeRate = async () => {
            if (selectedCurrency === 'COP') {
                setLoadingRate(true);
                try {
                    const response = await api.get(
                        '/api/restaurant/payments/exchange-rates/get_rate/?from=USD&to=COP'
                    );
                    setExchangeRate(response.data.rate);
                } catch (err) {
                    console.error('Error loading exchange rate:', err);
                    setExchangeRate(4000);
                } finally {
                    setLoadingRate(false);
                }
            }
        };

        fetchExchangeRate();
    }, [selectedCurrency]);

    // =====================================
    // 5. LÓGICA DEL CARRITO
    // =====================================
    const checkInventoryBeforeAdd = (product_id: string, delta: number, currentCart: CartItem[]) => {
        const usages = rawMaterials.reduce((acc: any[], rm) => {
            const recipeItems = rm.recipe_items || [];
            const item = recipeItems.find((r: any) => r.product === product_id);
            if (item) {
                acc.push({ rm_id: rm.id, rm_name: rm.name, qty_used: parseFloat(item.quantity_used) });
            }
            return acc;
        }, []);

        if (usages.length === 0) return true;

        for (const usage of usages) {
            const daily = dailyInventory.find(d => d.raw_material === usage.rm_id);
            const rm = rawMaterials.find(r => r.id === usage.rm_id);
            const currentStock = daily ? parseFloat(daily.current_balance) : parseFloat(rm?.stock || '0');

            let pendingConsumption = 0;
            currentCart.forEach(cartItem => {
                const pendingQty = cartItem.quantity - (cartItem.saved_quantity || 0);
                if (pendingQty > 0) {
                    const r = rawMaterials.find(rmat => rmat.id === usage.rm_id);
                    const usageInCartItem = (r?.recipe_items || []).find((ri: any) => ri.product === cartItem.product_id);
                    if (usageInCartItem) {
                        pendingConsumption += parseFloat(usageInCartItem.quantity_used) * pendingQty;
                    }
                }
            });

            if (pendingConsumption + (usage.qty_used * delta) > currentStock) {
                alert(`No hay suficiente inventario de ${usage.rm_name}. Stock disponible: ${currentStock}`);
                return false;
            }
        }
        return true;
    };

    const addToCart = useCallback((product: Product) => {
        setCart(prevCart => {
            if (!checkInventoryBeforeAdd(product.id, 1, prevCart)) return prevCart;
            const existingItemIndex = prevCart.findIndex(item => item.product_id === product.id && !item.is_paid);
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
                    price: parseFloat(String(product.price)),
                    quantity: 1,
                    image: product.image,
                    note: ''
                }];
            }
        });
    }, [rawMaterials, dailyInventory]);

    const removeFromCart = useCallback((productId: string) => {
        setCart(prevCart => prevCart.filter(item => {
            if (item.is_paid) return true;
            return item.product_id !== productId;
        }));
    }, []);

    const updateQuantity = useCallback((productId: string, delta: number) => {
        setCart(prevCart => {
            if (delta > 0 && !checkInventoryBeforeAdd(productId, delta, prevCart)) return prevCart;
            return prevCart.map(item => {
                if (item.product_id === productId && !item.is_paid) {
                    const newQuantity = Math.max(1, item.quantity + delta);
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });
        });
    }, [rawMaterials, dailyInventory]);

    const handleAddNote = (productId: string) => {
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

    const calculateTotalInCurrency = useMemo(() => {
        const total = calculateTotal;
        if (selectedCurrency === 'COP') {
            const rate = parseFloat(String(exchangeRate)) || 4000;
            return total * rate;
        }
        return total;
    }, [calculateTotal, selectedCurrency, exchangeRate]);

    // =====================================
    // 7. LÓGICA DE DESCUENTOS
    // =====================================
    const handleApplyDiscount = async () => {
        if (!discountCode) return;
        try {
            const response = await api.post('/api/restaurant/pos/discounts/validate/', { code: discountCode });
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
    const searchCustomers = async (query: string) => {
        setCustomerSearch(query);
        if (query.length < 3) {
            setCustomers([]);
            return;
        }
        try {
            const response = await api.post('/api/restaurant/customers/admin/search/', { query });
            setCustomers(response.data.data.customers || []);
        } catch (err) {
            console.error('Error searching customers:', err);
        }
    };

    const handleCreateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const customerData = {
                ...newCustomer,
                cedula: newCustomer.cedula || null
            };

            const response = await api.post('/api/restaurant/customers/register/', customerData);
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
        } catch (err: any) {
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            const isAvailable = product.is_available;

            return matchesCategory && matchesSearch && isAvailable;
        });
    }, [products, selectedCategory, searchTerm]);

    // 💾 GUARDAR EN MESA (DRAFT)
    const handleSaveToTable = async (redirectParam: any) => {
        const shouldRedirect = typeof redirectParam === 'boolean' ? redirectParam : true;
        if (cart.length === 0) return;
        if (!selectedTable || selectedTable === 'takeout' || selectedTable === 'Seleccionar mesa...') {
            alert('Debe seleccionar una mesa válida para guardar la orden.');
            return;
        }

        setProcessingOrder(true);
        try {
            let activeOrderNumber = currentOrder?.order_number || null;

            if (!activeOrderNumber) {
                const tablesRes = await api.get('/api/restaurant/pos/tables/');
                const allTables = tablesRes.data.results || tablesRes.data || [];
                const tInfo = allTables.find((t: Table) => t.number === selectedTable);
                if (tInfo && tInfo.status === 'occupied' && tInfo.current_order_number) {
                    activeOrderNumber = tInfo.current_order_number;
                }
            }

            const newItems = cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.note || ''
            }));

            let orderObj;
            let orderId;

            if (activeOrderNumber) {
                let mergedItems = newItems;
                let existingResData = null;

                try {
                    const existingRes = await api.get(`/api/restaurant/orders/orders/${activeOrderNumber}/`);
                    existingResData = existingRes.data;
                    const paidItems = (existingRes.data.items || [])
                        .filter((i: any) => i.is_paid)
                        .map((i: any) => ({
                            product_id: i.product_details ? i.product_details.id : i.product,
                            size_id: i.size_details ? i.size_details.id : null,
                            quantity: i.quantity,
                            notes: i.notes || '',
                            is_paid: true
                        }));
                    mergedItems = [...paidItems, ...newItems];
                } catch (e) {
                    console.error("Error obteniendo orden existente, se pisará con los del carrito", e);
                }

                const res = await api.post(
                    `/api/restaurant/orders/orders/${activeOrderNumber}/sync_draft/`,
                    {
                        order_type: 'dine_in',
                        table_number: selectedTable,
                        items: mergedItems,
                        status: 'pending',
                        payment_status: 'pending'
                    }
                );
                orderObj = res.data;
                orderId = orderObj.id || (existingResData ? existingResData.id : null);
            } else {
                const res = await api.post('/api/restaurant/orders/orders/', {
                    order_type: 'dine_in',
                    table_number: selectedTable,
                    items: newItems,
                    status: 'pending',
                    payment_status: 'pending'
                });
                orderObj = res.data;
                orderId = orderObj.id;
            }

            const tablesRes2 = await api.get('/api/restaurant/pos/tables/');
            const allTables2 = tablesRes2.data.results || tablesRes2.data || [];
            const tInfo2 = allTables2.find((t: Table) => t.number === selectedTable);
            if (tInfo2) {
                await api.post(`/api/restaurant/pos/tables/${tInfo2.id}/occupy/`, {
                    order_id: orderId,
                    waiter_name: 'Cajero POS'
                });
            }

            if (shouldRedirect) {
                alert('✅ Productos guardados en la mesa.');
                window.location.href = '/restaurant';
            }
        } catch (err: any) {
            console.error('❌ Error al guardar en mesa:', err.response?.data || err.message || err);
            alert('❌ Error al guardar en la mesa: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        } finally {
            setProcessingOrder(false);
        }
    };

    // 🖨️ COBRAR / PAGAR
    const finalPlaceOrder = async () => {
        if (cart.length === 0) return;

        setProcessingOrder(true);
        setShowReviewModal(false);

        let orderType = 'dine_in';
        let tableNumber = selectedTable || '';
        const DEFAULT_TABLE_NAME = 'GENERICA';

        if (selectedTable === 'takeout') {
            orderType = 'takeout';
            tableNumber = '';
        } else if (!selectedTable || selectedTable === 'Seleccionar mesa...') {
            orderType = 'dine_in';
            tableNumber = DEFAULT_TABLE_NAME;
        }

        let orderNotes = '';
        if (cashGiven) {
            const totalInCurrency = selectedCurrency === 'COP' ? calculateTotalInCurrency : calculateTotal;
            const change = cashGiven - totalInCurrency;

            if (selectedCurrency === 'COP') {
                const rate = parseFloat(String(exchangeRate)) || 4000;
                orderNotes = `Pago con: ${formatCurrency(cashGiven, 'COP')} - Cambio: ${formatCurrency(change, 'COP')} (Tasa: 1 USD = ${rate} COP, Equivalente USD: ${formatCurrency(calculateTotal, 'USD')})`;
            } else {
                orderNotes = `Pago con: ${formatCurrency(cashGiven, 'USD')} - Cambio: ${formatCurrency(change, 'USD')}`;
            }
        } else if (selectedCurrency === 'COP') {
            const rate = parseFloat(String(exchangeRate)) || 4000;
            orderNotes = `Moneda: Pesos Colombianos (Tasa: 1 USD = ${rate} COP, Total COP: ${formatCurrency(calculateTotalInCurrency, 'COP')}, Equivalente USD: ${formatCurrency(calculateTotal, 'USD')})`;
        }

        const orderPayload: Record<string, any> = {
            order_type: orderType,
            table_number: tableNumber,
            notes: orderNotes,
            payment_method_id: selectedPaymentMethod,
            currency_code: selectedCurrency,
            amount_paid: cashGiven || calculateTotalInCurrency,
            total_in_currency: selectedCurrency === 'COP' ? calculateTotalInCurrency : calculateTotal,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                notes: item.note || ''
            })),
            discount_code: appliedDiscount ? appliedDiscount.code : null,
            customer_id: selectedCustomer ? selectedCustomer.id : null
        };

        try {
            let createdOrder;
            if (currentOrder) {
                await api.post(`/api/restaurant/orders/orders/${currentOrder.order_number}/sync_draft/`, orderPayload);
                const orderResponse = await api.post(`/api/restaurant/orders/orders/${currentOrder.order_number}/checkout/`, orderPayload);
                createdOrder = orderResponse.data;
            } else {
                orderPayload.status = 'completed';
                orderPayload.payment_status = 'paid';
                const orderResponse = await api.post('/api/restaurant/orders/orders/', orderPayload);
                createdOrder = orderResponse.data;
            }

            const receiptData = {
                order_number: createdOrder.order_number || createdOrder.id,
                customer_name: createdOrder.customer_name || (selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'CONSUMIDOR FINAL'),
                table_number: createdOrder.table_number || (selectedTable === 'takeout' ? 'PARA LLEVAR' : (selectedTable || 'MESA GENÉRICA')),
                items: (createdOrder.items || cart).map((item: any) => ({
                    name: item.product_details?.name || item.product_name || item.name || 'Producto',
                    quantity: item.quantity,
                    price: parseFloat(item.unit_price || item.price || 0),
                    total: parseFloat(item.line_total || item.subtotal || (item.price * item.quantity) || 0),
                    note: item.notes || item.note || ''
                })),
                subtotal: parseFloat(createdOrder.subtotal || cart.reduce((s, i) => s + (i.price * i.quantity), 0)),
                discount: parseFloat(createdOrder.discount_amount || 0),
                tax: parseFloat(createdOrder.tax_amount || 0),
                total: parseFloat(createdOrder.total || cart.reduce((s, i) => s + (i.price * i.quantity), 0)),
                printed_at: new Date().toISOString()
            };

            try {
                const printResult = await printerServiceRestaurant.printReceipt(receiptData);
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
                    `Verifica que el agente de Windows esté ejecutándose.`
                );
            }

            setCart([]);
            setAppliedDiscount(null);
            setDiscountCode('');
            setSelectedTable('');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setCashGiven(null);
            setInputCash('');
            setSelectedCurrency('USD');
            setExchangeRate('4000');

        } catch (err: any) {
            console.error('❌ Error al procesar la orden:', err);
            const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Error al procesar la orden';
            alert(`❌ Error: ${errorMsg}`);
        } finally {
            setProcessingOrder(false);
        }
    };

    // 🔓 ABRIR CAJA MANUALMENTE
    const handleOpenCashDrawer = async () => {
        try {
            await printerServiceRestaurant.openCashDrawer();
            alert('✅ Caja abierta');
        } catch (error) {
            alert('❌ Error al abrir caja. Verifica que el agente esté ejecutándose.');
        }
    };
    
    // 🖨️ IMPRIMIR COMANDAS (COCINA / FORTALEZA)
    const handlePrintOrder = async (destination: string) => {
        if (cart.length === 0) {
            alert("No hay productos en la orden para imprimir.");
            return;
        }

        if (selectedTable && selectedTable !== 'takeout' && selectedTable !== 'Seleccionar mesa...') {
            await handleSaveToTable(false);
        }

        try {
            let tableNumber = selectedTable || '';
            if (selectedTable === 'takeout') {
                tableNumber = 'PARA LLEVAR';
            } else if (!selectedTable || selectedTable === 'Seleccionar mesa...') {
                tableNumber = 'MESA GENÉRICA';
            }

            const orderData = {
                table_number: tableNumber,
                customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : 'Mesa General',
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    note: item.note || ''
                })),
                destination: destination,
                order_number: `COMANDA-${Date.now()}`,
                subtotal: cart.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0),
                total: cart.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0)
            };

            await printerServiceRestaurant.printKitchenOrder(orderData, destination.toLowerCase());
            alert(`✅ Comanda enviada a ${destination}`);

            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setSentItems(prev => [...prev, {
                destination,
                timestamp,
                items: cart.map(i => ({ ...i }))
            }]);
            setCart([]);

        } catch (err) {
            console.error(`Error imprimiendo comanda a ${destination}:`, err);
            alert(`❌ Error al imprimir comanda en ${destination}. El servicio de hardware podría estar configurándose.`);
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
    // RENDER: REVIEW DETAILS (PANEL DERECHO MODAL COBRO)
    // =====================================
    const renderReviewDetails = () => (
        <div className="p-4 sm:p-6 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                {/* Cliente */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cliente</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Buscar por nombre, cédula..."
                                className="w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                                value={customerSearch}
                                onChange={(e) => searchCustomers(e.target.value)}
                            />
                            {customers.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border border-slate-250 rounded-xl shadow-xl mt-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100">
                                    {customers.map(c => (
                                        <div
                                            key={c.id}
                                            className="p-3 cursor-pointer hover:bg-slate-50 transition"
                                            onClick={() => {
                                                setSelectedCustomer(c);
                                                setCustomerSearch(`${c.first_name} ${c.last_name}`);
                                                setCustomers([]);
                                            }}
                                        >
                                            <p className="font-bold text-slate-805 text-sm">{c.first_name} {c.last_name}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{c.email} {c.tax_id && `(${c.tax_id})`}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 font-bold text-lg transition flex items-center justify-center shrink-0"
                            onClick={() => setShowCustomerModal(true)}
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Mesa / Orden */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mesa / Tipo de Orden</label>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setShowTableSelector(true)}
                            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
                                selectedTable && selectedTable !== 'takeout' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            }`}
                        >
                            {selectedTable && selectedTable !== 'takeout' ? (
                                <>
                                    <i className="bi bi-table"></i>
                                    {selectedTable}
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-plus-circle"></i>
                                    Seleccionar Mesa
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTable('takeout')}
                            className={`flex-1 min-w-[130px] py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition border flex items-center justify-center gap-1.5 ${
                                selectedTable === 'takeout' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <i className="bi bi-box-seam"></i>
                            Para Llevar
                        </button>
                        {selectedTable && (
                            <button
                                type="button"
                                onClick={() => setSelectedTable(null)}
                                className="px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center justify-center"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Descuento */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Código de Descuento</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Código"
                            className="flex-1 px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                            value={discountCode}
                            onChange={(e) => setDiscountCode(e.target.value)}
                        />
                        <button
                            type="button"
                            className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition"
                            onClick={handleApplyDiscount}
                        >
                            Aplicar
                        </button>
                    </div>
                    {appliedDiscount && (
                        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-250 text-emerald-800 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            Descuento aplicado: {appliedDiscount.name}
                        </div>
                    )}
                </div>
            </div>

            {/* Carrito Resumen en modal de cobro */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 mb-3">Resumen de Productos</h4>
                <div className="max-h-40 overflow-y-auto space-y-2.5">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-slate-800">
                            <div>
                                <span className="font-bold">{item.name}</span>
                                {item.note && <span className="text-[10px] text-slate-400 italic block mt-0.5">({item.note})</span>}
                            </div>
                            <span className="font-bold text-slate-500">x{item.quantity}</span>
                            <span className="font-bold text-slate-800">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pago y moneda */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4.5 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <i className="bi bi-credit-card"></i> Método de Pago
                    </label>
                    <select
                        value={selectedPaymentMethod}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                    >
                        {paymentMethods.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <i className="bi bi-cash-coin"></i> Moneda de Pago
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setSelectedCurrency('USD'); setCashGiven(null); setInputCash(''); }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition border flex items-center justify-center gap-1.5 ${
                                selectedCurrency === 'USD' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'
                            }`}
                        >
                            <i className="bi bi-currency-dollar"></i> USD
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSelectedCurrency('COP'); setCashGiven(null); setInputCash(''); }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition border flex items-center justify-center gap-1.5 ${
                                selectedCurrency === 'COP' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                            }`}
                        >
                            <i className="bi bi-globe"></i> COP
                        </button>
                    </div>
                </div>

                {selectedCurrency === 'COP' && (
                    <div className="bg-white border border-emerald-200 p-3 rounded-xl space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tasa de Cambio</span>
                        <div className="font-extrabold text-sm text-emerald-800">{loadingRate ? 'Cargando...' : `${parseFloat(String(exchangeRate)).toLocaleString('es-CO')} COP`}</div>
                        <div className="text-[10px] text-slate-500 font-medium pt-1.5 border-t border-slate-100">
                            Total en COP: <strong className="text-emerald-700">{formatCurrency(calculateTotalInCurrency, 'COP')}</strong>
                        </div>
                    </div>
                )}
            </div>

            {/* Calculadora de Vuelto */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4.5 space-y-3.5">
                <h4 className="font-extrabold text-xs text-indigo-805 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="bi bi-calculator"></i> Calculadora de Vuelto
                </h4>
                
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={inputCash}
                        onChange={(e) => {
                            const val = e.target.value;
                            setInputCash(val);
                            setCashGiven(val ? parseFloat(val) : null);
                        }}
                        placeholder="Monto recibido"
                        className="flex-1 px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
                    />
                    <button
                        type="button"
                        onClick={() => { setCashGiven(null); setInputCash(''); }}
                        className="px-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 font-bold text-xs uppercase tracking-wider transition hover:bg-rose-100"
                    >
                        Borrar
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                    {(selectedCurrency === 'COP'
                        ? [1000, 2000, 5000, 10000, 20000, 50000, 100000]
                        : [1, 2, 5, 10, 20, 50, 100]
                    ).map(bill => (
                        <button
                            key={bill}
                            type="button"
                            onClick={() => {
                                const newVal = (cashGiven || 0) + bill;
                                setCashGiven(newVal);
                                setInputCash(newVal.toString());
                            }}
                            className="bg-white border border-indigo-200 text-indigo-700 font-bold text-[10px] p-2 rounded-lg transition hover:bg-indigo-50/50"
                        >
                            +{selectedCurrency === 'COP' ? formatCurrency(bill, 'COP') : `$${bill}`}
                        </button>
                    ))}
                </div>

                {cashGiven !== null && (
                    <div className="bg-white border border-indigo-150 p-3.5 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-400 font-medium">
                            <span>Total a Pagar:</span>
                            <span className="font-bold text-slate-800">{formatCurrency(calculateTotalInCurrency, selectedCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 font-medium">
                            <span>Efectivo Recibido:</span>
                            <span className="font-bold text-indigo-600">{formatCurrency(cashGiven, selectedCurrency)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-indigo-200 text-sm font-extrabold">
                            <span className="text-indigo-805">VUELTO:</span>
                            <div className="text-right">
                                <span className={cashGiven - calculateTotalInCurrency < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                    {formatCurrency(cashGiven - calculateTotalInCurrency, selectedCurrency)}
                                </span>
                            </div>
                        </div>
                        {cashGiven - calculateTotalInCurrency < 0 && (
                            <p className="text-rose-600 text-[10px] font-bold text-center mt-1 flex items-center justify-center gap-1">
                                <i className="bi bi-exclamation-triangle-fill text-rose-500"></i> Monto insuficiente
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Totales */}
            <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                    <span>Subtotal</span>
                    <span className="text-slate-800">{formatCurrency(calculateSubtotal)}</span>
                </div>
                {appliedDiscount && (
                    <div className="flex justify-between text-xs text-rose-600 font-bold">
                        <span>Descuento</span>
                        <span>- {formatCurrency(calculateDiscountAmount)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                    <span className="text-sm font-extrabold text-slate-800">Total Final</span>
                    <span className="text-xl font-extrabold text-emerald-600">{formatCurrency(calculateTotal)}</span>
                </div>
            </div>
        </div>
    );

    // =====================================
    // RENDER: COMPACT VIEW (MOBILE/TABLET)
    // =====================================
    const renderCompactView = () => (
        <div className="fixed inset-0 flex flex-col bg-slate-100 font-sans z-10 overflow-hidden">
            {/* Header POS Móvil */}
            <div className="bg-slate-900 px-4 py-3 flex items-center justify-between shadow-md shrink-0">
                <button
                    onClick={() => navigate('/restaurant')}
                    className="bg-transparent border-none text-slate-400 font-bold text-xs flex items-center gap-1"
                >
                    <i className="bi bi-arrow-left text-sm"></i> Mesas
                </button>
                <h1 className="text-white font-extrabold text-sm tracking-wider uppercase flex items-center gap-1.5">
                    <i className="bi bi-cart4 text-sky-400"></i> POS
                </h1>
                <div className="w-10"></div>
            </div>

            {/* Alternar entre Catálogo y Carrito */}
            {!showOrderDetails ? (
                /* Vista Catálogo */
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Categorías (Pills scroll horizontal) */}
                    <div className="bg-white border-b border-slate-200 p-3 shrink-0 flex items-center overflow-x-auto gap-2 scrollbar-none">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                            }`}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                    selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-650 hover:bg-slate-200'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Buscador */}
                    <div className="bg-white p-3 border-b border-slate-100 shrink-0">
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            className="w-full px-3.5 py-1.5 text-xs text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Grid Productos */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 text-xs italic font-medium">No se encontraron productos.</div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col justify-between shadow-sm cursor-pointer hover:border-indigo-300 transition active:scale-97"
                                    >
                                        <div className="h-20 flex items-center justify-center bg-white rounded-lg p-1.5 border-b border-slate-50 mb-2">
                                            {product.image ? (
                                                <img
                                                    src={getCleanImageUrl(product.image)}
                                                    alt={product.name}
                                                    className="max-h-full max-w-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = '/logo-aurora.png';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                                    <i className="bi bi-image text-lg"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">{product.name}</h3>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="font-extrabold text-sm text-sky-500">{formatCurrency(product.price)}</span>
                                                <span className="w-6 h-6 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center font-bold text-sm">+</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Vista Carrito/Orden */
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* Header Carrito */}
                    <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0 flex justify-between items-center">
                        <h3 className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                            <i className="bi bi-receipt"></i> Carrito ({cart.length})
                        </h3>
                        <button
                            onClick={() => setShowOrderDetails(false)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 border-none rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                        >
                            <i className="bi bi-arrow-left"></i> Menú
                        </button>
                    </div>

                    {/* Lista Carrito */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                                <i className="bi bi-cart-x text-4xl mb-2 text-slate-300"></i>
                                <p className="text-xs font-bold">El carrito está vacío</p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-sm">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-xs text-slate-805 truncate">{item.name}</h4>
                                            <p className="text-[10px] text-slate-450 mt-0.5 font-semibold">{formatCurrency(item.price)} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                                <button
                                                    onClick={() => updateQuantity(item.product_id, -1)}
                                                    className="w-7 h-7 bg-transparent border-none text-slate-600 font-bold flex items-center justify-center text-base"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product_id, 1)}
                                                    className="w-7 h-7 bg-transparent border-none text-slate-600 font-bold flex items-center justify-center text-base"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product_id)}
                                                className="w-7 h-7 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg flex items-center justify-center text-base font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100">
                                        <div className="flex-1 min-w-0 pr-2">
                                            {item.note ? (
                                                <div className="text-[10px] text-slate-500 italic bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 truncate">
                                                    <strong>Nota:</strong> {item.note}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Sin notas</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleAddNote(item.product_id)}
                                            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-bold text-[9px] uppercase tracking-wider shrink-0"
                                        >
                                            {item.note ? (
                                                <span className="flex items-center gap-1">
                                                    <i className="bi bi-chat-left-text text-[9px]"></i> Notas
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <i className="bi bi-pencil text-[9px]"></i> Nota
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Checkout Box Fijo Móvil */}
                    {cart.length > 0 && (
                        <div className="border-t border-slate-200 p-4 bg-slate-50 shrink-0 shadow-lg space-y-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400 font-medium">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(calculateSubtotal)}</span>
                                </div>
                                {appliedDiscount && (
                                    <div className="flex justify-between text-xs text-rose-600 font-bold">
                                        <span>Descuento</span>
                                        <span>- {formatCurrency(calculateDiscountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200">
                                    <span className="text-sm font-extrabold text-slate-800">Total</span>
                                    <span className="text-xl font-extrabold text-emerald-600">{formatCurrency(calculateTotal)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handlePrintOrder('Cocina')}
                                    className="py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-amber-100 border-none"
                                >
                                    <i className="bi bi-fire"></i> Cocina
                                </button>
                                <button
                                    onClick={() => handlePrintOrder('Fortaleza')}
                                    className="py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-violet-100 border-none"
                                >
                                    <i className="bi bi-cup-straw"></i> Fortaleza
                                </button>
                            </div>

                            <button
                                onClick={handleSaveToTable}
                                disabled={processingOrder}
                                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md shadow-emerald-100 border-none"
                            >
                                {processingOrder ? 'Guardando...' : (
                                    <span className="flex items-center justify-center gap-1.5">
                                        <i className="bi bi-floppy"></i> Guardar en Mesa
                                    </span>
                                )}
                            </button>

                            {!restaurantMode && (
                                <button
                                    onClick={openOrderConfirmationModal}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-extrabold uppercase tracking-wider shadow-md shadow-indigo-100 border-none"
                                >
                                    Cobrar / Pagar
                                </button>
                            )}

                            {!restaurantMode && (
                                <button
                                    onClick={handleOpenCashDrawer}
                                    className="w-full py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider border-none flex items-center justify-center gap-1.5"
                                >
                                    <i className="bi bi-unlock"></i> Abrir Caja
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Tabs Movil */}
            <div className="bg-white border-t border-slate-200 p-2.5 flex gap-2 shrink-0 shadow-md">
                <button
                    onClick={() => setShowOrderDetails(false)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border flex items-center justify-center gap-1.5 ${
                        !showOrderDetails
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                    }`}
                >
                    <i className="bi bi-grid-fill"></i> Catálogo
                </button>
                <button
                    onClick={() => setShowOrderDetails(true)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border relative flex items-center justify-center gap-1.5 ${
                        showOrderDetails
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                    }`}
                >
                    <i className="bi bi-receipt-cutoff"></i> Orden
                    {cart.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-amber-950 font-extrabold text-[9px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {cart.length}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    // =====================================
    // RENDER: DESKTOP VIEW
    // =====================================
    const renderDesktopView = () => (
        <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
            {/* Header POS Escritorio */}
            <div className="bg-slate-900 border-b border-slate-950 px-6 py-4 flex justify-between items-center shadow-md shrink-0">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/restaurant')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-205 border border-slate-700 rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                        <i className="bi bi-arrow-left text-sm"></i> Volver a Mesas
                    </button>
                    <h1 className="text-white font-extrabold text-lg tracking-wider uppercase flex items-center gap-2">
                        <i className="bi bi-cart4 text-sky-400"></i> Punto de Venta
                    </h1>
                </div>
                {!restaurantMode && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleOpenCashDrawer}
                            className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl px-4 py-2 font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                        >
                            <i className="bi bi-unlock text-sm"></i> Abrir Caja
                        </button>
                    </div>
                )}
            </div>

            {/* Split Screen POS */}
            <div className="flex-1 flex overflow-hidden">
                {/* Panel Izquierdo: Catálogo de Productos */}
                <div className="w-3/5 min-w-[500px] flex flex-col bg-white border-r border-slate-200">
                    {/* Pills Categorías */}
                    <div className="p-4 border-b border-slate-200 shrink-0 flex items-center overflow-x-auto gap-2 scrollbar-thin scrollbar-thumb-indigo-200">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-4.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                                selectedCategory === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Todas
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-4.5 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                                    selectedCategory === cat.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Buscador */}
                    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                        <input
                            type="text"
                            placeholder="Buscar producto por nombre..."
                            className="w-full px-4 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Grid de Productos */}
                    <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 text-sm font-semibold italic">No hay productos en esta categoría.</div>
                        ) : (
                            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col justify-between shadow-sm cursor-pointer transition-all hover:scale-102 hover:shadow-md hover:border-indigo-200 active:scale-97"
                                    >
                                        <div className="h-28 flex items-center justify-center bg-white rounded-xl p-2 border-b border-slate-50 mb-3">
                                            {product.image ? (
                                                <img
                                                    src={getCleanImageUrl(product.image)}
                                                    alt={product.name}
                                                    className="max-h-full max-w-full object-contain"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = '/logo-aurora.png';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                                    <i className="bi bi-image text-xl"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xs text-slate-850 line-clamp-2 leading-snug">{product.name}</h3>
                                            <div className="flex justify-between items-center mt-3">
                                                <span className="font-extrabold text-base text-sky-600">{formatCurrency(product.price)}</span>
                                                <span className="w-7 h-7 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center font-bold text-base transition-colors hover:bg-sky-100">+</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Derecho: Detalle de la Orden & Totales */}
                <div className="w-2/5 min-w-[400px] flex flex-col bg-white">
                    {/* Header Carrito */}
                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-extrabold text-sm text-slate-850 flex items-center gap-1.5">
                            <i className="bi bi-receipt-cutoff text-indigo-600"></i> Orden Actual
                        </h3>
                        <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold border border-indigo-100">
                            {cart.length} productos
                        </span>
                    </div>

                    {/* Mesa Selección Rápida en Carrito Escritorio */}
                    <div className="p-4.5 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider shrink-0">Mesa:</span>
                        <button
                            onClick={() => setShowTableSelector(true)}
                            className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
                                selectedTable && selectedTable !== 'takeout' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-50' : 'bg-indigo-600 text-white shadow-md shadow-indigo-50'
                            }`}
                        >
                            {selectedTable && selectedTable !== 'takeout' ? (
                                <>
                                    <i className="bi bi-table"></i>
                                    {selectedTable}
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-plus-circle"></i>
                                    Seleccionar Mesa
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setSelectedTable('takeout')}
                            className={`py-2 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border flex items-center justify-center gap-1.5 ${
                                selectedTable === 'takeout' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <i className="bi bi-box-seam"></i>
                            Para Llevar
                        </button>
                        {selectedTable && (
                            <button
                                onClick={() => setSelectedTable(null)}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center justify-center shrink-0"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Lista del Carrito */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
                                <i className="bi bi-cart-x text-5xl mb-3.5 text-slate-350"></i>
                                <p className="font-bold text-sm text-slate-700">El carrito está vacío</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-normal">Selecciona productos del catálogo de la izquierda para comenzar.</p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{item.name}</h4>
                                            <p className="text-[10px] text-slate-450 mt-1 font-bold">{formatCurrency(item.price)} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                                                <button
                                                    onClick={() => updateQuantity(item.product_id, -1)}
                                                    className="w-8 h-8 bg-transparent border-none text-slate-600 font-bold flex items-center justify-center text-lg"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.product_id, 1)}
                                                    className="w-8 h-8 bg-transparent border-none text-slate-600 font-bold flex items-center justify-center text-lg"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.product_id)}
                                                className="w-8 h-8 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-center justify-center text-lg font-bold transition hover:bg-rose-100"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-100">
                                        <div className="flex-1 min-w-0 pr-2">
                                            {item.note ? (
                                                <div className="text-[10px] text-slate-500 italic bg-slate-50 border border-slate-150 rounded-lg px-2.5 py-1.5 truncate">
                                                    <strong>Nota:</strong> {item.note}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Sin notas especiales</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleAddNote(item.product_id)}
                                            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-650 font-bold text-[9px] uppercase tracking-wider shrink-0 transition hover:bg-slate-100"
                                        >
                                            {item.note ? (
                                                <span className="flex items-center gap-1">
                                                    <i className="bi bi-chat-left-text text-[9px]"></i> Editar
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1">
                                                    <i className="bi bi-pencil text-[9px]"></i> Nota
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totales y Botones de Pedido Fijos */}
                    {cart.length > 0 && (
                        <div className="border-t border-slate-200 p-5 bg-slate-50/50 shrink-0 shadow-lg space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                                    <span>Subtotal</span>
                                    <span className="text-slate-800">{formatCurrency(calculateSubtotal)}</span>
                                </div>
                                {appliedDiscount && (
                                    <div className="flex justify-between text-xs text-rose-600 font-bold">
                                        <span>Descuento</span>
                                        <span>- {formatCurrency(calculateDiscountAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-3 border-t border-dashed border-slate-200">
                                    <span className="text-sm font-extrabold text-slate-800">Total Final</span>
                                    <span className="text-2xl font-extrabold text-emerald-600">{formatCurrency(calculateTotal)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handlePrintOrder('Cocina')}
                                    className="py-3 bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-100 border-none transition hover:bg-amber-700"
                                >
                                    <i className="bi bi-fire text-sm"></i> Enviar a Cocina
                                </button>
                                <button
                                    onClick={() => handlePrintOrder('Fortaleza')}
                                    className="py-3 bg-violet-650 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-violet-100 border-none transition hover:bg-violet-750"
                                >
                                    <i className="bi bi-cup-straw text-sm"></i> Enviar a Fortaleza
                                </button>
                            </div>

                            <button
                                onClick={handleSaveToTable}
                                disabled={processingOrder}
                                className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold uppercase tracking-wider shadow-md shadow-emerald-100 border-none transition hover:bg-emerald-700"
                            >
                                {processingOrder ? 'Guardando en Mesa...' : (
                                    <span className="flex items-center justify-center gap-1.5">
                                        <i className="bi bi-floppy"></i> Guardar Pedido en Mesa
                                    </span>
                                )}
                            </button>

                            {!restaurantMode && (
                                <button
                                    onClick={openOrderConfirmationModal}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-xl text-base font-extrabold uppercase tracking-wider shadow-md shadow-indigo-100 border-none transition hover:bg-indigo-700"
                                >
                                    Cobrar / Pagar Pedido
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // =====================================
    // DIÁLOGOS Y MODALES
    // =====================================

    // Modal Notas Especiales
    const renderNoteModal = () => (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-slate-800 font-extrabold text-sm">Agregar Nota Especial</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                        Escribe las especificaciones del producto para cocina o fortaleza (ej: sin cebolla, extra queso).
                    </p>
                </div>
                <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Escribe aquí las especificaciones..."
                    className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 bg-white resize-none"
                    rows={4}
                    maxLength={100}
                />
                <div className="flex justify-end gap-2 pt-2">
                    <Btn variant="ghost" onClick={cancelNote}>Cancelar</Btn>
                    <Btn variant="primary" onClick={saveNote}>Guardar Nota</Btn>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-500 font-semibold text-sm">
                Cargando sistema de punto de venta...
            </div>
        );
    }

    return (
        <>
            {screenWidth <= 1366 ? renderCompactView() : renderDesktopView()}

            {editingNoteForItem && renderNoteModal()}

            {/* Modal de Cobro */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="px-6 py-4.5 border-b border-slate-150 bg-slate-900 flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-base font-bold">Confirmación y Cobro</h3>
                                <p className="text-[10px] text-slate-300 mt-0.5">Revisa la orden y selecciona el método de pago.</p>
                            </div>
                            <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-none rounded-lg w-8 h-8 text-lg font-medium flex items-center justify-center cursor-pointer transition-colors" onClick={() => setShowReviewModal(false)}>×</button>
                        </div>
                        <div className="overflow-y-auto flex-1 bg-slate-50/50">
                            {renderReviewDetails()}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-150 flex gap-2.5 justify-end bg-white">
                            <Btn variant="ghost" onClick={() => setShowReviewModal(false)}>Editar Pedido</Btn>
                            <Btn variant="success" size="lg" onClick={finalPlaceOrder} disabled={processingOrder}>
                                {processingOrder ? 'Procesando...' : 'Confirmar y Pagar'}
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear Cliente */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-extrabold text-slate-850">Registrar Nuevo Cliente</h3>
                            <button className="bg-slate-100 hover:bg-slate-200 text-slate-500 border-none rounded-lg w-7 h-7 text-lg font-medium flex items-center justify-center cursor-pointer transition-colors" onClick={() => setShowCustomerModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateCustomer} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Cédula / Identificación</label>
                                <Input type="text" name="cedula" value={newCustomer.cedula} onChange={handleInputChange} placeholder="Ej: 1712345678" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Correo Electrónico *</label>
                                <Input type="email" name="email" value={newCustomer.email} onChange={handleInputChange} required placeholder="Ej: maria@gmail.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre *</label>
                                    <Input type="text" name="first_name" value={newCustomer.first_name} onChange={handleInputChange} required placeholder="María" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Apellido *</label>
                                    <Input type="text" name="last_name" value={newCustomer.last_name} onChange={handleInputChange} required placeholder="López" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Teléfono</label>
                                <Input type="text" name="phone" value={newCustomer.phone} onChange={handleInputChange} placeholder="Ej: 0991234567" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Ciudad</label>
                                <Input type="text" name="city" value={newCustomer.city} onChange={handleInputChange} placeholder="Ej: Quito" />
                            </div>
                            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                                <Btn type="button" variant="ghost" onClick={() => setShowCustomerModal(false)}>Cancelar</Btn>
                                <Btn type="submit" variant="primary">Guardar Cliente</Btn>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Croquis Mesas */}
            {showTableSelector && (
                <TableCroquis
                    tables={tables}
                    selectedTable={tables.find(t => t.number === selectedTable)}
                    onSelectTable={(table) => {
                        setSelectedTable(table.number);
                        setShowTableSelector(false);
                    }}
                    onClose={() => setShowTableSelector(false)}
                />
            )}
        </>
    );
};

// ─── Micro-componentes Auxiliares ───
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
const Input: React.FC<InputProps> = (props) => (
    <input
        {...props}
        className="w-full px-3.5 py-2.5 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white"
    />
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
        ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-750 border-none',
        outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
    };
    const v = variants[variant] || variants.primary;
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-2.5 text-sm' : 'px-4.5 py-2 text-xs';
    return (
        <button
            {...props}
            className={`rounded-xl font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${v} ${pad} ${props.className || ''}`}
        >
            {children}
        </button>
    );
};

export default PuntosVenta;
