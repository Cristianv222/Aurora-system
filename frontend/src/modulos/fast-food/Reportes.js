// modulos/fast-food/Reportes.js - VERSIÓN CONSOLIDADA FINAL Y CORREGIDA

import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
    BarChart, Bar, PieChart, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area, Pie
} from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ====================================================================
// 1. Funciones de Ayuda (Estilos, Formato)
// ====================================================================
const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];

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

// ====================================================================
// 2. Lógica del PDF (Impresión Detallada) - CORREGIDA
// ====================================================================

// FUNCIÓN CLAVE PARA EVITAR EL ERROR 'Invalid time value'
// FUNCIÓN CLAVE PARA EVITAR EL ERROR 'Invalid time value'
const getValidDate = (dateValue) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
};

const generateDetailedPDF = (report, reportType, dateRangeStr) => {
    if (!report) {
        alert('No hay reporte seleccionado para imprimir.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;
    const MARGIN = 10;
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const MIN_SPACE_FOR_SECTION = 30; // Espacio mínimo requerido para un nuevo título y algo de contenido.

    // 1. Manejo de fechas para el TÍTULO y nombre de archivo
    const reportDateForFilename = getValidDate(report.date || report.start_date) || new Date(); 

    // Título y Subtítulo
    doc.setFontSize(18);
    doc.text(`Reporte de Ventas Detallado: ${reportType}`, pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    const formattedGenerationDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    doc.text(`Período: ${dateRangeStr} | Generado: ${formattedGenerationDate}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 5;

    // --- 1. Resumen Principal ---
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Resumen General', MARGIN, y);
    y += 5;

    const summaryData = [
        ['Ventas Totales', formatCurrency(report.total_sales || 0)],
        ['Órdenes Totales', (report.total_orders || 0).toLocaleString()],
        ['Productos Vendidos (Unidades)', (report.total_items_sold || 0).toLocaleString()],
        ['Clientes Únicos', (report.total_customers || 0).toLocaleString()],
        ['Promedio por Orden', formatCurrency(report.average_order_value || 0)],
        ['Total Descuentos', formatCurrency(report.total_discounts || 0)],
    ];

    doc.autoTable({
        startY: y + 5,
        head: [['Métrica', 'Valor']],
        body: summaryData,
        theme: 'striped',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [44, 62, 80] },
        margin: { left: MARGIN, right: MARGIN },
        didParseCell: (data) => {
            if (data.column.index === 1) {
                data.cell.styles.halign = 'right';
            }
        }
    });

    y = doc.lastAutoTable.finalY + 10;

    // --- 2. Detalle de Órdenes (Control de salto de página) ---

    // Chequeamos si el siguiente encabezado cabe en la página
    if (PAGE_HEIGHT - y < MIN_SPACE_FOR_SECTION) {
        doc.addPage();
        y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('2. Detalle de Órdenes (Listado Completo)', MARGIN, y);
    y += 5;

    const ordersDetail = report.orders_detail || [];

    if (ordersDetail.length > 0) {
        const orderData = [];
        ordersDetail.forEach((order, index) => {
            const orderDateValue = order.timestamp || report.date;
            const validOrderDate = getValidDate(orderDateValue);
            const timeFormatted = validOrderDate ? format(validOrderDate, 'HH:mm:ss') : 'N/A';
            
            // Fila de la Orden (encabezado)
            orderData.push([
                { content: `ORDEN #${order.order_id || index + 1} (${order.customer_name || 'Anónimo'})`, colSpan: 4, styles: { fillColor: [230, 230, 250], fontStyle: 'bold' } },
            ]);
            orderData.push([
                { content: 'Fecha/Hora', styles: { fontStyle: 'bold' } },
                { content: 'Monto Total', styles: { fontStyle: 'bold', halign: 'right' } },
                { content: 'Tipo Pago', styles: { fontStyle: 'bold' } },
                { content: 'Estado', styles: { fontStyle: 'bold' } },
            ]);
            orderData.push([
                timeFormatted,
                formatCurrency(order.total_amount || 0),
                order.payment_method || 'N/A',
                order.status || 'Completada',
            ]);
            // Fila de los Ítems
            orderData.push([
                { content: 'Ítem', styles: { fontStyle: 'bold' } },
                { content: 'Cantidad', styles: { fontStyle: 'bold', halign: 'right' } },
                { content: 'Precio Unitario', styles: { fontStyle: 'bold', halign: 'right' } },
                { content: 'Subtotal', styles: { fontStyle: 'bold', halign: 'right' } },
            ]);
            (order.items || []).forEach(item => {
                orderData.push([
                    item.product_name || 'Producto Desconocido',
                    (item.quantity || 1).toString(),
                    formatCurrency(item.unit_price || 0),
                    formatCurrency(item.subtotal || 0),
                ]);
            });
            // Separador
            orderData.push([
                { content: '', colSpan: 4, styles: { fillColor: [255, 255, 255], minCellHeight: 3 } }
            ]);
        });

        doc.autoTable({
            startY: y + 5,
            head: [], 
            body: orderData,
            theme: 'plain',
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 55 },
                1: { cellWidth: 25, halign: 'right' },
                2: { cellWidth: 40, halign: 'right' },
                3: { cellWidth: 40, halign: 'right' },
            },
            margin: { left: MARGIN, right: MARGIN },
        });

        y = doc.lastAutoTable.finalY + 10;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('No hay detalles de órdenes para este reporte.', MARGIN, y + 5);
        y += 10;
    }

    // --- 3. Productos Más Vendidos (Control de salto de página) ---

    // Chequeamos si el siguiente encabezado cabe en la página
    if (PAGE_HEIGHT - y < MIN_SPACE_FOR_SECTION) {
        doc.addPage();
        y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('3. Top 10 Productos Más Vendidos', MARGIN, y);
    y += 5;

    const topProducts = (report.top_products || [])
        .slice(0, 10)
        .map(p => [
            p.product_name || 'Desconocido',
            (p.quantity || p.quantity_sold || 0).toLocaleString(),
            formatCurrency(p.total_amount || 0)
        ]);

    doc.autoTable({
        startY: y + 5,
        head: [['Producto', 'Unidades Vendidas', 'Monto Generado']],
        body: topProducts.length > 0 ? topProducts : [['No hay datos de productos.']],
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [243, 156, 18] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        margin: { left: MARGIN, right: MARGIN },
    });

    doc.save(`Reporte_Ventas_${reportType}_${format(reportDateForFilename, 'yyyyMMdd')}.pdf`);
};

