// modulos/fast-food/Reportes.js - VERSIÓN COMPLETA CORREGIDA CON FILTROS Y FECHA FIXED
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
    BarChart, Bar, 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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

// FUNCIÓN CLAVE PARA EVITAR EL ERROR 'Invalid time value'
const getValidDate = (dateValue) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
};

// Reemplaza la función isSameLocalDate con esta versión corregida:
const isSameLocalDate = (date1, date2) => {
    if (!date1 || !date2) {
        console.log('isSameLocalDate: fecha(s) inválida(s)', { date1, date2 });
        return false;
    }
    
    const d1 = getValidDate(date1);
    const d2 = getValidDate(date2);
    
    if (!d1 || !d2) {
        console.log('isSameLocalDate: no se pudo obtener fecha válida', { d1, d2, date1, date2 });
        return false;
    }
    
    // Obtener componentes de fecha local
    const year1 = d1.getFullYear();
    const month1 = d1.getMonth();
    const day1 = d1.getDate();
    
    const year2 = d2.getFullYear();
    const month2 = d2.getMonth();
    const day2 = d2.getDate();
    
    const result = (year1 === year2 && month1 === month2 && day1 === day2);
    
    console.log('isSameLocalDate comparación:', {
        fecha1: d1.toISOString(),
        fecha1_local: `${day1}/${month1 + 1}/${year1}`,
        fecha2: d2.toISOString(),
        fecha2_local: `${day2}/${month2 + 1}/${year2}`,
        resultado: result
    });
    
    return result;
};
// ====================================================================
// 2. Lógica del PDF (Impresión Detallada) - SIN EMOJIS
// ====================================================================

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
    const MIN_SPACE_FOR_SECTION = 30;

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
                { content: `ORDEN #${order.order_number || order.order_id || index + 1} (${order.customer_name || 'Anónimo'})`, colSpan: 4, styles: { fillColor: [230, 230, 250], fontStyle: 'bold' } },
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
                order.payment_method_display || 'N/A', 
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
                const productName = item.product_details?.name || item.product_name || 'Producto Desconocido';
                const itemLabel = productName + (item.size_details?.name ? ` (${item.size_details.name})` : '');
                
                orderData.push([
                    itemLabel,
                    (item.quantity || 1).toString(),
                    formatCurrency(item.unit_price || 0),
                    formatCurrency(item.line_total || item.subtotal || 0), 
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

    // --- 3. Listado Completo de Productos Vendidos (Control de salto de página) ---

    if (PAGE_HEIGHT - y < MIN_SPACE_FOR_SECTION) {
        doc.addPage();
        y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0);
    // Título actualizado: Listado Completo de Productos Vendidos
    doc.text('3. Listado Completo de Productos Vendidos', MARGIN, y);
    y += 5;

    const topProducts = (report.top_products || [])
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
    const [noReportMessage, setNoReportMessage] = useState('');
    
    // ========== NUEVOS ESTADOS PARA EL MODAL ==========
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    // ==================================================

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

   // Obtener la lista de reportes recientes
const fetchReports = useCallback(async () => {
    try {
        setLoadingData(true);
        setConnectionError(false);
        setError('');
        setNoReportMessage('');

        console.log('=== INICIO fetchReports ===');
        const today = new Date();
        console.log('Fecha de hoy (cliente):', today.toLocaleDateString('es-MX'), today.toISOString());

        const listResponse = await api.get('/api/pos/daily-summaries/', {
            baseURL: getFastFoodBaseURL(),
            params: { ordering: '-date', limit: 30 },
            timeout: 10000
        });

        let reportsData = listResponse.data.results || listResponse.data;
        if (!Array.isArray(reportsData)) reportsData = [];

        console.log(`Se obtuvieron ${reportsData.length} reportes del servidor`);
        
        // Imprimir las fechas de los reportes para debug
        reportsData.forEach((report, index) => {
            const reportDate = report.date || report.start_date;
            console.log(`Reporte ${index}: ${reportDate} (${formatDate(reportDate)})`);
        });

        const todayStr = format(today, 'yyyy-MM-dd');
        console.log('Buscando reporte para hoy (str):', todayStr);
        
        // Buscar reporte de hoy en la lista recibida
        let todayReport = null;
        for (const report of reportsData) {
            const reportDate = report.date || report.start_date;
            if (reportDate) {
                console.log(`Comparando reporte ${reportDate} con hoy ${todayStr}`);
                if (isSameLocalDate(reportDate, todayStr)) {
                    todayReport = report;
                    console.log('¡Reporte de hoy encontrado en lista!');
                    break;
                }
            }
        }

        // Si no hay reporte de hoy, intentar obtener del endpoint /today/
        if (!todayReport) {
            console.log('No se encontró reporte de hoy en lista, intentando endpoint /today/');
            try {
                const todayResponse = await api.get('/api/pos/daily-summaries/today/', {
                    baseURL: getFastFoodBaseURL(),
                    timeout: 5000
                });
                todayReport = todayResponse.data;
                console.log('Reporte de hoy obtenido de endpoint /today/:', todayReport?.date);
            } catch (err) {
                console.warn('No se pudo obtener reporte específico de hoy:', err);
            }
        } else {
            console.log('Reporte de hoy encontrado en lista:', todayReport.date);
        }

        // Procesar lista de reportes
        const updatedReports = [];
        if (todayReport) {
            // Filtrar reportes que no sean de hoy
            const todayDate = todayReport.date_formatted || todayReport.date;
            console.log('Filtrando reportes que no sean de:', todayDate);
            
            const otherReports = reportsData.filter(r => {
                const reportDate = r.date_formatted || r.date;
                const isSame = reportDate && isSameLocalDate(reportDate, todayDate);
                console.log(`  - Reporte ${reportDate}: ${isSame ? 'ES hoy' : 'NO es hoy'}`);
                return !isSame;
            });
            
            console.log(`Se encontraron ${otherReports.length} reportes que no son de hoy`);
            updatedReports.push(...otherReports);
            updatedReports.unshift(todayReport);
        } else {
            updatedReports.push(...reportsData);
        }

        console.log(`Total reportes finales: ${updatedReports.length}`);
        console.log('=== FIN fetchReports ===');
        
        setReports(updatedReports);

    } catch (err) {
        console.error('Error loading reports (fetchReports):', err);
        throw new Error('Error al cargar reportes listados.');
    } finally {
        setLoadingData(false);
    }
}, []);
    // ========== NUEVA FUNCIÓN PARA VER DETALLE DEL REPORTE ==========
    const verDetalleReporte = async (reportId) => {
        try {
            setModalLoading(true);
            setShowModal(true);
            
            const response = await api.get(`/api/pos/daily-summaries/${reportId}/detail_with_orders/`, {
                baseURL: getFastFoodBaseURL()
            });

            setCurrentReport(response.data);
        } catch (err) {
            console.error("Error al obtener detalle:", err);
            alert("No se pudo cargar el detalle del reporte.");
            setShowModal(false);
        } finally {
            setModalLoading(false);
        }
    };
    // ================================================================

    // ========== FUNCIÓN MODIFICADA: SOLO CARGA REPORTES EXISTENTES ==========
    const loadDailyReport = useCallback(async (date, shouldGenerate = false) => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setNoReportMessage('');
            setDebugInfo('');

            const dateStr = format(date, 'yyyy-MM-dd');
            const targetDate = getValidDate(dateStr);

            if (!targetDate) {
                setNoReportMessage(`Fecha inválida: ${format(date, 'dd/MM/yyyy')}`);
                return;
            }

            // PRIMERO: Buscar si ya existe un reporte para esta fecha
            const existingReport = reports.find(report => {
                const reportDate = report.date || report.start_date;
                return reportDate && isSameLocalDate(reportDate, targetDate);
            });

            if (existingReport && !shouldGenerate) {
                // Si ya existe un reporte y no debemos generarlo, lo usamos
                console.log("Usando reporte existente para:", dateStr);
                setCurrentReport(existingReport);
                return;
            }

            // Si no existe reporte y no se debe generar
            if (!shouldGenerate) {
                setNoReportMessage(`No hay reporte disponible para la fecha ${format(date, 'dd/MM/yyyy')}`);
                setCurrentReport(null);
                return;
            }

            // SOLO generar nuevo reporte si se solicita explícitamente
            console.log("Generando nuevo reporte para:", dateStr);
            const response = await api.post('/api/pos/daily-summaries/generate/', {
                date: dateStr,
                detailed: true,
                include_orders_detail: true
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            const generatedSummary = response.data.summary;

            if (generatedSummary) {
                setCurrentReport(generatedSummary);
                // Actualizar la lista de reportes
                await fetchReports();
            }

        } catch (err) {
            console.error('Error loading daily report:', err);

            let errorMessage = `Error al cargar reporte para ${format(date, 'dd/MM/yyyy')}.`;
            if (err.response?.status === 500) {
                errorMessage += '\n\nError interno del servidor (500). Revise los logs.';
            }

            setConnectionError(true);
            setDebugInfo(`URL: ${getFastFoodBaseURL()}\nFecha: ${format(date, 'yyyy-MM-dd')}\nError: ${err.message}`);

        } finally {
            setLoadingData(false);
        }
    }, [reports, fetchReports]);

    // ========== FUNCIÓN MODIFICADA: SOLO GENERA REPORTES CUANDO SE PIDE EXPLÍCITAMENTE ==========
    const generateReport = useCallback(async (currentReportType, currentRange, shouldGenerate = false) => {
         try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setNoReportMessage('');
            setDebugInfo('');

            const startDate = format(currentRange.startDate, 'yyyy-MM-dd');
            const endDate = format(currentRange.endDate, 'yyyy-MM-dd');

            if (currentReportType === 'daily') {
                // Para reportes diarios, buscar primero si ya existe
                await loadDailyReport(currentRange.startDate, shouldGenerate);
                return;
            }

            // Para reportes de rango, siempre mostrar datos existentes primero
            if (!shouldGenerate) {
                // Buscar reportes existentes que coincidan con el rango
                const filteredReports = reports.filter(report => {
                    const reportDate = getValidDate(report.date || report.start_date);
                    if (!reportDate) return false;
                    
                    return isWithinInterval(reportDate, {
                        start: startOfDay(currentRange.startDate),
                        end: endOfDay(currentRange.endDate)
                    });
                });

                if (filteredReports.length > 0) {
                    console.log("Mostrando reportes existentes para el rango");
                    // Mostrar el reporte más reciente del rango
                    const latestReport = filteredReports[0];
                    setCurrentReport(latestReport);
                    return;
                } else {
                    setNoReportMessage(`No hay reportes disponibles para el período seleccionado (${format(currentRange.startDate, 'dd/MM/yyyy')} - ${format(currentRange.endDate, 'dd/MM/yyyy')})`);
                    setCurrentReport(null);
                    return;
                }
            }

            // SOLO generar nuevo reporte si se solicita explícitamente
            console.log("Generando nuevo reporte de rango");
            const payload = {
                report_type: currentReportType,
                include_orders_detail: true
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

            const newReport = response.data.data || response.data;
            setCurrentReport(newReport);

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
    }, [reports, loadDailyReport]);


    // Hook de inicialización
    useEffect(() => {
        const initializeReports = async () => {
            setLoading(true);
            try {
                console.log('Inicializando reportes - Fecha local:', new Date().toLocaleString('es-MX'));
                
                await fetchDashboardStats();
                await fetchReports();
                setConnectionError(false);
                
                // Inicialmente cargar el reporte de hoy si existe
                const today = new Date();
                console.log('Fecha de hoy (cliente):', today.toLocaleDateString('es-MX'));
                
                const todayStr = format(today, 'yyyy-MM-dd');
                const todayReport = reports.find(r => {
                    const reportDate = r.date || r.start_date;
                    return reportDate && isSameLocalDate(reportDate, todayStr);
                });
                
                console.log('Reporte de hoy encontrado:', todayReport ? 'Sí' : 'No');
                
                if (todayReport) {
                    setCurrentReport(todayReport);
                    setFilterType('today');
                } else {
                    setNoReportMessage('No hay reporte disponible para hoy. Puedes generar uno si es necesario.');
                }

            } catch (err) {
                console.error('Error inicializando reportes:', err);
                setConnectionError(true);
                setError('Error al conectar con el backend. Verifica que el servicio fast-food-service esté ejecutándose y migrado.');
                setDebugInfo(`Error: ${err.message}\nURL: ${getFastFoodBaseURL()}\nStatus: ${err.response?.status}`);
            } finally {
                setLoading(false);
            }
        };

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
            
            // Recargar el reporte de hoy
            const today = new Date();
            await loadDailyReport(today, true);

        } catch (err) {
            console.error('Error closing day:', err);
            setError('Error al cerrar el día: ' + (err.response?.data?.error || err.message));
            setConnectionError(true);
            alert('Error al cerrar el día. Verifica que tengas permisos.');
        }
    };

    // ========== FUNCIÓN MODIFICADA: SOLO FILTRA, NO CREA ==========
    const applyQuickFilter = (filter) => {
        setFilterType(filter);
        setNoReportMessage('');
        const today = new Date();
        let newRange = { startDate: today, endDate: today };
        let newReportType = 'daily';

        switch (filter) {
            case 'today':
                newReportType = 'daily';
                newRange = { startDate: today, endDate: today };
                // Solo cargar reporte existente, no generar nuevo
                loadDailyReport(today, false);
                break;
            case 'yesterday':
                const yesterday = subDays(today, 1);
                newReportType = 'daily';
                newRange = { startDate: yesterday, endDate: yesterday };
                // Solo cargar reporte existente, no generar nuevo
                loadDailyReport(yesterday, false);
                break;
            case 'thisWeek':
                newReportType = 'weekly';
                newRange = {
                    startDate: startOfWeek(today, { locale: es }),
                    endDate: today
                };
                // Solo filtrar reportes existentes
                generateReport(newReportType, newRange, false);
                break;
            case 'lastWeek':
                newReportType = 'weekly';
                const lastWeekStart = subDays(startOfWeek(today, { locale: es }), 7);
                const lastWeekEnd = subDays(endOfWeek(today, { locale: es }), 7);
                newRange = {
                    startDate: lastWeekStart,
                    endDate: lastWeekEnd
                };
                // Solo filtrar reportes existentes
                generateReport(newReportType, newRange, false);
                break;
            case 'thisMonth':
                newReportType = 'monthly';
                newRange = {
                    startDate: startOfMonth(today),
                    endDate: today
                };
                // Solo filtrar reportes existentes
                generateReport(newReportType, newRange, false);
                break;
            default:
                newReportType = 'daily';
                newRange = { startDate: today, endDate: today };
                loadDailyReport(today, false);
        }

        setReportType(newReportType);
        setDateRange(newRange);
    };

    // Función para forzar la generación de un reporte (solo cuando el usuario lo pida explícitamente)
    const forceGenerateReport = () => {
        setNoReportMessage('');
        if (reportType === 'daily') {
            loadDailyReport(dateRange.startDate, true);
        } else {
            generateReport(reportType, dateRange, true);
        }
    };

    // --- Funciones de Renderizado ---

    // Renderizar estadísticas de dashboard
    const renderDashboardStats = () => {
        if (!dashboardStats && connectionError) {
            return (
                <div className="card alert-card">
                    <h3 style={{ marginBottom: 15, color: '#dc2626' }}>No se pudo conectar al backend</h3>
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
                        Reintentar Conexión
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
                <h3 className="panel-title">Resumen del Día</h3>

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
            .map((item, index) => ({
                name: item.product_name?.substring(0, 25) + (item.product_name?.length > 25 ? '...' : '') || `Producto ${index + 1}`,
                cantidad: item.quantity || item.quantity_sold || 0,
            }));

        return (
            <div className="chart-container">
                <h4 className="chart-title">Listado Completo de Productos Vendidos</h4>
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
    
    // Función para manejar la impresión a PDF
    const handlePrintPDF = () => {
        if (!currentReport) {
            alert('No hay reporte seleccionado para imprimir.');
            return;
        }
        
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
                    No hay registros de órdenes creadas para este día.
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
                                    ORDEN #{order.order_number || order.order_id || index + 1} ({order.customer_name || 'Anónimo'})
                                </h5>
                                <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 'bold' }}>
                                    Total: {formatCurrency(order.total_amount || 0)}
                                </span>
                            </div>
                            <p style={{ margin: '10px 0 5px 0', fontSize: '0.85rem', color: '#666' }}>
                                **Método de Pago:** {order.payment_method_display || 'N/A'} | **Estado:** {order.status || 'Completada'} | **Hora:** {timeFormatted}
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
                                            <td style={{ padding: 8, border: '1px solid #eee', fontSize: '0.8rem' }}>
                                                {item.product_details?.name || 'Producto Desconocido'}
                                                {item.size_details?.name && ` (${item.size_details.name})`}
                                                {item.extras && item.extras.length > 0 && 
                                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#999' }}>
                                                        + {item.extras.map(e => e.extra_name).join(', ')}
                                                    </span>
                                                }
                                            </td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{(item.quantity || 1).toLocaleString()}</td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{formatCurrency(item.unit_price || 0)}</td>
                                            <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'right', fontSize: '0.8rem' }}>{formatCurrency(item.line_total || 0)}</td>
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


    return (
        <div className="reportes-container">
            {/* Título principal */}
            <div className="header-bar">
                <div>
                    <h1 className="main-title">Reportes del Sistema</h1>
                    <p className="subtitle">Datos en tiempo real desde la base de datos.</p>
                </div>
                <div className="actions-group">
                    <button
                        onClick={closeDay}
                        disabled={currentReport?.is_closed || connectionError || !currentReport}
                        className={`action-button ${currentReport?.is_closed ? 'closed' : 'open'}`}
                    >
                        {currentReport?.is_closed ? 'Día Cerrado' : 'Cerrar Día'}
                    </button>
                    {currentReport && (
                        <button
                            onClick={handlePrintPDF}
                            disabled={loadingData || connectionError || !currentReport}
                            className="action-button primary"
                            style={{ backgroundColor: '#cc3333' }}
                        >
                            Imprimir PDF Detallado
                        </button>
                    )}
                </div>
            </div>

            {/* Dashboard Stats */}
            {renderDashboardStats()}

            {/* Panel de Control */}
            <div className="control-panel card">
                <h3 className="panel-title">Filtros y Generación</h3>

                <div className="filter-group">
                    {/* Select Tipo de Reporte */}
                    <div className="filter-item">
                        <label className="filter-label">Tipo de Reporte</label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            className="form-select"
                        >
                            <option value="daily">Diario</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensual</option>
                            <option value="custom">Personalizado</option>
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

                    {/* Botón Generar Reporte - AHORA ES OPCIONAL */}
                    <button
                        onClick={forceGenerateReport}
                        disabled={loadingData || connectionError}
                        className={`generate-button ${loadingData ? 'loading' : ''}`}
                        title="Forzar generación de nuevo reporte (solo si es necesario)"
                    >
                        {loadingData ? 'Generando...' : 'Generar Nuevo Reporte'}
                    </button>
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
                                {filter === 'today' && 'Hoy'}
                                {filter === 'yesterday' && 'Ayer'}
                                {filter === 'thisWeek' && 'Esta Semana'}
                                {filter === 'lastWeek' && 'Semana Pasada'}
                                {filter === 'thisMonth' && 'Este Mes'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="content-layout">
                {/* Lista de Reportes - SIDEBAR MEJORADO CON CAMPOS DE CLIENTE */}
                <div className="reports-list-panel card">
                    <div className="panel-header">
                        <h3 className="panel-title">Reportes Recientes ({reports.length})</h3>
                        <button
                            onClick={() => fetchReports()}
                            disabled={connectionError}
                            className="refresh-button"
                        >
                            Actualizar
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
                                                if (report.id) {
                                                    verDetalleReporte(report.id);
                                                } else {
                                                    // Si por alguna razón no tiene ID (es el de hoy recién creado)
                                                    const reportDateObj = getValidDate(reportDate);
                                                    if (reportDateObj) {
                                                        loadDailyReport(reportDateObj, false);
                                                    }
                                                }
                                            }}
                                            className={`report-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className="item-content">
                                                <div className="item-status">
                                                    <h4 className="item-date">{formatDate(reportDate)}</h4>
                                                    {report.is_closed && (
                                                        <span className="status-badge closed-badge">CERRADO</span>
                                                    )}
                                                </div>

                                                <div className="item-metrics">
                                                    <div className="metric-row">
                                                        <span className="metric-label">Ventas:</span>
                                                        <strong className="metric-value sales-color">{formatCurrency(report.total_sales || 0)}</strong>
                                                    </div>
                                                    <div className="metric-row">
                                                        <span className="metric-label">Órdenes:</span>
                                                        <span className="metric-text">{(report.total_orders || 0).toLocaleString()}</span>
                                                    </div>
                                                    {/* ========== NUEVOS CAMPOS DE CLIENTE ========== */}
                                                    <div className="metric-row">
                                                        <span className="metric-label">Clientes:</span>
                                                        <span className="metric-text customer-count">{(report.total_customers || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="metric-row">
                                                        <span className="metric-label">Prom/Orden:</span>
                                                        <span className="metric-text">{formatCurrency(report.average_order_value || 0)}</span>
                                                    </div>
                                                    <div className="metric-row">
                                                        <span className="metric-label">Items:</span>
                                                        <span className="metric-text">{(report.total_items_sold || 0).toLocaleString()} unid.</span>
                                                    </div>
                                                    {/* ============================================== */}
                                                </div>
                                            </div>
                                            <div className="item-footer">
                                                <span className="item-source">Generado por: {report.generated_by || 'Sistema'}</span>
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
                                    <h2 className="detail-title">Reporte {reportType === 'daily' ? 'Diario' : reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensual' : 'Personalizado'}</h2>
                                    <div className="detail-metadata">
                                        <span className="metadata-item">Fecha: {formatDate(currentReport.date || currentReport.start_date)}
                                            {currentReport.end_date && currentReport.date !== currentReport.end_date && currentReport.start_date !== currentReport.end_date &&
                                                ` - ${formatDate(currentReport.end_date)}`}
                                        </span>
                                        <span className="metadata-item">Usuario: {currentReport.generated_by || 'Sistema'}</span>
                                    </div>
                                </div>
                                <div className="detail-status">
                                    <div className={`status-pill ${currentReport.is_closed ? 'closed-pill' : 'open-pill'}`}>
                                        {currentReport.is_closed ? 'DÍA CERRADO' : 'DÍA ABIERTO'}
                                    </div>
                                    <p className="generation-date">Actualizado: {formatDate(currentReport.generated_at || new Date().toISOString())}</p>
                                </div>
                            </div>

                            {/* Alerta de Conexión */}
                            {connectionError && (
                                <div className="alert warning-alert">
                                    <h4 className="alert-title">Nota importante</h4>
                                    <p>Estás viendo datos incompletos. Soluciona el error en el backend para ver datos en tiempo real y gráficos.</p>
                                </div>
                            )}

                            {/* Métricas Principales */}
                            <h3 className="section-title">Métricas de Rendimiento</h3>
                            {renderMetrics()}
                            
                            {/* DETALLE DE ÓRDENES - POSICION PRIMARIA */}
                            <h3 className="section-title detail-section">Detalle de Órdenes (Web)</h3>
                            {renderDetailedOrdersTable()}

                            {/* Gráficos Restantes (Ventas por Hora y Top Productos) */}
                            <h3 className="section-title chart-section" style={{marginTop: '40px'}}>Análisis de Gráficos</h3>

                            <div className="charts-grid">
                                {renderSalesByHourChart()}
                                {renderTopProductsChart()}
                            </div>

                            {/* Notas Adicionales */}
                            {currentReport.closing_notes && (
                                <div className="alert notes-alert">
                                    <h4 className="alert-title">Notas de Cierre</h4>
                                    <p>{currentReport.closing_notes}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <span className="material-icons" style={{ fontSize: '4rem', color: '#ccc' }}>assessment</span>
                            <h3 className="empty-title">
                                {noReportMessage || 'Selecciona un reporte'}
                            </h3>
                            <p className="empty-message">
                                {noReportMessage 
                                    ? 'Puedes generar un nuevo reporte usando el botón "Generar Nuevo Reporte"'
                                    : 'Haz clic en un reporte de la lista para ver su información detallada, métricas y gráficos de análisis.'}
                            </p>
                            <button
                                onClick={() => applyQuickFilter('today')}
                                disabled={connectionError}
                                className="action-button primary"
                            >
                                {connectionError ? 'Error de Conexión' : 'Ver Reporte de Hoy'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ========== MODAL PARA DETALLE COMPLETO ========== */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>Detalle Completo del Reporte</h2>
                            <button className="close-button" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        
                        <div className="modal-body">
                            {modalLoading ? (
                                <div className="loading-spinner">Cargando detalles...</div>
                            ) : (
                                <>
                                    <div className="modal-summary-grid">
                                        <div className="modal-stat">
                                            <span>Ventas Totales:</span>
                                            <strong>{formatCurrency(currentReport?.total_sales)}</strong>
                                        </div>
                                        <div className="modal-stat">
                                            <span>Órdenes Totales:</span>
                                            <strong>{currentReport?.total_orders}</strong>
                                        </div>
                                        <div className="modal-stat">
                                            <span>Clientes Únicos:</span>
                                            <strong>{currentReport?.total_customers}</strong>
                                        </div>
                                        <div className="modal-stat">
                                            <span>Promedio/Orden:</span>
                                            <strong>{formatCurrency(currentReport?.average_order_value)}</strong>
                                        </div>
                                    </div>
                                    
                                    {/* Aquí mostramos EXACTAMENTE lo mismo que en el panel principal */}
                                    <h3 className="section-title detail-section" style={{marginTop: '20px'}}>Detalle de Órdenes</h3>
                                    {renderDetailedOrdersTable()}
                                    
                                    <div style={{ marginTop: '20px' }}>
                                        <h4 className="section-title chart-section">Análisis de Gráficos</h4>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                            <div>
                                                <h4 className="chart-title">Ventas por Hora</h4>
                                                {renderSalesByHourChart()}
                                            </div>
                                            <div>
                                                <h4 className="chart-title">Productos Vendidos</h4>
                                                {renderTopProductsChart()}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        
                        <div className="modal-footer">
                            <button className="action-button" onClick={() => setShowModal(false)}>Cerrar</button>
                            <button className="action-button primary" onClick={handlePrintPDF}>Imprimir PDF</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos CSS Globales - COMPLETOS */}
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

                /* ========== ESTILOS MEJORADOS DEL MODAL ========== */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-container {
                    background: white;
                    width: 95%;
                    max-width: 1200px;
                    max-height: 90vh;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .modal-header {
                    padding: 20px 30px;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h2 {
                    margin: 0;
                    color: #1f2937;
                    font-size: 1.5rem;
                }
                .modal-body {
                    padding: 30px;
                    overflow-y: auto;
                    flex: 1;
                    background: #f9fafb;
                }
                .modal-footer {
                    padding: 20px 30px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px;
                    background: white;
                }
                .close-button {
                    font-size: 2rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    color: #64748b;
                    line-height: 1;
                    padding: 0;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background-color 0.2s;
                }
                .close-button:hover {
                    background-color: #e2e8f0;
                }
                .modal-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    border: 1px solid #e5e7eb;
                }
                .modal-stat {
                    display: flex;
                    flex-direction: column;
                    padding: 10px;
                    background: #f8fafc;
                    border-radius: 8px;
                    border-left: 4px solid #3b82f6;
                }
                .modal-stat span {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                .modal-stat strong {
                    font-size: 1.5rem;
                    color: #1f2937;
                    font-weight: 700;
                }
                .loading-spinner {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    color: #64748b;
                    font-size: 1.1rem;
                    background: white;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                }
                /* Asegurar que las tablas dentro del modal se vean bien */
                .modal-body table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }
                .modal-body th {
                    background-color: #f3f4f6;
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                }
                .modal-body td {
                    padding: 12px 15px;
                    border-bottom: 1px solid #e5e7eb;
                    color: #4b5563;
                }
                .modal-body tr:hover {
                    background-color: #f9fafb;
                }
                /* Mejorar los gráficos dentro del modal */
                .modal-body .chart-container {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    margin-bottom: 0;
                }
                .modal-body .section-title {
                    color: #1f2937;
                    font-size: 1.25rem;
                    margin-top: 30px;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #e5e7eb;
                }
                .modal-body .chart-title {
                    color: #374151;
                    font-size: 1.1rem;
                    margin-top: 0;
                    margin-bottom: 15px;
                }
                /* ================================================ */

                /* ========== ESTILOS MEJORADOS PARA EL SIDEBAR/SIDECAR ========== */
                .item-metrics {
                    margin-top: 10px;
                    padding: 10px;
                    background: #f8fafc;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                }
                .metric-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 0.8rem;
                }
                .metric-row:last-child {
                    margin-bottom: 0;
                }
                .metric-label {
                    color: #6b7280;
                    font-weight: 500;
                    min-width: 80px;
                }
                .metric-value {
                    font-weight: 700;
                }
                .metric-text {
                    color: #374151;
                    font-weight: 600;
                }
                .sales-color {
                    color: #059669;
                }
                .customer-count {
                    color: #3b82f6;
                    font-weight: 700;
                }
                .item-date {
                    margin: 0 0 8px 0;
                    font-size: 0.95rem;
                    color: #1f2937;
                    font-weight: 600;
                }
                .status-badge {
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.65rem;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .closed-badge {
                    background-color: #10b981;
                    color: white;
                }
                .item-source {
                    font-size: 0.7rem;
                    color: #9ca3af;
                    display: block;
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px dashed #e5e7eb;
                }
                /* ============================================================== */

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
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
                
                .loading-screen {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-size: 1.2rem;
                    color: #666;
                }
                
                .no-reports {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                    font-style: italic;
                }
            `}</style>
        </div>
    );
};

export default Reportes;