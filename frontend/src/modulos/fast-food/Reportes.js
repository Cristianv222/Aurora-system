// modulos/fast-food/Reportes.js - VERSIÓN CONSOLIDADA FINAL
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const Reportes = () => {
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState(''); 
    const [reports, setReports] = useState([]);
    const [currentReport, setCurrentReport] = useState(null);
    const [reportType, setReportType] = useState('daily');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(),
        endDate: new Date()
    });
    const [filterType, setFilterType] = useState('today');
    const [dashboardStats, setDashboardStats] = useState(null);
    const [connectionError, setConnectionError] = useState(false);
    const [debugInfo, setDebugInfo] = useState('');

    // Colores para gráficos
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4'];

    // Obtener la URL base del servicio
    const getFastFoodBaseURL = () => {
        return process.env.REACT_APP_FAST_FOOD_SERVICE || 'http://localhost:8002';
    };

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

    // Cargar estadísticas del dashboard
    const fetchDashboardStats = useCallback(async () => {
        try {
            const response = await api.get('/api/pos/daily-summaries/dashboard/', {
                baseURL: getFastFoodBaseURL(),
                timeout: 10000
            });
            setDashboardStats(response.data);
            return true;
        } catch (err) {
            console.error('Error loading dashboard stats:', err);
            throw new Error(`Dashboard no disponible: ${err.message}`);
        }
    }, [getFastFoodBaseURL]);
const fetchReports = useCallback(async () => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError(''); // Usar setError aquí está bien, ya que está en el scope superior

            // 1. Obtener la lista de reportes recientes (Viewset list)
            const listResponse = await api.get('/api/pos/daily-summaries/', {
                baseURL: getFastFoodBaseURL(),
                params: { ordering: '-date', limit: 30 },
                timeout: 10000
            });

            let reportsData = listResponse.data.results || listResponse.data;
            if (!Array.isArray(reportsData)) reportsData = [];

            // 2. Obtener el reporte de hoy (Endpoint: /today/ - genera si no existe)
            const todayResponse = await api.get('/api/pos/daily-summaries/today/', {
                baseURL: getFastFoodBaseURL(),
                timeout: 10000
            });

            const todayReport = todayResponse.data;
            const todayDateStr = todayReport.date_formatted || todayReport.date;
            
            // 3. Integrar el reporte de hoy con la lista reciente
            const updatedReports = reportsData.filter(r => r.date !== todayDateStr);
            updatedReports.unshift(todayReport); 
            
            setReports(updatedReports);
            setCurrentReport(todayReport); 
            setReportType('daily');
            setDateRange({ 
                startDate: new Date(todayReport.date), 
                endDate: new Date(todayReport.date) 
            });

        } catch (err) {
            console.error('Error loading reports (fetchReports):', err);
            throw new Error('Error al cargar reportes listados.');
        } finally {
            setLoadingData(false);
        }
    }, [getFastFoodBaseURL]); // Dependencia agregada: getFastFoodBaseURL
    // Generar reporte para hoy (función auxiliar llamada internamente o por error)
   // Cargar reporte diario específico (usa generate/ para asegurar la actualización)
    const loadDailyReport = useCallback(async (date) => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            // setError(''); // Ya no usamos setError en esta función, evitamos warning
            setDebugInfo('');
            
            const dateStr = format(date, 'yyyy-MM-dd');
            
            // 1. Forzar la generación/actualización 
            const response = await api.post('/api/pos/daily-summaries/generate/', {
                date: dateStr,
                detailed: true
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });
            
            const generatedSummary = response.data.summary; // Extraer fuera del if
            
            if (generatedSummary) {
                setCurrentReport(generatedSummary);
                
                // 2. Volver a cargar la lista superior y el dashboard para forzar la sincronización
                // Esto también actualiza el estado de reports
                await fetchReports(); 
                await fetchDashboardStats();
            }
            
        } catch (err) {
            console.error('Error loading daily report:', err);
            
            let errorMessage = `❌ Error al cargar/generar reporte para ${format(date, 'dd/MM/yyyy')}.`;
            if (err.response?.status === 500) {
                errorMessage += '\n\n⚠️ Error interno del servidor (500). Revise los logs.';
            }
            
            setConnectionError(true);
            // setError(errorMessage); // Ya no usamos setError en esta función
            setDebugInfo(`URL: ${getFastFoodBaseURL()}\nFecha: ${format(date, 'yyyy-MM-dd')}\nError: ${err.message}`);
            
        } finally {
            setLoadingData(false);
        }
    }, [fetchReports, fetchDashboardStats, getFastFoodBaseURL]); // Dependencias: fetchs

    // Hook de inicialización
    useEffect(() => {
        const initializeReports = async () => {
            setLoading(true);
            try {
                await fetchDashboardStats();
                await fetchReports();
                setConnectionError(false);
            } catch (err) {
                console.error('Error inicializando reportes:', err);
                setConnectionError(true);
                setError('❌ Error al conectar con el backend. Verifique el servicio.');
                setDebugInfo(`Error: ${err.message}\nURL: ${getFastFoodBaseURL()}\nStatus: ${err.response?.status}`);
            } finally {
                setLoading(false);
            }
        };
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
        initializeReports();
    }, []); // Dejamos el array vacío o con dependencias que no cambian

    // Hook de inicialización
    useEffect(() => {
        const initializeReports = async () => {
            setLoading(true);
            try {
                await fetchDashboardStats();
                await fetchReports();
                setConnectionError(false);
            } catch (err) {
                console.error('Error inicializando reportes:', err);
                setConnectionError(true);
                setError('❌ Error al conectar con el backend. Verifica que el servicio fast-food-service esté ejecutándose y migrado.');
                setDebugInfo(`Error: ${err.message}\nURL: ${getFastFoodBaseURL()}\nStatus: ${err.response?.status}`);
            } finally {
                setLoading(false);
            }
        };
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
        initializeReports();
    }, []);