// ====================================================================
// 3. Componente Principal (Reportes)
// ====================================================================

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
    }, []);

    // Obtener la lista de reportes recientes Y el reporte de hoy
    const fetchReports = useCallback(async () => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');

            const listResponse = await api.get('/api/pos/daily-summaries/', {
                baseURL: getFastFoodBaseURL(),
                params: { ordering: '-date', limit: 30 },
                timeout: 10000
            });

            let reportsData = listResponse.data.results || listResponse.data;
            if (!Array.isArray(reportsData)) reportsData = [];

            const todayResponse = await api.get('/api/pos/daily-summaries/today/', {
                baseURL: getFastFoodBaseURL(),
                timeout: 10000
            });

            const todayReport = todayResponse.data;
            const todayDateStr = todayReport.date_formatted || todayReport.date;

            const updatedReports = reportsData.filter(r => r.date !== todayDateStr);
            updatedReports.unshift(todayReport);

            setReports(updatedReports);

            if (format(dateRange.startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                 setCurrentReport(todayReport);
            }

        } catch (err) {
            console.error('Error loading reports (fetchReports):', err);
            throw new Error('Error al cargar reportes listados.');
        } finally {
            setLoadingData(false);
        }
    }, [dateRange.startDate]);

    // Cargar reporte diario específico (usa generate/ para asegurar la actualización y actualizar todo el panel)
    const loadDailyReport = useCallback(async (date) => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setDebugInfo('');

            const dateStr = format(date, 'yyyy-MM-dd');

            // 1. Forzar la generación/actualización - Pedir detalle de órdenes
            const response = await api.post('/api/pos/daily-summaries/generate/', {
                date: dateStr,
                detailed: true,
                include_orders_detail: true // Solicitar detalle de órdenes completo
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            const generatedSummary = response.data.summary;

            if (generatedSummary) {
                setCurrentReport(generatedSummary);

                // 2. Actualizar la lista superior y el dashboard
                await fetchReports();
                await fetchDashboardStats();
            }

        } catch (err) {
            console.error('Error loading daily report:', err);

            let errorMessage = `Error al cargar/generar reporte para ${format(date, 'dd/MM/yyyy')}.`;
            if (err.response?.status === 500) {
                errorMessage += '\n\nError interno del servidor (500). Revise los logs.';
            }

            setConnectionError(true);
            setDebugInfo(`URL: ${getFastFoodBaseURL()}\nFecha: ${format(date, 'yyyy-MM-dd')}\nError: ${err.message}`);

        } finally {
            setLoadingData(false);
        }
    }, [fetchReports, fetchDashboardStats]);

    // Generar reporte (función que maneja rangos/semanales/mensuales)
    const generateReport = useCallback(async (currentReportType, currentRange) => {
         try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setDebugInfo('');

            const startDate = format(currentRange.startDate, 'yyyy-MM-dd');
            const endDate = format(currentRange.endDate, 'yyyy-MM-dd');

            if (currentReportType === 'daily') {
                 await loadDailyReport(currentRange.startDate);
                 return;
            }

            const payload = {
                report_type: currentReportType,
                include_orders_detail: true // Solicitar detalle de órdenes
            };

            if (currentReportType === 'weekly') {
                payload.start_date = format(startOfWeek(currentRange.startDate, { locale: es }), 'yyyy-MM-dd');
                payload.end_date = format(endOfWeek(currentRange.startDate, { locale: es }), 'yyyy-MM-dd');
            } else if (currentReportType === 'monthly') {
                payload.year = currentRange.startDate.getFullYear();
                payload.month = currentRange.startDate.getMonth() + 1;
            } else if (currentReportType === 'custom') {
                payload.report_type = 'range';
                payload.start_date = startDate;
                payload.end_date = endDate;
            }

            const response = await api.post('/api/pos/daily-summaries/get_report/', payload, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            setCurrentReport(response.data.data || response.data);
            await fetchDashboardStats();

        } catch (err) {
            console.error('Error generating report (range):', err);

            let errorMessage = 'Error al generar reporte de rango.';
            if (err.response) {
                 if (err.response.status === 500) {
                      errorMessage = `Error interno del servidor: ${err.response.data?.error || 'Revisa logs de Django.'}`;
                 } else if (err.response.data?.detail) {
                      errorMessage = `${err.response.data.detail}`;
                 }
            } else if (err.message) {
                 errorMessage = `${err.message}`;
            }

            setConnectionError(true);
            setError(errorMessage);

        } finally {
            setLoadingData(false);
        }
    }, [fetchDashboardStats, loadDailyReport]);


    // Hook de inicialización
    useEffect(() => {
        const initializeReports = async () => {
            setLoading(true);
            try {
                await fetchDashboardStats();
                await fetchReports();
                setConnectionError(false);
                loadDailyReport(new Date());

            } catch (err) {
                console.error('Error inicializando reportes:', err);
                setConnectionError(true);
                setError('Error al conectar con el backend. Verifica que el servicio fast-food-service esté ejecutándose y migrado.');
                setDebugInfo(`Error: ${err.message}\nURL: ${getFastFoodBaseURL()}\nStatus: ${err.response?.status}`);
            } finally {
                setLoading(false);
            }
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
        initializeReports();
    }, []);

    // Cerrar día
   const closeDay = async () => {
        if (!window.confirm('¿Estás seguro de cerrar el día? Esta acción generará un reporte final y cerrará todos los turnos abiertos.')) {
            return;
        }

        try {
            setConnectionError(false);
            setError('');
            setDebugInfo('');

            await api.post('/api/pos/daily-summaries/close_day/', {
                date: format(new Date(), 'yyyy-MM-dd'),
                closing_notes: 'Cierre manual del día'
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            alert('Día cerrado exitosamente. Reporte final generado.');

            await fetchReports();
            await fetchDashboardStats();
            loadDailyReport(new Date());

        } catch (err) {
            console.error('Error closing day:', err);
            setError('Error al cerrar el día: ' + (err.response?.data?.error || err.message));
            setConnectionError(true);
            alert('Error al cerrar el día. Verifica que tengas permisos.');
        }
    };

    // Aplicar filtro rápido y GENERAR el reporte automáticamente
    const applyQuickFilter = (filter) => {
        setFilterType(filter);
        const today = new Date();
        let newRange = { startDate: today, endDate: today };
        let newReportType = 'daily';

        switch (filter) {
            case 'today':
                newReportType = 'daily';
                newRange = { startDate: today, endDate: today };
                loadDailyReport(today);
                break;
            case 'yesterday':
                const yesterday = subDays(today, 1);
                newReportType = 'daily';
                newRange = { startDate: yesterday, endDate: yesterday };
                loadDailyReport(yesterday);
                break;
            case 'thisWeek':
                newReportType = 'weekly';
                newRange = {
                    startDate: startOfWeek(today, { locale: es }),
                    endDate: today
                };
                generateReport(newReportType, newRange);
                break;
            case 'lastWeek':
                newReportType = 'weekly';
                const lastWeekStart = subDays(startOfWeek(today, { locale: es }), 7);
                const lastWeekEnd = subDays(endOfWeek(today, { locale: es }), 7);
                newRange = {
                    startDate: lastWeekStart,
                    endDate: lastWeekEnd
                };
                generateReport(newReportType, newRange);
                break;
            case 'thisMonth':
                newReportType = 'monthly';
                newRange = {
                    startDate: startOfMonth(today),
                    endDate: today
                };
                generateReport(newReportType, newRange);
                break;
            default:
                newReportType = 'daily';
                newRange = { startDate: today, endDate: today };
                loadDailyReport(today);
        }

        setReportType(newReportType);
        setDateRange(newRange);
    };

    // --- Funciones de Renderizado ---

    // Renderizar estadísticas de dashboard
    const renderDashboardStats = () => {
        if (!dashboardStats && connectionError) {
            return (
                <div className="card alert-card">
                    <h3 style={{ marginBottom: 15, color: '#dc2626' }}>⚠️ No se pudo conectar al backend</h3>
                    <p style={{ color: '#666', marginBottom: 10 }}>
                        URL del backend: <strong>{getFastFoodBaseURL()}</strong>
                    </p>
                    <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: 15 }}>
                        Para ver reportes reales, verifica que el servicio fast-food-service esté corriendo.
                    </p>

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
                        className="action-button primary"
                    >
                        🔄 Reintentar Conexión
                    </button>

                    {debugInfo && (
                        <div className="debug-info">
                            <strong>Información de depuración:</strong>
                            <pre>{debugInfo}</pre>
                        </div>
                    )}
                </div>
            );
        }

        if (!dashboardStats) return null;

        const isDayClosed = currentReport?.is_closed;

        return (
            <div className="dashboard-stats card">
                <h3 className="panel-title">📊 Resumen del Día</h3>

                <div className="stats-grid">
                    <div className="stat-item">
                        <p className="stat-label">Ventas Hoy</p>
                        <h4 className="stat-value sales-color">
                            {formatCurrency(dashboardStats.sales?.today || dashboardStats.total_sales || 0)}
                        </h4>
                        {dashboardStats.sales?.change_percentage !== undefined && (
                            <p className={`stat-trend ${dashboardStats.sales?.trend === 'up' ? 'up' : 'down'}`}>
                                {dashboardStats.sales?.trend === 'up' ? '↗' : dashboardStats.sales?.trend === 'down' ? '↘' : '→'}
                                {Math.abs(dashboardStats.sales?.change_percentage || 0).toFixed(1)}% vs ayer
                            </p>
                        )}
                    </div>

                    <div className="stat-item">
                        <p className="stat-label">Órdenes Hoy</p>
                        <h4 className="stat-value order-color">
                            {(dashboardStats.orders?.today || dashboardStats.total_orders || 0).toLocaleString()}
                        </h4>
                    </div>

                    {/* OCULTAR TURNO ACTIVO SI EL DÍA ESTÁ CERRADO */}
                    {!isDayClosed && (
                        <div className="stat-item">
                            <p className="stat-label">Turnos Activos</p>
                            <h4 className="stat-value shift-color">
                                {dashboardStats.shifts?.active || 0}
                            </h4>
                        </div>
                    )}

                    <div className="stat-item">
                        <p className="stat-label">Estado del Día</p>
                        <h4 className={`stat-value ${isDayClosed ? 'closed-color' : 'open-color'}`}>
                            {isDayClosed ? 'Cerrado' : 'Abierto'}
                        </h4>
                    </div>
                </div>

                {dashboardStats.last_7_days && (
                    <div className="weekly-trend">
                        <p className="trend-label">📈 Ventas últimos 7 días:</p>
                        <div className="bar-chart-7d">
                            {dashboardStats.last_7_days.map((day, index) => (
                                <div key={index} className="bar-wrapper">
                                    <div
                                        className="bar-item"
                                        style={{
                                            height: `${Math.max(10, (day.total_sales / 1000) * 40)}px`,
                                        }}
                                        title={`${day.day_name}: ${formatCurrency(day.total_sales)}`}
                                    />
                                    <div className="bar-day">
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

    // Renderizar métricas principales
    const renderMetrics = () => {
        if (!currentReport) return null;

        const metrics = [
            {
                title: 'Ventas Totales',
                value: formatCurrency(currentReport.total_sales || 0),
                color: COLORS[0],
                icon: 'monetization_on',
                description: `Promedio: ${formatCurrency(currentReport.average_order_value || 0)}`
            },
            {
                title: 'Órdenes',
                value: (currentReport.total_orders || 0).toLocaleString(),
                color: COLORS[1],
                icon: 'receipt_long',
                description: `Items/orden: ${(currentReport.average_items_per_order || 0).toFixed(1)}`
            },
            {
                title: 'Productos (Unidades)',
                value: (currentReport.total_items_sold || 0).toLocaleString(),
                color: COLORS[2],
                icon: 'shopping_cart',
                description: 'Total de unidades vendidas'
            },
            {
                title: 'Clientes',
                value: (currentReport.total_customers || 0).toLocaleString(),
                color: COLORS[3],
                icon: 'group',
                description: 'Clientes únicos registrados'
            },
            {
                title: 'Descuentos',
                value: formatCurrency(currentReport.total_discounts || 0),
                color: COLORS[4],
                icon: 'discount',
                description: 'Total aplicado'
            },
            {
                title: 'Propinas',
                value: formatCurrency(currentReport.total_tips || 0),
                color: COLORS[6],
                icon: 'attach_money',
                description: 'Propinas recibidas'
            },
        ];

        return (
            <div className="metrics-grid">
                {metrics.map((metric, index) => (
                    <div key={index} className="metric-card">
                        <div className="metric-header">
                            <span className="material-icons" style={{ color: metric.color }}>{metric.icon}</span>
                            <p className="metric-title">{metric.title}</p>
                        </div>
                        <h3 className="metric-value" style={{ color: metric.color }}>
                            {metric.value}
                        </h3>
                        {metric.description && (
                            <p className="metric-description">
                                {metric.description}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // Renderizar gráfico de ventas por hora
    const renderSalesByHourChart = () => {
        if (!currentReport?.sales_by_hour || !Array.isArray(currentReport.sales_by_hour) || currentReport.sales_by_hour.length === 0) {
            return <div className="no-data-chart">No hay datos de ventas por hora disponibles.</div>;
        }
        const hourData = currentReport.sales_by_hour
            .filter(item => item && item.total_sales !== undefined)
            .map(item => ({
                hora: item.hour_label || `${item.hour}:00`,
                ventas: parseFloat(item.total_sales || 0),
            }))
            .sort((a, b) => parseInt(a.hora.split(':')[0]) - parseInt(b.hora.split(':')[0]));

        return (
            <div className="chart-container">
                <h4 className="chart-title">Ventas por Hora (MXN)</h4>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={hourData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="hora" style={{ fontSize: '10px' }} />
                        <YAxis tickFormatter={(value) => formatCurrency(value).replace('$', '')} style={{ fontSize: '10px' }} />
                        <Tooltip
                            formatter={(value, name) => [formatCurrency(value), 'Ventas']}
                            labelFormatter={(label) => `Hora: ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="ventas"
                            stroke={COLORS[0]}
                            fill={COLORS[0]}
                            fillOpacity={0.2}
                            name="Ventas"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Renderizar gráfico de productos más vendidos
    const renderTopProductsChart = () => {
        if (!currentReport?.top_products || !Array.isArray(currentReport.top_products) || currentReport.top_products.length === 0) {
            return <div className="no-data-chart">No hay datos de productos vendidos.</div>;
        }

        const productData = currentReport.top_products
            .filter(item => item && (item.quantity || item.quantity_sold || 0) > 0)
            .slice(0, 10)
            .map((item, index) => ({
                name: item.product_name?.substring(0, 25) + (item.product_name?.length > 25 ? '...' : '') || `Producto ${index + 1}`,
                cantidad: item.quantity || item.quantity_sold || 0,
            }));

        return (
            <div className="chart-container">
                <h4 className="chart-title">Top 10 Productos (Unidades)</h4>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={productData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={50} style={{ fontSize: '10px' }} />
                        <YAxis style={{ fontSize: '10px' }} />
                        <Tooltip
                            formatter={(value) => [value, 'Cantidad Vendida']}
                            labelFormatter={(label) => `Producto: ${label}`}
                        />
                        <Legend />
                        <Bar dataKey="cantidad" name="Cantidad" fill={COLORS[1]} />
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
            return <div className="no-data-chart">No hay datos de tipos de orden.</div>;
        }

        return (
            <div className="chart-container">
                <h4 className="chart-title">Ventas por Tipo de Orden (MXN)</h4>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={orderTypeData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                            {orderTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => [formatCurrency(value), 'Ventas']}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
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
            return <div className="no-data-chart">No hay datos de métodos de pago.</div>;
        }

        return (
            <div className="chart-container">
                <h4 className="chart-title">Métodos de Pago (MXN)</h4>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={paymentData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            labelLine={true}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                            {paymentData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => [formatCurrency(value), 'Ventas']}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    // Función para manejar la impresión a PDF
    const handlePrintPDF = () => {
        const start = formatDate(currentReport.date || currentReport.start_date);
        const end = currentReport.end_date && currentReport.date !== currentReport.end_date ? formatDate(currentReport.end_date) : '';
        const rangeStr = end ? `${start} - ${end}` : start;
        const typeStr = reportType === 'daily' ? 'Diario' : reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensual' : 'Personalizado';

        generateDetailedPDF(currentReport, typeStr, rangeStr);
    };

    // Renderizado del Detalle de Órdenes en la Web
    const renderDetailedOrdersTable = () => {
        const ordersDetail = currentReport?.orders_detail || [];

        if (ordersDetail.length === 0) {
            return (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666', border: '1px dashed #ccc', borderRadius: 8 }}>
                    No hay detalles de órdenes disponibles para este reporte.
                </div>
            );
        }

        return (
            <div style={{ marginTop: 20 }}>
                <h4 style={{ marginBottom: 15, color: '#333', borderBottom: '1px solid #eee', paddingBottom: 10 }}>Desglose de Órdenes por Cliente</h4>
                {ordersDetail.map((order, index) => {
                    const orderDateValue = order.timestamp || currentReport.date;
                    const validOrderDate = getValidDate(orderDateValue);
                    const timeFormatted = validOrderDate ? format(validOrderDate, 'HH:mm:ss') : 'N/A';

                    return (
                        <div key={order.order_id || index} style={{ marginBottom: 20, padding: 15, border: '1px solid #f3f4f6', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: '10px 15px', borderRadius: 6 }}>
                                <h5 style={{ margin: 0, color: '#1f77b4', fontSize: '1rem' }}>
                                    ORDEN #{order.order_id || index + 1} ({order.customer_name || 'Anónimo'})
                                </h5>
                                <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 'bold' }}>
                                    Total: {formatCurrency(order.total_amount || 0)}
                                </span>
                            </div>
                            <p style={{ margin: '10px 0 5px 0', fontSize: '0.85rem', color: '#666' }}>
                                **Método de Pago:** {order.payment_method || 'N/A'} | **Estado:** {order.status || 'Completada'} | **Hora:** {timeFormatted}
                            </p>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eef' }}>
                                        <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'left', fontSize: '0.85rem' }}>Ítem</th>
                                        <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right', fontSize: '0.85rem' }}>Cantidad</th>
                                        <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right', fontSize: '0.85rem' }}>P. Unitario</th>
                                        <th style={{ padding: 8, border: '1px solid #ddd', textAlign: 'right', fontSize: '0.85rem' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.items || []).map((item, itemIndex) => (
                                        <tr key={itemIndex}>
                                            <td style={{ padding: 8, border: '1px solid #eee', fontSize: '0.8rem' }}>{item.product_name || 'Producto Desconocido'}</td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{(item.quantity || 1).toLocaleString()}</td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{formatCurrency(item.unit_price || 0)}</td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{formatCurrency(item.subtotal || 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        );
    };


    if (loading) {
        return <div className="loading-screen">Cargando datos iniciales...</div>;
    }


    // El resto del JSX

    return (
        <div className="reportes-container">
            {/* Título principal */}
            <div className="header-bar">
                <div>
                    <h1 className="main-title">📊 Reportes del Sistema</h1>
                    <p className="subtitle">Datos en tiempo real desde la base de datos.</p>
                </div>
                <div className="actions-group">
                    <button
                        onClick={closeDay}
                        disabled={currentReport?.is_closed || connectionError}
                        className={`action-button ${currentReport?.is_closed ? 'closed' : 'open'}`}
                    >
                        {currentReport?.is_closed ? '✅ Día Cerrado' : '🔒 Cerrar Día'}
                    </button>
                    {currentReport && (
                        <button
                            onClick={handlePrintPDF}
                            disabled={loadingData || connectionError}
                            className="action-button primary"
                            style={{ backgroundColor: '#cc3333' }}
                        >
                            🖨️ Imprimir PDF Detallado
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard Stats (Resuelve el error al estar definida arriba) */}
            {renderDashboardStats()}

            {/* Panel de Control */}
            <div className="control-panel card">
                <h3 className="panel-title">🔧 Filtros y Generación</h3>

                <div className="filter-group">
                    {/* Select Tipo de Reporte */}
                    <div className="filter-item">
                        <label className="filter-label">Tipo de Reporte</label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            className="form-select"
                        >
                            <option value="daily">📅 Diario</option>
                            <option value="weekly">🗓️ Semanal</option>
                            <option value="monthly">📆 Mensual</option>
                            <option value="custom">🎯 Personalizado</option>
                        </select>
                    </div>

                    {/* Selector de Fechas */}
                    <div className="filter-item">
                        <label className="filter-label">
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

                    {/* Botón Generar Reporte (Solo para Custom/Rangos) */}
                    {(reportType !== 'daily' && filterType === 'custom') && (
                        <button
                            onClick={() => generateReport(reportType, dateRange)}
                            disabled={loadingData || connectionError}
                            className={`generate-button ${loadingData ? 'loading' : ''}`}
                        >
                             {loadingData ? 'Generando...' : '📊 Generar Reporte'}
                        </button>
                    )}
                </div>

                {/* Filtros Rápidos */}
                <div style={{ marginTop: 25 }}>
                    <label className="filter-label">Filtros Rápidos</label>
                    <div className="quick-filters">
                        {['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => applyQuickFilter(filter)}
                                disabled={connectionError}
                                className={`quick-filter-button ${filterType === filter ? 'active' : ''}`}
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
            <div className="content-layout">
                {/* Lista de Reportes */}
                <div className="reports-list-panel card">
                    <div className="panel-header">
                        <h3 className="panel-title">📋 Reportes Recientes ({reports.length})</h3>
                        <button
                            onClick={() => fetchReports()}
                            disabled={connectionError}
                            className="refresh-button"
                        >
                            🔄 Actualizar
                        </button>
                    </div>

                    <div className="reports-scroll">
                        {reports.length === 0 ? (
                            <div className="no-reports">No hay reportes generados.</div>
                        ) : (
                            <div className="reports-item-list">
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
                                                    setFilterType(format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'today' : 'daily');
                                                    setReportType('daily');
                                                    setDateRange({ startDate: date, endDate: date });
                                                    loadDailyReport(date);
                                                }
                                            }}
                                            className={`report-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className="item-content">
                                                <div className="item-status">
                                                    <h4 className="item-date">{formatDate(reportDate)}</h4>
                                                    {report.is_closed && (
                                                        <span className="status-badge closed-badge">✅ CERRADO</span>
                                                    )}
                                                </div>

                                                <p className="item-sales">💰 {formatCurrency(report.total_sales || 0)}</p>
                                                <p className="item-summary">
                                                    {report.total_orders || 0} órdenes • {report.total_customers || 0} clientes
                                                </p>
                                            </div>
                                            <div className="item-footer">
                                                <span className="item-source">👤 Generado por: {report.generated_by || 'Sistema'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detalle del Reporte */}
                <div className="report-detail-panel card">
                    {currentReport ? (
                        <>
                            {/* Header del Reporte */}
                            <div className="detail-header">
                                <div>
                                    <h2 className="detail-title">📊 Reporte {reportType === 'daily' ? 'Diario' : reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensual' : 'Personalizado'}</h2>
                                    <div className="detail-metadata">
                                        <span className="metadata-item">📅 Fecha: {formatDate(currentReport.date || currentReport.start_date)}
                                            {currentReport.end_date && currentReport.date !== currentReport.end_date && currentReport.start_date !== currentReport.end_date &&
                                                ` - ${formatDate(currentReport.end_date)}`}
                                        </span>
                                        <span className="metadata-item">👤 Usuario: {currentReport.generated_by || 'Sistema'}</span>
                                    </div>
                                </div>
                                <div className="detail-status">
                                    <div className={`status-pill ${currentReport.is_closed ? 'closed-pill' : 'open-pill'}`}>
                                        {currentReport.is_closed ? '🔒 DÍA CERRADO' : '🔄 DÍA ABIERTO'}
                                    </div>
                                    <p className="generation-date">Actualizado: {formatDate(currentReport.generated_at || new Date().toISOString())}</p>
                                </div>
                            </div>

                            {/* Alerta de Conexión */}
                            {connectionError && (
                                <div className="alert warning-alert">
                                    <h4 className="alert-title">⚠️ Nota importante</h4>
                                    <p>Estás viendo datos incompletos. Soluciona el error en el backend para ver datos en tiempo real y gráficos.</p>
                                </div>
                            )}

                            {/* Métricas Principales */}
                            <h3 className="section-title">✨ Métricas de Rendimiento</h3>
                            {renderMetrics()}

                            {/* Gráficos (Organizados en 2 columnas) */}
                            <h3 className="section-title chart-section">📈 Análisis y Gráficos</h3>

                            <div className="charts-grid">
                                {renderSalesByHourChart()}
                                {renderTopProductsChart()}
                                {renderSalesByOrderTypeChart()}
                                {renderPaymentMethodsChart()}
                            </div>

                            {/* Detalle de Órdenes */}
                            <h3 className="section-title detail-section">📋 Detalle de Órdenes (Web)</h3>
                            {renderDetailedOrdersTable()}

                            {/* Notas Adicionales */}
                            {currentReport.closing_notes && (
                                <div className="alert notes-alert">
                                    <h4 className="alert-title">📝 Notas de Cierre</h4>
                                    <p>{currentReport.closing_notes}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <span className="material-icons" style={{ fontSize: '4rem', color: '#ccc' }}>assessment</span>
                            <h3 className="empty-title">Selecciona un reporte</h3>
                            <p className="empty-message">Haz clic en un reporte de la lista para ver su información detallada, métricas y gráficos de análisis.</p>
                            <button
                                onClick={() => applyQuickFilter('today')}
                                disabled={connectionError}
                                className="action-button primary"
                            >
                                {connectionError ? '❌ Error de Conexión' : '🚀 Ver Reporte de Hoy'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Estilos CSS Globales */}
            <style>{`
                @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
                
                :root {
                    --primary: #1f77b4;
                    --secondary: #ff7f0e;
                    --success: #2ca02c;
                    --danger: #d62728;
                    --warning: #ffbb28;
                    --background-light: #f4f7f9;
                    --card-bg: #ffffff;
                    --text-dark: #333;
                    --text-muted: #666;
                    --border-color: #e5e7eb;
                }
                
                .reportes-container {
                    padding: 20px;
                    max-width: 1600px;
                    margin: 0 auto;
                    font-family: Arial, sans-serif;
                }

                .card {
                    background-color: var(--card-bg);
                    padding: 25px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    margin-bottom: 20px;
                }
                
                .alert-card {
                    border: 2px solid #f87171;
                    padding: 20px;
                }

                .debug-info {
                    margin-top: 15px;
                    padding: 10px;
                    background-color: #fef3c7;
                    border-radius: 6px;
                    font-size: 0.75rem;
                }
                .debug-info pre {
                    margin: 5px 0 0 0;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                .header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                }

                .main-title {
                    margin: 0;
                    color: var(--text-dark);
                }
                .subtitle {
                    margin: 5px 0 0 0;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                }

                .actions-group {
                    display: flex;
                    gap: 15px;
                }

                .action-button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .action-button.open {
                    background-color: var(--success);
                    color: white;
                }
                .action-button.closed {
                    background-color: var(--text-muted);
                    color: white;
                    cursor: not-allowed;
                }
                .action-button.primary {
                    background-color: var(--primary);
                    color: white;
                }

                .control-panel .panel-title {
                    color: var(--text-dark);
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 10px;
                }

                .filter-group {
                    display: flex;
                    gap: 20px;
                    align-items: flex-end;
                    flex-wrap: wrap;
                }
                .filter-item {
                    min-width: 180px;
                }
                .filter-label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                }
                .form-select, .date-picker-input {
                    padding: 8px 12px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    width: 100%;
                    font-size: 0.9rem;
                    box-sizing: border-box;
                }
                .generate-button {
                    padding: 10px 25px;
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9375rem;
                    min-width: 150px;
                    height: 38px;
                    transition: opacity 0.2s, background-color 0.2s;
                }
                .generate-button:disabled, .generate-button.loading {
                    opacity: 0.6;
                    cursor: not-allowed;
                }


                .quick-filters {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-top: 10px;
                }

                .quick-filter-button {
                    padding: 8px 15px;
                    background-color: var(--background-light);
                    color: var(--text-muted);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .quick-filter-button.active {
                    background-color: var(--primary);
                    color: white;
                }

                /* Dashboard Stats */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }
                .stat-item {
                    text-align: center;
                }
                .stat-label {
                    margin: 0 0 8px 0;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }
                .stat-value {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                .sales-color { color: #059669; }
                .order-color { color: #3b82f6; }
                .shift-color { color: #8b5cf6; }
                .closed-color { color: #dc2626; }
                .open-color { color: #059669; }

                .stat-trend {
                    margin: 4px 0 0 0;
                    font-size: 0.875rem;
                }
                .stat-trend.up { color: #059669; }
                .stat-trend.down { color: #dc2626; }

                .weekly-trend {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }
                .trend-label {
                    margin: 0 0 10px 0;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }
                .bar-chart-7d {
                    display: flex;
                    align-items: flex-end;
                    gap: 10px;
                    height: 60px;
                }
                .bar-wrapper {
                    flex: 1;
                    text-align: center;
                }
                .bar-item {
                    background-color: #3b82f6;
                    border-radius: 4px 4px 0 0;
                    margin-bottom: 5px;
                }
                .bar-day {
                    font-size: 0.75rem;
                    color: #6b7280;
                }


                /* Contenido Principal Layout */
                .content-layout {
                    display: grid;
                    grid-template-columns: 350px 1fr; 
                    gap: 25px;
                    align-items: flex-start;
                }

                .reports-list-panel {
                    height: calc(100vh - 200px); 
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    padding: 15px;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--border-color);
                }
                .refresh-button {
                    padding: 6px 12px;
                    background-color: #f3f4f6;
                    color: #374151;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }


                .reports-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .reports-item-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .report-item {
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    cursor: pointer;
                    transition: all 0.2s;
                    background-color: #fcfcfc;
                }
                .report-item:hover {
                    background-color: #f0f4f7;
                    transform: translateX(2px);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                }
                .report-item.selected {
                    border-color: var(--primary);
                    background-color: #e6f0ff;
                }

                .item-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 5px;
                }
                .item-date {
                    margin: 0;
                    font-size: 0.95rem;
                    color: var(--text-dark);
                }
                .status-badge {
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .closed-badge {
                    background-color: var(--success);
                    color: white;
                }
                .item-sales {
                    margin: 0;
                    font-size: 0.9rem;
                    color: var(--success);
                    font-weight: 700;
                }
                .item-summary {
                    margin: 0;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .item-footer {
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px dashed #eee;
                }
                .item-source {
                    font-size: 0.7rem;
                    color: #999;
                }


                /* Detalle del Reporte */
                .report-detail-panel {
                    min-height: calc(100vh - 200px);
                    padding: 30px;
                }

                .detail-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid var(--border-color);
                }
                .detail-title {
                    margin: 0 0 5px 0;
                    color: var(--text-dark);
                }
                .detail-metadata {
                    display: flex;
                    gap: 15px;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .detail-status {
                    text-align: right;
                }
                .status-pill {
                    padding: 6px 12px;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    justify-content: center;
                }
                .open-pill {
                    background-color: #e6ffed;
                    color: var(--success);
                }
                .closed-pill {
                    background-color: #ffeaea;
                    color: var(--danger);
                }
                .generation-date {
                    margin: 0;
                    font-size: 0.7rem;
                    color: #999;
                }

                .section-title {
                    margin-top: 30px;
                    margin-bottom: 15px;
                    color: var(--text-dark);
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }

                /* Métricas */
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }

                .metric-card {
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
                    border: 1px solid #f0f0f0;
                    transition: transform 0.2s;
                }
                .metric-card:hover {
                    transform: translateY(-2px);
                }
                .metric-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .metric-title {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }
                .metric-value {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                .metric-description {
                    margin: 5px 0 0 0;
                    font-size: 0.7rem;
                    color: #999;
                }

                /* Gráficos (2 columnas) */
                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .chart-container {
                    background-color: #f9fafb;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid var(--primary);
                }
                .chart-title {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: var(--text-dark);
                    font-size: 1.1rem;
                }
                .no-data-chart {
                    height: 300px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    border: 1px dashed #ccc;
                    border-radius: 4px;
                }

                /* Alertas/Notas */
                .alert {
                    padding: 15px;
                    border-radius: 6px;
                    margin-top: 20px;
                }
                .warning-alert {
                    background-color: #fffbe6;
                    border-left: 4px solid var(--warning);
                }
                .notes-alert {
                    background-color: #f0f7ff;
                    border-left: 4px solid var(--primary);
                }
                .alert-title {
                    margin: 0 0 5px 0;
                    font-size: 1rem;
                }

                /* Estado Vacío */
                .empty-state {
                    padding: 60px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>
        </div>
    );
};

export default Reportes;