const generateReport = async () => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setDebugInfo('');
            
            const startDate = format(dateRange.startDate, 'yyyy-MM-dd');
            const endDate = format(dateRange.endDate, 'yyyy-MM-dd');

            if (reportType === 'daily') {
                // Generación de reporte diario (forzado)
                await loadDailyReport(dateRange.startDate);
                
            } else if (reportType === 'weekly' || reportType === 'monthly' || reportType === 'custom') {
                // Para reportes consolidados, usa get_report
                const payload = {
                    report_type: reportType,
                };

                if (reportType === 'weekly') {
                    payload.start_date = format(startOfWeek(dateRange.startDate, { locale: es }), 'yyyy-MM-dd');
                    payload.end_date = format(endOfWeek(dateRange.startDate, { locale: es }), 'yyyy-MM-dd');
                } else if (reportType === 'monthly') {
                    payload.year = dateRange.startDate.getFullYear();
                    payload.month = dateRange.startDate.getMonth() + 1;
                } else if (reportType === 'custom') {
                    payload.report_type = 'range'; 
                    payload.start_date = startDate;
                    payload.end_date = endDate;
                }
                
                const response = await api.post('/api/pos/daily-summaries/get_report/', payload, {
                    baseURL: getFastFoodBaseURL(),
                    timeout: 15000
                });
                
                setCurrentReport(response.data.data || response.data);
            }
            
            alert('✅ Reporte generado exitosamente con datos reales');
            
        } catch (err) {
            console.error('Error generating report (manual):', err);
            
            let errorMessage = 'Error al generar reporte';
            if (err.response) {
                 if (err.response.status === 500) {
                     errorMessage = `❌ Error interno del servidor: ${err.response.data?.error || 'Revisa logs de Django.'}`;
                 } else if (err.response.data?.detail) {
                     errorMessage = `❌ ${err.response.data.detail}`;
                 }
            } else if (err.message) {
                errorMessage = `❌ ${err.message}`;
            }
            
            setConnectionError(true);
            setError(errorMessage);
            alert(errorMessage);
            
        } finally {
            setLoadingData(false);
        }
    };

    // Cerrar día - Esta funcionalidad SÍ existe en tu backend
   const closeDay = async () => {
        if (!window.confirm('¿Estás seguro de cerrar el día? Esta acción generará un reporte final y cerrará todos los turnos abiertos.')) {
            return;
        }

        try {
            setConnectionError(false);
            setError('');
            setDebugInfo('');
            
            const response = await api.post('/api/pos/daily-summaries/close_day/', {
                date: format(new Date(), 'yyyy-MM-dd'),
                closing_notes: 'Cierre manual del día'
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            console.log('Día cerrado:', response.data);
            alert('✅ Día cerrado exitosamente. Reporte final generado.');
            
            await fetchReports();
            await fetchDashboardStats();
            
        } catch (err) {
            console.error('Error closing day:', err);
            setError('❌ Error al cerrar el día: ' + (err.response?.data?.error || err.message));
            setConnectionError(true);
            alert('❌ Error al cerrar el día. Verifica que tengas permisos de administrador (is_staff o ADMIN_RESTAURANT).');
        }
    };
    // Aplicar filtro rápido
   const applyQuickFilter = (filter) => {
        setFilterType(filter);
        const today = new Date();
        
        switch (filter) {
            case 'today':
                setReportType('daily');
                setDateRange({ startDate: today, endDate: today });
                loadDailyReport(today);
                break;
            case 'yesterday':
                const yesterday = subDays(today, 1);
                setReportType('daily');
                setDateRange({ startDate: yesterday, endDate: yesterday });
                loadDailyReport(yesterday);
                break;
            case 'thisWeek':
                setReportType('weekly');
                setDateRange({ 
                    startDate: startOfWeek(today, { locale: es }),
                    endDate: today 
                });
                generateReport();
                break;
            case 'lastWeek':
                setReportType('weekly');
                const lastWeekStart = subDays(startOfWeek(today, { locale: es }), 7);
                const lastWeekEnd = subDays(endOfWeek(today, { locale: es }), 7);
                setDateRange({
                    startDate: lastWeekStart,
                    endDate: lastWeekEnd
                });
                generateReport();
                break;
            case 'thisMonth':
                setReportType('monthly');
                setDateRange({
                    startDate: startOfMonth(today),
                    endDate: today
                });
                generateReport();
                break;
            default:
                setReportType('daily');
                setDateRange({ startDate: today, endDate: today });
                loadDailyReport(today);
        }
    };

    // Renderizar gráfico de ventas por hora
    const renderSalesByHourChart = () => {
        if (!currentReport?.sales_by_hour || !Array.isArray(currentReport.sales_by_hour)) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay datos de ventas por hora disponibles.</p>
                    <p>Asegúrate de que la generación detallada funcione correctamente en el backend.</p>
                </div>
            );
        }
const hourData = currentReport.sales_by_hour
            .filter(item => item && item.total_sales !== undefined)
            .map(item => ({
                hora: item.hour_label || `${item.hour}:00`,
                ventas: parseFloat(item.total_sales || 0),
                ordenes: item.total_orders || 0,
                items: item.total_items || 0
            }))
            .sort((a, b) => {
                const hourA = parseInt(a.hora.split(':')[0]);
                const hourB = parseInt(b.hora.split(':')[0]);
                return hourA - hourB;
            });

        if (hourData.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay ventas registradas por hora para este período</p>
                </div>
            );
        }

        return (
            <div style={{ height: 350, marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: '#333' }}>Ventas por Hora</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hora" />
                        <YAxis />
                        <Tooltip 
                            formatter={(value, name) => {
                                if (name === 'ventas') return [formatCurrency(value), 'Ventas'];
                                return [value, name === 'ordenes' ? 'Órdenes' : 'Items'];
                            }}
                            labelFormatter={(label) => `Hora: ${label}`}
                        />
                        <Legend />
                        <Area 
                            type="monotone" 
                            dataKey="ventas" 
                            stroke="#8884d8" 
                            fill="#8884d8" 
                            fillOpacity={0.3} 
                            name="Ventas"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    };
    // Renderizar gráfico de productos más vendidos
    const renderTopProductsChart = () => {
        if (!currentReport?.top_products || !Array.isArray(currentReport.top_products)) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay datos de productos más vendidos</p>
                    <p>Genera órdenes en el Punto de Venta para ver estadísticas de productos</p>
                </div>
            );
        }const productData = currentReport.top_products
            .filter(item => item && (item.quantity || item.quantity_sold || 0) > 0)
            .slice(0, 10)
            .map((item, index) => ({
                name: (item.product_name?.substring(0, 15) || `Producto ${index + 1}`) + (item.product_name?.length > 15 ? '...' : ''),
                cantidad: item.quantity || item.quantity_sold || 0,
                monto: parseFloat(item.total_amount || 0),
                categoria: item.category || 'Sin categoría'
            }));

        if (productData.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay productos vendidos para mostrar</p>
                </div>
            );
        }

        return (
            <div style={{ height: 400, marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: '#333' }}>Productos Más Vendidos</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="name" 
                            angle={-45} 
                            textAnchor="end" 
                            height={80}
                            fontSize={12}
                        />
                        <YAxis />
                        <Tooltip 
                            formatter={(value, name) => {
                                if (name === 'monto') return [formatCurrency(value), 'Monto Total'];
                                if (name === 'cantidad') return [value, 'Cantidad Vendida'];
                                return [value, name];
                            }}
                            labelFormatter={(label) => `Producto: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" name="Cantidad" fill="#8884d8" />
                        <Bar dataKey="monto" name="Monto Total" fill="#82ca9d" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };
// Renderizar gráfico de ventas por tipo de orden
    const renderSalesByOrderTypeChart = () => {
        if (!currentReport) return null;

        const orderTypeData = [
            { name: 'Dine-In', value: parseFloat(currentReport.dine_in_sales || 0) },
            { name: 'Takeout', value: parseFloat(currentReport.takeout_sales || 0) },
            { name: 'Delivery', value: parseFloat(currentReport.delivery_sales || 0) }
        ].filter(item => item.value > 0);

        if (orderTypeData.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay datos de tipos de orden</p>
                </div>
            );
        }

        return (
            <div style={{ height: 350, marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: '#333' }}>Ventas por Tipo de Orden</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={orderTypeData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {orderTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value) => [formatCurrency(value), 'Ventas']}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Renderizar gráfico de métodos de pago
    const renderPaymentMethodsChart = () => {
        if (!currentReport) return null;

        const paymentData = [
            { name: 'Efectivo', value: parseFloat(currentReport.cash_sales || 0) },
            { name: 'Tarjeta', value: parseFloat(currentReport.card_sales || 0) },
            { name: 'Otros', value: parseFloat(currentReport.other_sales || 0) }
        ].filter(item => item.value > 0);

        if (paymentData.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p>No hay datos de métodos de pago</p>
                </div>
            );
        }

        return (
            <div style={{ height: 350, marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: '#333' }}>Métodos de Pago</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={paymentData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {paymentData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value) => [formatCurrency(value), 'Ventas']}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Renderizar métricas principales
    const renderMetrics = () => {
        if (!currentReport) return null;

        const metrics = [
            { 
                title: 'Ventas Totales', 
                value: formatCurrency(currentReport.total_sales || 0),
                color: '#3b82f6',
                icon: '💰',
                description: `Promedio: ${formatCurrency(currentReport.average_order_value || 0)}`
            },
            { 
                title: 'Órdenes', 
                value: (currentReport.total_orders || 0).toLocaleString(),
                color: '#10b981',
                icon: '📋',
                description: `Productos/orden: ${(currentReport.average_items_per_order || 0).toFixed(1)}`
            },
            { 
                title: 'Clientes', 
                value: (currentReport.total_customers || 0).toLocaleString(),
                color: '#8b5cf6',
                icon: '👥',
                description: 'Clientes únicos'
            },
            { 
                title: 'Productos', 
                value: (currentReport.total_items_sold || 0).toLocaleString(),
                color: '#f59e0b',
                icon: '🛒',
                description: 'Total de unidades'
            },
            { 
                title: 'Descuentos', 
                value: formatCurrency(currentReport.total_discounts || 0),
                color: '#ef4444',
                icon: '🎯',
                description: 'Total en descuentos'
            },
            { 
                title: 'Propinas', 
                value: formatCurrency(currentReport.total_tips || 0),
                color: '#06b6d4',
                icon: '💵',
                description: 'Propinas recibidas'
            },
        ];

        return (
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 20,
                marginBottom: 30
            }}>
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: '#fff',
                            padding: 20,
                            borderRadius: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            borderLeft: `5px solid ${metric.color}`,
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ 
                                    margin: '0 0 10px 0', 
                                    color: '#666', 
                                    fontSize: '0.875rem',
                                    fontWeight: 500 
                                }}>
                                    {metric.title}
                                </p>
                                <h3 style={{ 
                                    margin: 0, 
                                    fontSize: '1.75rem', 
                                    fontWeight: 700,
                                    color: metric.color
                                }}>
                                    {metric.value}
                                </h3>
                                {metric.description && (
                                    <p style={{ 
                                        margin: '5px 0 0 0', 
                                        fontSize: '0.75rem', 
                                        color: '#6b7280'
                                    }}>
                                        {metric.description}
                                    </p>
                                )}
                            </div>
                            <span style={{ fontSize: '1.5rem' }}>{metric.icon}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Renderizar estadísticas de dashboard
    const renderDashboardStats = () => {
        if (!dashboardStats && connectionError) {
            return (
                <div style={{
                    backgroundColor: '#fff',
                    padding: 25,
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: 30,
                    border: '2px solid #f87171'
                }}>
                    <h3 style={{ marginBottom: 15, color: '#dc2626' }}>⚠️ No se pudo conectar al backend</h3>
                    <p style={{ color: '#666', marginBottom: 10 }}>
                        URL del backend: <strong>{getFastFoodBaseURL()}</strong>
                    </p>
                    <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: 15 }}>
                        Para ver reportes reales, necesitas:
                    </p>
                    <ol style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 15px 20px', padding: 0 }}>
                        <li>**1. Solucionar el error de migración/base de datos** (`UndefinedColumn` en los logs del backend).</li>
                        <li>**2. Verificar que fast-food-service esté corriendo.**</li>
                        <pre style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', margin: '5px 0' }}>
                            docker-compose ps fast-food-service
                        </pre>
                        <li>**3. Si el error 403 persiste al cerrar el día,** tu rol (**ADMIN_RESTAURANT**) necesita el permiso **`is_staff`** o la corrección de rol en `apps/pos/views.py`.</li>
                    </ol>
                    
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    await fetchDashboardStats();
                                    await fetchReports();
                                    setConnectionError(false);
                                } catch (err) {
                                    console.error('Error reconectando:', err);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            🔄 Reintentar Conexión
                        </button>
                    </div>
                    
                    {debugInfo && (
                        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '0.75rem' }}>
                            <strong>Información de depuración:</strong>
                            <pre style={{ margin: '5px 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {debugInfo}
                            </pre>
                        </div>
                    )}
                </div>
            );
        }
        
        if (!dashboardStats) return null;

        return (
            <div style={{
                backgroundColor: '#fff',
                padding: 25,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: 30
            }}>
                <h3 style={{ marginBottom: 20, color: '#333' }}>📊 Resumen del Día (Datos Reales)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.875rem' }}>Ventas Hoy</p>
                        <h4 style={{ margin: 0, fontSize: '1.5rem', color: '#059669' }}>
                            {formatCurrency(dashboardStats.sales?.today || dashboardStats.total_sales || 0)}
                        </h4>
                        {dashboardStats.sales?.change_percentage !== undefined && (
                            <p style={{ 
                                margin: '4px 0 0 0', 
                                fontSize: '0.875rem',
                                color: dashboardStats.sales?.trend === 'up' ? '#059669' : dashboardStats.sales?.trend === 'down' ? '#dc2626' : '#666'
                            }}>
                                {dashboardStats.sales?.trend === 'up' ? '↗' : dashboardStats.sales?.trend === 'down' ? '↘' : '→'} 
                                {Math.abs(dashboardStats.sales?.change_percentage || 0).toFixed(1)}% vs ayer
                            </p>
                        )}
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.875rem' }}>Órdenes Hoy</p>
                        <h4 style={{ margin: 0, fontSize: '1.5rem', color: '#3b82f6' }}>
                            {(dashboardStats.orders?.today || dashboardStats.total_orders || 0).toLocaleString()}
                        </h4>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.875rem' }}>Turnos Activos</p>
                        <h4 style={{ margin: 0, fontSize: '1.5rem', color: '#8b5cf6' }}>
                            {dashboardStats.shifts?.active || 0}
                        </h4>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.875rem' }}>Estado del Día</p>
                        <h4 style={{ 
                            margin: 0, 
                            fontSize: '1.5rem', 
                            color: currentReport?.is_closed ? '#dc2626' : '#059669'
                        }}>
                            {currentReport?.is_closed ? '🔒 Cerrado' : '✅ Abierto'}
                        </h4>
                    </div>
                </div>
                
                {dashboardStats.last_7_days && (
                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                        <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '0.875rem' }}>
                            📈 Ventas últimos 7 días:
                        </p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '60px' }}>
                            {dashboardStats.last_7_days.map((day, index) => (
                                <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                                    <div 
                                        style={{ 
                                            height: `${Math.max(10, (day.total_sales / 1000) * 40)}px`,
                                            backgroundColor: '#3b82f6',
                                            borderRadius: '4px 4px 0 0',
                                            marginBottom: '5px'
                                        }}
                                        title={`${day.day_name}: ${formatCurrency(day.total_sales)}`}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                        {/* CORRECCIÓN DE LOCALIZACIÓN */}
                                        {format(new Date(day.date), 'EEE', { locale: es }).toUpperCase()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '80vh',
                flexDirection: 'column'
            }}>
                <div style={{
                    width: 60,
                    height: 60,
                    border: '6px solid #f3f3f3',
                    borderTop: '6px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: 20
                }} />
                <h3 style={{ color: '#333', marginBottom: 10 }}>Conectando con el backend...</h3>
                <p style={{ color: '#666', maxWidth: 400, textAlign: 'center' }}>
                    Obteniendo datos reales de ventas desde {getFastFoodBaseURL()}
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '10px' }}>
                    Si tarda mucho, verifica que el servicio **fast-food-service** esté ejecutándose y migrado
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Título principal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                <div>
                    <h1 style={{ margin: 0, color: '#333' }}>📊 Reportes del Sistema</h1>
                    <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                        Datos en tiempo real desde la base de datos
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={closeDay}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: currentReport?.is_closed ? '#6b7280' : '#059669',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                        title="Cerrar día de operaciones y generar reporte final"
                        disabled={currentReport?.is_closed}
                    >
                        {currentReport?.is_closed ? '✅ Día Cerrado' : '🔒 Cerrar Día'}
                    </button>
                </div>
            </div>

            {/* Dashboard Stats */}
            {renderDashboardStats()}

            {/* Panel de Control */}
            <div style={{
                backgroundColor: '#fff',
                padding: 25,
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: 30
            }}>
                <h3 style={{ marginBottom: 20, color: '#333' }}>🔧 Generar Reporte</h3>
                
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Select Tipo de Reporte */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                            Tipo de Reporte
                        </label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            style={{
                                padding: '10px 15px',
                                borderRadius: 8,
                                border: '2px solid #e5e7eb',
                                minWidth: 200,
                                fontSize: '0.9375rem',
                                backgroundColor: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="daily">📅 Diario</option>
                            <option value="weekly">🗓️ Semanal</option>
                            <option value="monthly">📆 Mensual</option>
                            <option value="custom">🎯 Personalizado</option>
                        </select>
                    </div>

                    {/* Selector de Fechas */}
                    <div>
                        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                            {reportType === 'custom' ? 'Rango de Fechas' : 'Fecha'}
                        </label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <DatePicker
                                selected={dateRange.startDate}
                                onChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
                                dateFormat="dd/MM/yyyy"
                                locale={es}
                                className="date-picker-input"
                                wrapperClassName="date-picker"
                            />
                            
                            {reportType === 'custom' && (
                                <>
                                    <span style={{ color: '#666' }}>a</span>
                                    <DatePicker
                                        selected={dateRange.endDate}
                                        onChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
                                        dateFormat="dd/MM/yyyy"
                                        locale={es}
                                        className="date-picker-input"
                                        wrapperClassName="date-picker"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Botón Generar Reporte */}
                    <button
                        onClick={generateReport}
                        disabled={loadingData || connectionError}
                        style={{
                            padding: '10px 25px',
                            backgroundColor: loadingData || connectionError ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: loadingData || connectionError ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            minWidth: 150,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            height: '42px'
                        }}
                    >
                        {loadingData ? (
                            <>
                                <div style={{
                                    width: 16,
                                    height: 16,
                                    border: '2px solid #fff',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                Generando...
                            </>
                        ) : connectionError ? (
                            '❌ Conexión fallida'
                        ) : (
                            '📊 Generar Reporte Real'
                        )}
                    </button>
                </div>

                {/* Filtros Rápidos */}
                <div style={{ marginTop: 25 }}>
                    <label style={{ display: 'block', marginBottom: 10, fontWeight: 600, color: '#374151' }}>
                        Filtros Rápidos
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => applyQuickFilter(filter)}
                                disabled={connectionError}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: filterType === filter ? '#3b82f6' : '#f3f4f6',
                                    color: filterType === filter ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: connectionError ? 'not-allowed' : 'pointer',
                                    fontWeight: 500,
                                    fontSize: '0.875rem',
                                    transition: 'all 0.2s',
                                    opacity: connectionError ? 0.5 : 1
                                }}
                            >
                                {filter === 'today' && '📅 Hoy'}
                                {filter === 'yesterday' && '📅 Ayer'}
                                {filter === 'thisWeek' && '🗓️ Esta Semana'}
                                {filter === 'lastWeek' && '🗓️ Semana Pasada'}
                                {filter === 'thisMonth' && '📆 Este Mes'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
                {/* Lista de Reportes */}
                <div style={{ flex: 1, minWidth: 350 }}>
                    <div style={{
                        backgroundColor: '#fff',
                        padding: 25,
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        height: 'calc(100vh - 300px)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: 20,
                            paddingBottom: 15,
                            borderBottom: '2px solid #f3f4f6'
                        }}>
                            <h3 style={{ margin: 0, color: '#333' }}>
                                📋 Reportes Recientes
                                <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 'normal', marginLeft: '10px' }}>
                                    ({reports.length} reportes)
                                </span>
                            </h3>
                            <button
                                onClick={() => fetchReports()}
                                disabled={connectionError}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: connectionError ? '#9ca3af' : '#f3f4f6',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: connectionError ? 'not-allowed' : 'pointer',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    opacity: connectionError ? 0.5 : 1
                                }}
                            >
                                <span>🔄</span> Actualizar
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
                            {reports.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 20 }}>📊</div>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '1.125rem' }}>No hay reportes generados</p>
                                    <p style={{ fontSize: '0.875rem', marginBottom: 20 }}>
                                        {connectionError ? 
                                            'No se pudo conectar con el backend. Reintenta la conexión o revisa los logs.' : 
                                            'Genera órdenes en el Punto de Venta o usa el botón "Ver Reporte de Hoy".'}
                                    </p>
                                    <button
                                        onClick={() => applyQuickFilter('today')}
                                        disabled={connectionError}
                                        style={{
                                            marginTop: 15,
                                            padding: '10px 20px',
                                            backgroundColor: connectionError ? '#9ca3af' : '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 6,
                                            cursor: connectionError ? 'not-allowed' : 'pointer',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            opacity: connectionError ? 0.5 : 1
                                        }}
                                    >
                                        {connectionError ? '❌ Conexión fallida' : '🚀 Ver Reporte de Hoy'}
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {reports.slice(0, 20).map((report, index) => {
                                        const reportDate = report.date || report.start_date;
                                        const isSelected = currentReport?.id === report.id || 
                                            (currentReport?.date === reportDate && !currentReport?.id && !report.id);
                                        
                                        return (
                                            <div
                                                key={report.id || index}
                                                onClick={() => {
                                                    if (reportDate && !connectionError) {
                                                        const date = new Date(reportDate);
                                                        loadDailyReport(date);
                                                        setReportType('daily');
                                                        setDateRange({ 
                                                            startDate: date, 
                                                            endDate: date 
                                                        });
                                                    }
                                                }}
                                                style={{
                                                    backgroundColor: isSelected ? '#f0f9ff' : '#f9fafb',
                                                    padding: 16,
                                                    borderRadius: 10,
                                                    border: '2px solid',
                                                    borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
                                                    cursor: connectionError ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                    opacity: connectionError ? 0.5 : 1
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!connectionError) {
                                                        e.currentTarget.style.transform = 'translateX(4px)';
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!connectionError) {
                                                        e.currentTarget.style.transform = 'translateX(0)';
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#1f2937' }}>
                                                                {formatDate(reportDate)}
                                                            </h4>
                                                            {report.is_closed && (
                                                                <span style={{
                                                                    padding: '2px 8px',
                                                                    backgroundColor: '#10b981',
                                                                    color: 'white',
                                                                    borderRadius: 12,
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 600
                                                                }}>
                                                                    CERRADO
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#059669', fontWeight: 600 }}>
                                                            {formatCurrency(report.total_sales || 0)}
                                                        </p>
                                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
                                                            {report.total_orders || 0} órdenes • {report.total_customers || 0} clientes
                                                        </p>
                                                    </div>
                                                    
                                                    {isSelected && (
                                                        <div style={{
                                                            width: 8,
                                                            height: 8,
                                                            backgroundColor: '#3b82f6',
                                                            borderRadius: '50%'
                                                        }} />
                                                    )}
                                                </div>
                                                
                                                <div style={{ 
                                                    marginTop: 10, 
                                                    paddingTop: 10, 
                                                    borderTop: '1px solid #e5e7eb',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                        {report.generated_by || 'Sistema'}
                                                    </span>
                                                    {(report.top_products && report.top_products.length > 0) && (
                                                        <span style={{ 
                                                            fontSize: '0.75rem', 
                                                            color: '#3b82f6',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 4
                                                        }}>
                                                            📊 {report.top_products.length} productos
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Detalle del Reporte */}
                <div style={{ flex: 2 }}>
                    {currentReport ? (
                        <div style={{
                            backgroundColor: '#fff',
                            padding: 30,
                            borderRadius: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            minHeight: 'calc(100vh - 300px)',
                            overflowY: 'auto'
                        }}>
                            {/* Header del Reporte */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'flex-start',
                                marginBottom: 30,
                                paddingBottom: 20,
                                borderBottom: '2px solid #f3f4f6'
                            }}>
                                <div>
                                    <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>
                                        📊 Reporte {reportType === 'daily' ? 'Diario' : reportType === 'weekly' ? 'Semanal' : 'Mensual'}
                                    </h2>
                                    <div style={{ display: 'flex', gap: 15, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ 
                                            fontSize: '0.875rem', 
                                            color: '#6b7280',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            📅 {formatDate(currentReport.date || currentReport.start_date)} 
                                            {currentReport.end_date && currentReport.date !== currentReport.end_date && currentReport.start_date !== currentReport.end_date &&
                                                ` - ${formatDate(currentReport.end_date)}`}
                                        </span>
                                        <span style={{ 
                                            fontSize: '0.875rem', 
                                            color: '#6b7280',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            👤 {currentReport.generated_by || 'Sistema'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ 
                                        padding: '8px 16px', 
                                        backgroundColor: currentReport.is_closed ? '#d1fae5' : '#fef3c7',
                                        color: currentReport.is_closed ? '#065f46' : '#92400e',
                                        borderRadius: 20,
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        marginBottom: 8
                                    }}>
                                        {currentReport.is_closed ? '✅ DÍA CERRADO' : '🔄 DÍA ABIERTO'}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                                        {formatDate(currentReport.generated_at || new Date().toISOString())}
                                    </p>
                                </div>
                            </div>

                            {/* Advertencia si hay conexión fallida */}
                            {connectionError && (
                                <div style={{ 
                                    marginBottom: 30,
                                    padding: 20, 
                                    backgroundColor: '#fef3c7',
                                    borderRadius: 8,
                                    borderLeft: '4px solid #f59e0b'
                                }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#92400e' }}>⚠️ Nota importante</h4>
                                    <p style={{ margin: 0, color: '#92400e' }}>
                                        Estás viendo datos incompletos. Soluciona el error en el backend para ver datos en tiempo real y gráficos.
                                    </p>
                                </div>
                            )}

                            {/* Métricas Principales */}
                            {renderMetrics()}

                            {/* Gráficos */}
                            <div style={{ marginTop: 40 }}>
                                <h3 style={{ marginBottom: 20, color: '#333' }}>📈 Análisis y Gráficos</h3>
                                
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
                                    gap: 30,
                                    marginBottom: 30 
                                }}>
                                    {/* Ventas por Hora */}
                                    <div style={{
                                        backgroundColor: '#f9fafb',
                                        padding: 25,
                                        borderRadius: 10,
                                        borderLeft: '4px solid #8884d8'
                                    }}>
                                        {renderSalesByHourChart()}
                                    </div>

                                    {/* Productos Más Vendidos */}
                                    <div style={{
                                        backgroundColor: '#f9fafb',
                                        padding: 25,
                                        borderRadius: 10,
                                        borderLeft: '4px solid #82ca9d'
                                    }}>
                                        {renderTopProductsChart()}
                                    </div>
                                </div>

                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                                    gap: 30 
                                }}>
                                    {/* Ventas por Tipo de Orden */}
                                    <div style={{
                                        backgroundColor: '#f9fafb',
                                        padding: 25,
                                        borderRadius: 10,
                                        borderLeft: '4px solid #ff8042'
                                    }}>
                                        {renderSalesByOrderTypeChart()}
                                    </div>

                                    {/* Métodos de Pago */}
                                    <div style={{
                                        backgroundColor: '#f9fafb',
                                        padding: 25,
                                        borderRadius: 10,
                                        borderLeft: '4px solid #ffbb28'
                                    }}>
                                        {renderPaymentMethodsChart()}
                                    </div>
                                </div>
                            </div>

                            {/* Notas Adicionales */}
                            {currentReport.closing_notes && (
                                <div style={{ 
                                    marginTop: 40, 
                                    padding: 20, 
                                    backgroundColor: '#fef3c7',
                                    borderRadius: 8,
                                    borderLeft: '4px solid #f59e0b'
                                }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#92400e' }}>📝 Notas de Cierre</h4>
                                    <p style={{ margin: 0, color: '#92400e' }}>{currentReport.closing_notes}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            backgroundColor: '#fff',
                            padding: 60,
                            borderRadius: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            textAlign: 'center',
                            height: 'calc(100vh - 300px)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <div style={{ 
                                width: 80, 
                                height: 80, 
                                backgroundColor: '#f3f4f6', 
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 20
                            }}>
                                <span style={{ fontSize: '2rem' }}>📊</span>
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Selecciona un reporte</h3>
                            <p style={{ color: '#666', marginBottom: 30, maxWidth: 400 }}>
                                Haz clic en un reporte de la lista para ver su información detallada, 
                                métricas y gráficos de análisis
                            </p>
                            <button
                                onClick={() => applyQuickFilter('today')}
                                disabled={connectionError}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: connectionError ? '#9ca3af' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: connectionError ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: connectionError ? 0.5 : 1
                                }}
                            >
                                {connectionError ? '❌ Conexión fallida' : '🚀 Ver Reporte de Hoy'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Estilos CSS */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .date-picker input {
                    padding: 10px 15px;
                    border-radius: 8px;
                    border: 2px solid #e5e7eb;
                    width: 150px;
                    font-size: 0.9375rem;
                    box-sizing: border-box;
                }
                
                .date-picker input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                
                ::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 4px;
                }
                
                ::-webkit-scrollbar-thumb:hover {
                    background: #a1a1a1;
                }
                
                .date-picker-input {
                    width: 150px !important;
                }
            `}</style>
        </div>
    );
};

export default Reportes;