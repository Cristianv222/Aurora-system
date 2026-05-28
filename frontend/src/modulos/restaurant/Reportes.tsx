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
import { formatCurrency, formatDate, getValidDate, generateDetailedPDF } from '../../utils/reportUtils';

// ====================================================================
// 1. Interfaces & Types
// ====================================================================
interface SaleByHour {
    hour: number;
    hour_label?: string;
    total_sales: string | number;
}

interface TopProduct {
    product_name: string;
    quantity?: number;
    quantity_sold?: number;
}

interface OrderItemDetail {
    product_details?: {
        name: string;
    };
    size_details?: {
        name: string;
    };
    extras?: Array<{
        extra_name: string;
    }>;
    note?: string;
    quantity?: number;
    unit_price?: number;
    line_total?: number;
}

interface OrderDetail {
    order_id?: string;
    order_number?: string;
    customer_name?: string;
    total_amount: number;
    payment_method_display?: string;
    status?: string;
    timestamp?: string;
    items?: OrderItemDetail[];
}

interface ReportData {
    id?: string;
    date?: string;
    start_date?: string;
    end_date?: string;
    date_formatted?: string;
    generated_by?: string;
    generated_at?: string;
    is_closed?: boolean;
    is_shift_report?: boolean;
    shift_info?: {
        id: string;
        shift_number: number;
        user_name: string;
        opened_at: string;
        closed_at?: string;
        user?: string;
    };
    total_sales: number;
    total_orders: number;
    total_items_sold?: number;
    total_customers?: number;
    total_discounts?: number;
    total_tips?: number;
    average_order_value?: number;
    average_items_per_order?: number;
    cash_sales?: number;
    cash_count?: number;
    transfer_sales?: number;
    transfer_count?: number;
    card_sales?: number;
    card_count?: number;
    cop_sales?: number;
    cop_count?: number;
    other_sales?: number;
    other_count?: number;
    closing_notes?: string;
    sales_by_hour?: SaleByHour[];
    top_products?: TopProduct[];
    orders_detail?: OrderDetail[];
}

interface Shift {
    id: string;
    shift_number: number;
    user_name: string;
    opened_at: string;
    closed_at?: string;
    status: 'open' | 'closed';
    total_sales: number;
    total_transactions: number;
}

interface DashboardStats {
    sales?: {
        today: number;
        change_percentage?: number;
        trend?: 'up' | 'down' | 'neutral';
    };
    orders?: {
        today: number;
    };
    shifts?: {
        active: number;
    };
    total_sales?: number;
    total_orders?: number;
}

const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#b45309', '#ec4899', '#6b7280'];

const getFastFoodBaseURL = (): string => {
    return process.env.REACT_APP_RESTAURANT_SERVICE || 'http://localhost:8002';
};

const isSameLocalDate = (date1: string | Date | undefined, date2: string | Date | undefined): boolean => {
    if (!date1 || !date2) {
        return false;
    }

    const d1 = getValidDate(date1);
    const d2 = getValidDate(date2);

    if (!d1 || !d2) {
        return false;
    }

    const year1 = d1.getFullYear();
    const month1 = d1.getMonth();
    const day1 = d1.getDate();

    const year2 = d2.getFullYear();
    const month2 = d2.getMonth();
    const day2 = d2.getDate();

    return (year1 === year2 && month1 === month2 && day1 === day2);
};

// ====================================================================
// 2. Componente Principal (Reportes)
// ====================================================================
const Reportes: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [reports, setReports] = useState<any[]>([]);
    const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
    const [reportType, setReportType] = useState<string>('daily');
    const [dateRange, setDateRange] = useState<{
        startDate: Date | null;
        endDate: Date | null;
    }>({
        startDate: new Date(),
        endDate: new Date()
    });
    const [filterType, setFilterType] = useState<string>('today');
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [connectionError, setConnectionError] = useState<boolean>(false);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [noReportMessage, setNoReportMessage] = useState<string>('');

    // ========== ESTADOS PARA EL MODAL ==========
    const [showModal, setShowModal] = useState<boolean>(false);
    const [modalLoading, setModalLoading] = useState<boolean>(false);

    // ========== ESTADOS PARA GESTIÓN DE TURNOS ==========
    const [currentShift, setCurrentShift] = useState<any>(null);
    const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
    const [managerName, setManagerName] = useState<string>('');
    const [shiftNotes, setShiftNotes] = useState<string>('');
    const [processingShift, setProcessingShift] = useState<boolean>(false);
    const [dayShifts, setDayShifts] = useState<any[]>([]);

    // Cargar estadísticas del dashboard
    const fetchDashboardStats = useCallback(async () => {
        try {
            const response = await api.get('/api/restaurant/pos/daily-summaries/dashboard/', {
                baseURL: getFastFoodBaseURL(),
                timeout: 20000
            });
            setDashboardStats(response.data);
            return true;
        } catch (err: any) {
            console.error('Error loading dashboard stats:', err);
            throw new Error(`Dashboard no disponible: ${err.message}`);
        }
    }, []);

    // Fetch shifts for a specific date
    const fetchDayShifts = useCallback(async (dateStr: string) => {
        if (!dateStr) return;
        try {
            const response = await api.get(`/api/restaurant/pos/shifts/by_date/?date=${dateStr}`, {
                baseURL: getFastFoodBaseURL()
            });
            if (response.data && response.data.shifts) {
                setDayShifts(response.data.shifts);
            } else {
                setDayShifts([]);
            }
        } catch (err) {
            console.error('Error fetching day shifts:', err);
            setDayShifts([]);
        }
    }, []);

    // Print Shift Report (Fetch detailed data first)
    const handlePrintShiftReport = async (shiftId: string) => {
        if (!shiftId) return;
        try {
            const response = await api.get(`/api/restaurant/pos/shifts/${shiftId}/report/`, {
                baseURL: getFastFoodBaseURL()
            });
            const reportData = response.data;
            // Add flag to satisfy reportUtils check
            reportData.is_shift_report = true;
            generateDetailedPDF(reportData, 'shift', '');
        } catch (err) {
            console.error('Error generating shift PDF:', err);
            alert('Error al generar el PDF del turno.');
        }
    };

    // ========== GESTIÓN DE TURNOS ==========
    const checkCurrentShift = useCallback(async () => {
        try {
            const response = await api.get('/api/restaurant/pos/shifts/current/', {
                baseURL: getFastFoodBaseURL()
            });
            setCurrentShift(response.data.shift);
        } catch (err) {
            console.error('Error checking current shift:', err);
        }
    }, []);

    const handleOpenShift = async (e?: React.FormEvent) => {
        e?.preventDefault();

        if (!managerName.trim()) {
            alert('Por favor, ingresa el nombre del encargado.');
            return;
        }

        setProcessingShift(true);
        try {
            await api.post('/api/restaurant/pos/shifts/', {
                manager_name: managerName,
                opening_cash: 0,
                notes: shiftNotes || 'Apertura Simplificada'
            }, { baseURL: getFastFoodBaseURL() });

            await checkCurrentShift();
            setShowShiftModal(false);
            setManagerName('');
            setShiftNotes('');
            alert('Turno abierto correctamente.');
        } catch (err: any) {
            console.error('Error opening shift:', err);
            const msg = err.response?.data?.detail
                || err.response?.data?.non_field_errors?.[0]
                || (typeof err.response?.data === 'string' ? err.response?.data : '')
                || err.message
                || 'Error desconocido';
            alert('Error al abrir turno: ' + msg);
        } finally {
            setProcessingShift(false);
        }
    };

    const handleCloseShift = async () => {
        if (!currentShift) return;
        if (!window.confirm(`¿Seguro que deseas cerrar el Turno #${currentShift.shift_number}?`)) return;

        setProcessingShift(true);
        try {
            await api.post(`/api/restaurant/pos/shifts/${currentShift.id}/close/`, {
                closing_cash: 0,
                closing_notes: 'Cierre desde Reportes'
            }, { baseURL: getFastFoodBaseURL() });

            // Reporte y PDF
            try {
                const reportResponse = await api.get(`/api/restaurant/pos/shifts/${currentShift.id}/report/`, {
                    baseURL: getFastFoodBaseURL()
                });

                const shiftData = reportResponse.data;
                const normalizedReport = {
                    ...shiftData.summary,
                    shift_info: shiftData.shift_info,
                    orders_detail: shiftData.orders_detail,
                    payment_methods: shiftData.payment_methods,
                    top_products: shiftData.top_products,
                    date: shiftData.shift_info.opened_at,
                    is_shift_report: true,
                    generated_by: shiftData.shift_info.user
                };

                generateDetailedPDF(normalizedReport, 'Reporte de Turno', `Cierre Turno #${currentShift.shift_number}`);
            } catch (e) {
                console.error("Error PDF", e);
            }

            setCurrentShift(null);
            alert('Turno cerrado y reporte generado.');
            fetchReports(); // Actualizar lista
        } catch (err) {
            console.error('Error closing shift:', err);
            alert('Error al cerrar el turno.');
        } finally {
            setProcessingShift(false);
        }
    };

    // Obtener la lista de reportes recientes
    const fetchReports = useCallback(async () => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setNoReportMessage('');

            const listResponse = await api.get('/api/restaurant/pos/daily-summaries/', {
                baseURL: getFastFoodBaseURL(),
                params: { ordering: '-date', limit: 30 },
                timeout: 10000
            });

            let reportsData = listResponse.data.results || listResponse.data;
            if (!Array.isArray(reportsData)) reportsData = [];

            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');

            // Buscar reporte de hoy en la lista recibida
            let todayReport = null;
            for (const report of reportsData) {
                const reportDate = report.date || report.start_date;
                if (reportDate) {
                    if (isSameLocalDate(reportDate, todayStr)) {
                        todayReport = report;
                        break;
                    }
                }
            }

            // Si no hay reporte de hoy, intentar obtener del endpoint /today/
            if (!todayReport) {
                try {
                    const todayResponse = await api.get('/api/restaurant/pos/daily-summaries/today/', {
                        baseURL: getFastFoodBaseURL(),
                        timeout: 5000
                    });
                    todayReport = todayResponse.data;
                } catch (err) {
                    console.warn('No se pudo obtener reporte específico de hoy:', err);
                }
            }

            // Procesar lista de reportes
            const updatedReports: any[] = [];
            if (todayReport) {
                const todayDate = todayReport.date_formatted || todayReport.date;
                const otherReports = reportsData.filter(r => {
                    const reportDate = r.date_formatted || r.date;
                    const isSame = reportDate && isSameLocalDate(reportDate, todayDate);
                    return !isSame;
                });

                updatedReports.push(...otherReports);
                updatedReports.unshift(todayReport);
            } else {
                updatedReports.push(...reportsData);
            }

            setReports(updatedReports);
            return updatedReports;

        } catch (err) {
            console.error('Error loading reports (fetchReports):', err);
            return [];
        } finally {
            setLoadingData(false);
        }
    }, []);

    // ========== VER DETALLE DEL REPORTE ==========
    const verDetalleReporte = async (reportId: string, isShift: boolean = false) => {
        try {
            setModalLoading(true);
            setShowModal(true);

            let response;
            if (isShift) {
                response = await api.get(`/api/restaurant/pos/shifts/${reportId}/report/`, {
                    baseURL: getFastFoodBaseURL()
                });
                const shiftData = response.data;
                const normalizedReport = {
                    ...shiftData.summary,
                    shift_info: shiftData.shift_info,
                    orders_detail: shiftData.orders_detail,
                    payment_methods: shiftData.payment_methods,
                    top_products: shiftData.top_products,
                    date: shiftData.shift_info.opened_at,
                    is_shift_report: true,
                    generated_by: shiftData.shift_info.user
                };
                setCurrentReport(normalizedReport);
            } else {
                response = await api.get(`/api/restaurant/pos/daily-summaries/${reportId}/detail_with_orders/`, {
                    baseURL: getFastFoodBaseURL()
                });
                setCurrentReport(response.data);
                if (response.data.date) {
                    fetchDayShifts(response.data.date).catch(e => console.warn("Error fetching shifts for detail:", e));
                }
            }

        } catch (err) {
            console.error("Error al obtener detalle:", err);
            alert("No se pudo cargar el detalle del reporte.");
            setShowModal(false);
        } finally {
            setModalLoading(false);
        }
    };

    // ========== CARGAR REPORTE DIARIO EXISTENTE ==========
    const loadDailyReport = useCallback(async (date: Date, shouldGenerate: boolean = false) => {
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

            // Buscar si ya existe un reporte para esta fecha
            const existingReport = reports.find(report => {
                const reportDate = report.date || report.start_date;
                return reportDate && isSameLocalDate(reportDate, targetDate);
            });

            if (existingReport && !shouldGenerate) {
                setCurrentReport(existingReport);
                fetchDayShifts(dateStr).catch(err => console.warn("Error fetching shifts in background:", err));
                return;
            }

            if (!shouldGenerate) {
                setNoReportMessage(`No hay reporte disponible para la fecha ${format(date, 'dd/MM/yyyy')}`);
                setCurrentReport(null);
                return;
            }

            // Generar nuevo reporte
            const response = await api.post('/api/restaurant/pos/daily-summaries/generate/', {
                date: dateStr,
                detailed: true,
                include_orders_detail: true
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            const responseData = response.data.data || response.data;
            const generatedSummary = responseData.summary || responseData;

            if (generatedSummary) {
                setCurrentReport(generatedSummary);
                await fetchReports();
                await fetchDayShifts(dateStr);
            }

        } catch (err: any) {
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
    }, [reports, fetchReports, fetchDayShifts]);

    // ========== GENERAR REPORTE ==========
    const generateReport = useCallback(async (currentReportType: string, currentRange: { startDate: Date; endDate: Date }, shouldGenerate: boolean = false) => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setError('');
            setNoReportMessage('');
            setDebugInfo('');

            const startDate = format(currentRange.startDate, 'yyyy-MM-dd');
            const endDate = format(currentRange.endDate, 'yyyy-MM-dd');

            if (currentReportType === 'daily') {
                await loadDailyReport(currentRange.startDate, shouldGenerate);
                return;
            }

            if (!shouldGenerate) {
                const filteredReports = reports.filter(report => {
                    const reportDate = getValidDate(report.date || report.start_date);
                    if (!reportDate) return false;

                    return isWithinInterval(reportDate, {
                        start: startOfDay(currentRange.startDate),
                        end: endOfDay(currentRange.endDate)
                    });
                });

                if (filteredReports.length > 0) {
                    const latestReport = filteredReports[0];
                    setCurrentReport(latestReport);
                    return;
                } else {
                    setNoReportMessage(`No hay reportes disponibles para el período seleccionado (${format(currentRange.startDate, 'dd/MM/yyyy')} - ${format(currentRange.endDate, 'dd/MM/yyyy')})`);
                    setCurrentReport(null);
                    return;
                }
            }

            const payload: Record<string, any> = {
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

            const response = await api.post('/api/restaurant/pos/daily-summaries/get_report/', payload, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            const newReport = response.data.data || response.data;
            setCurrentReport(newReport);

        } catch (err: any) {
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
                await checkCurrentShift();
                await fetchDashboardStats();
                const fetchedReports = await fetchReports();
                setConnectionError(false);

                const todayObj = new Date();
                const todayStr = format(todayObj, 'yyyy-MM-dd');
                const todayReport = (fetchedReports || []).find(r => {
                    const reportDate = r.date || r.start_date;
                    if (!reportDate) return false;

                    if (reportDate.length === 10) {
                        return reportDate === todayStr;
                    }
                    return isSameLocalDate(reportDate, todayStr);
                });

                if (todayReport) {
                    setCurrentReport(todayReport);
                    setFilterType('today');
                    if (todayReport.date) {
                        fetchDayShifts(todayReport.date).catch(e => console.warn("Error init shifts:", e));
                    }
                } else {
                    setNoReportMessage('No hay reporte disponible para hoy. Puedes generar uno si es necesario.');
                }

            } catch (err: any) {
                console.error('Error inicializando reportes:', err);
                setConnectionError(true);
                setError('Error al conectar con el backend. Verifica que el servicio fast-food-service esté ejecutándose.');
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

            await api.post('/api/restaurant/pos/daily-summaries/close_day/', {
                date: format(new Date(), 'yyyy-MM-dd'),
                closing_notes: 'Cierre manual del día'
            }, {
                baseURL: getFastFoodBaseURL(),
                timeout: 15000
            });

            alert('Día cerrado exitosamente. Reporte final generado.');

            await fetchReports();
            await fetchDashboardStats();

            const todayObj = new Date();
            await loadDailyReport(todayObj, true);

        } catch (err: any) {
            console.error('Error closing day:', err);
            setError('Error al cerrar el día: ' + (err.response?.data?.error || err.message));
            setConnectionError(true);
            alert('Error al cerrar el día. Verifica que tengas permisos.');
        }
    };

    // ========== APLICAR QUICK FILTERS ==========
    const applyQuickFilter = (filter: string) => {
        setFilterType(filter);
        setNoReportMessage('');
        const todayObj = new Date();
        let newRange = { startDate: todayObj, endDate: todayObj };
        let newReportType = 'daily';

        switch (filter) {
            case 'today':
                newReportType = 'daily';
                newRange = { startDate: todayObj, endDate: todayObj };
                loadDailyReport(todayObj, false);
                break;
            case 'yesterday':
                const yesterday = subDays(todayObj, 1);
                newReportType = 'daily';
                newRange = { startDate: yesterday, endDate: yesterday };
                loadDailyReport(yesterday, false);
                break;
            case 'thisWeek':
                newReportType = 'weekly';
                newRange = {
                    startDate: startOfWeek(todayObj, { locale: es }),
                    endDate: todayObj
                };
                generateReport(newReportType, newRange, false);
                break;
            case 'lastWeek':
                newReportType = 'weekly';
                const lastWeekStart = subDays(startOfWeek(todayObj, { locale: es }), 7);
                const lastWeekEnd = subDays(endOfWeek(todayObj, { locale: es }), 7);
                newRange = {
                    startDate: lastWeekStart,
                    endDate: lastWeekEnd
                };
                generateReport(newReportType, newRange, false);
                break;
            case 'thisMonth':
                newReportType = 'monthly';
                newRange = {
                    startDate: startOfMonth(todayObj),
                    endDate: todayObj
                };
                generateReport(newReportType, newRange, false);
                break;
            default:
                newReportType = 'daily';
                newRange = { startDate: todayObj, endDate: todayObj };
                loadDailyReport(todayObj, false);
        }

        setReportType(newReportType);
        setDateRange(newRange);
    };

    // ========== FETCH SHIFTS BY DATE ==========
    const fetchShifts = useCallback(async (date: Date) => {
        try {
            setLoadingData(true);
            setConnectionError(false);
            setReports([]);

            const dateStr = format(date, 'yyyy-MM-dd');
            const response = await api.get('/api/restaurant/pos/shifts/by_date/', {
                baseURL: getFastFoodBaseURL(),
                params: { date: dateStr }
            });

            setReports(response.data.shifts || []);

        } catch (err) {
            console.error('Error fetching shifts:', err);
            setNoReportMessage('Error al cargar los turnos.');
        } finally {
            setLoadingData(false);
        }
    }, []);

    // Forzar la generación
    const forceGenerateReport = () => {
        setNoReportMessage('');
        if (dateRange.startDate) {
            if (reportType === 'daily') {
                loadDailyReport(dateRange.startDate, true);
            } else if (reportType === 'shift') {
                fetchShifts(dateRange.startDate);
            } else {
                generateReport(reportType, { startDate: dateRange.startDate, endDate: dateRange.endDate || dateRange.startDate }, true);
            }
        }
    };

    // ========== SILENT POLL REFRESH ==========
    const refreshCurrentData = useCallback(async () => {
        if (!currentReport) return;

        try {
            if (currentReport.is_shift_report && currentReport.shift_info?.id) {
                const response = await api.get(`/api/restaurant/pos/shifts/${currentReport.shift_info.id}/report/`, {
                    baseURL: getFastFoodBaseURL()
                });
                const shiftData = response.data;
                const normalizedReport = {
                    ...shiftData.summary,
                    shift_info: shiftData.shift_info,
                    orders_detail: shiftData.orders_detail,
                    payment_methods: shiftData.payment_methods,
                    top_products: shiftData.top_products,
                    date: shiftData.shift_info.opened_at,
                    is_shift_report: true,
                    generated_by: shiftData.shift_info.user
                };
                setCurrentReport(normalizedReport);
            } else if (currentReport.date && !currentReport.start_date) {
                const dateStr = currentReport.date;
                const response = await api.post('/api/restaurant/pos/daily-summaries/generate/', {
                    date: dateStr,
                    detailed: true,
                    include_orders_detail: true
                }, {
                    baseURL: getFastFoodBaseURL()
                });

                const responseData = response.data.data || response.data;
                const newData = responseData.summary || responseData;

                if (newData) {
                    setCurrentReport(newData);
                    fetchDayShifts(dateStr).catch(e => console.warn(e));
                }
            }
        } catch (err) {
            console.warn('Error en refrescamiento silencioso:', err);
        }
    }, [currentReport, fetchDayShifts]);

    // POLLING: Actualización cada 10s
    useEffect(() => {
        const interval = setInterval(() => {
            checkCurrentShift().catch(e => console.warn('Shift poll error', e));
            fetchDashboardStats().catch(e => console.warn('Dashboard poll error', e));
            fetchReports().catch(e => console.warn('Reports poll error', e));
            refreshCurrentData().catch(e => console.warn('Data poll error', e));
        }, 10000);

        return () => clearInterval(interval);
    }, [checkCurrentShift, fetchReports, fetchDashboardStats, refreshCurrentData]);

    // Handle PDF Print
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

    // ───────────────── RENDERS ─────────────────

    const renderDashboardStats = () => {
        if (!dashboardStats && connectionError) {
            return (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-5 shadow-sm">
                    <h3 className="text-rose-800 font-extrabold text-base mb-2">No se pudo conectar al backend</h3>
                    <p className="text-xs text-rose-700 mb-1">
                        URL del backend: <strong>{getFastFoodBaseURL()}</strong>
                    </p>
                    <p className="text-xs text-slate-500 mb-3.5">
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
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition"
                    >
                        Reintentar Conexión
                    </button>

                    {debugInfo && (
                        <div className="mt-4 p-3 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-lg overflow-x-auto whitespace-pre-wrap">
                            <strong>Información de depuración:</strong>
                            <pre className="mt-1">{debugInfo}</pre>
                        </div>
                    )}
                </div>
            );
        }

        if (!dashboardStats) return null;

        const isDayClosed = currentReport?.is_closed;

        return (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-5">
                <h3 className="text-slate-800 font-extrabold text-sm mb-4">Resumen del Día</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ventas Hoy</p>
                        <h4 className="text-xl font-extrabold text-emerald-600">
                            {formatCurrency(dashboardStats.sales?.today || dashboardStats.total_sales || 0)}
                        </h4>
                        {dashboardStats.sales?.change_percentage !== undefined && (
                            <p className={`text-[10px] mt-1 font-bold ${dashboardStats.sales?.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {dashboardStats.sales?.trend === 'up' ? '↗' : dashboardStats.sales?.trend === 'down' ? '↘' : '→'}
                                {Math.abs(dashboardStats.sales?.change_percentage || 0).toFixed(1)}% vs ayer
                            </p>
                        )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Órdenes Hoy</p>
                        <h4 className="text-xl font-extrabold text-indigo-600">
                            {(dashboardStats.orders?.today || dashboardStats.total_orders || 0).toLocaleString()}
                        </h4>
                    </div>

                    {!isDayClosed && (
                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Turnos Activos</p>
                            <h4 className="text-xl font-extrabold text-violet-650">
                                {dashboardStats.shifts?.active || 0}
                            </h4>
                        </div>
                    )}

                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Estado del Día</p>
                        <h4 className={`text-xl font-extrabold ${isDayClosed ? 'text-rose-650' : 'text-emerald-600'}`}>
                            {isDayClosed ? 'Cerrado' : 'Abierto'}
                        </h4>
                    </div>
                </div>
            </div>
        );
    };

    const renderMetrics = () => {
        if (!currentReport) return null;

        const metrics = [
            {
                title: 'Ventas Totales',
                value: formatCurrency(currentReport.total_sales || 0),
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-50/50',
                description: `Promedio: ${formatCurrency(currentReport.average_order_value || 0)}`
            },
            {
                title: 'Órdenes',
                value: (currentReport.total_orders || 0).toLocaleString(),
                color: 'text-amber-600',
                bgColor: 'bg-amber-50/55',
                description: `Items/orden: ${(currentReport.average_items_per_order || 0).toFixed(1)}`
            },
            {
                title: 'Productos (Unidades)',
                value: (currentReport.total_items_sold || 0).toLocaleString(),
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-50/50',
                description: 'Total de unidades vendidas'
            },
            {
                title: 'Clientes',
                value: (currentReport.total_customers || 0).toLocaleString(),
                color: 'text-rose-600',
                bgColor: 'bg-rose-50/50',
                description: 'Clientes únicos registrados'
            },
            {
                title: 'Descuentos',
                value: formatCurrency(currentReport.total_discounts || 0),
                color: 'text-violet-600',
                bgColor: 'bg-violet-50/50',
                description: 'Total aplicado'
            },
            {
                title: 'Propinas',
                value: formatCurrency(currentReport.total_tips || 0),
                color: 'text-pink-600',
                bgColor: 'bg-pink-50/50',
                description: 'Propinas recibidas'
            },
        ];

        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {metrics.map((metric, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{metric.title}</p>
                            <h3 className={`text-xl font-extrabold ${metric.color}`}>
                                {metric.value}
                            </h3>
                        </div>
                        {metric.description && (
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                {metric.description}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderPaymentMetrics = () => {
        if (!currentReport) return null;

        const metrics = [
            {
                title: 'Efectivo',
                value: formatCurrency(currentReport.cash_sales || 0),
                color: 'text-emerald-600',
                description: currentReport.cash_count ? `${currentReport.cash_count} pagos recibidos` : 'Transacciones en efectivo'
            },
            {
                title: 'Transferencia',
                value: formatCurrency(currentReport.transfer_sales || 0),
                color: 'text-blue-600',
                description: currentReport.transfer_count ? `${currentReport.transfer_count} pagos recibidos` : 'Transacciones bancarias'
            },
            {
                title: 'Tarjetas (TDD/TDC)',
                value: formatCurrency(currentReport.card_sales || 0),
                color: 'text-amber-600',
                description: 'Pagos con terminal'
            },
            {
                title: 'Pesos (COP)',
                value: `$${(currentReport.cop_sales || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`,
                color: 'text-violet-650',
                description: currentReport.cop_count ? `${currentReport.cop_count} pagos recibidos` : 'Pagos moneda extranjera'
            },
            {
                title: 'Otras Formas',
                value: formatCurrency(currentReport.other_sales || 0),
                color: 'text-slate-550',
                description: 'Otros métodos de pago'
            }
        ];

        return (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {metrics.map((metric, index) => (
                    <div key={`pay-${index}`} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{metric.title}</p>
                        <h3 className={`text-lg font-extrabold ${metric.color}`}>
                            {metric.value}
                        </h3>
                        {metric.description && (
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                {metric.description}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderSalesByHourChart = () => {
        if (!currentReport?.sales_by_hour || !Array.isArray(currentReport.sales_by_hour) || currentReport.sales_by_hour.length === 0) {
            return <div className="h-[300px] border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs italic">No hay datos de ventas por hora disponibles.</div>;
        }
        const hourData = currentReport.sales_by_hour
            .filter(item => item && item.total_sales !== undefined)
            .map(item => ({
                hora: item.hour_label || `${item.hour}:00`,
                ventas: parseFloat(String(item.total_sales || 0)),
            }))
            .sort((a, b) => parseInt(a.hora.split(':')[0]) - parseInt(b.hora.split(':')[0]));

        return (
            <div className="bg-slate-50/50 border border-slate-250/70 p-5 rounded-2xl">
                <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-4">Ventas por Hora (MXN)</h4>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hourData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="hora" style={{ fontSize: '10px', fill: '#64748b' }} />
                            <YAxis tickFormatter={(value) => formatCurrency(value).replace('$', '')} style={{ fontSize: '10px', fill: '#64748b' }} />
                            <Tooltip
                                formatter={(value: any) => [formatCurrency(value), 'Ventas']}
                                labelFormatter={(label) => `Hora: ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="ventas"
                                stroke={COLORS[0]}
                                fill={COLORS[0]}
                                fillOpacity={0.15}
                                name="Ventas"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const renderTopProductsChart = () => {
        if (!currentReport?.top_products || !Array.isArray(currentReport.top_products) || currentReport.top_products.length === 0) {
            return <div className="h-[300px] border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs italic">No hay datos de productos vendidos.</div>;
        }

        const productData = currentReport.top_products
            .filter(item => item && ((item.quantity || item.quantity_sold || 0) > 0))
            .map((item, index) => ({
                name: item.product_name?.substring(0, 20) + (item.product_name?.length > 20 ? '...' : '') || `Producto ${index + 1}`,
                cantidad: item.quantity || item.quantity_sold || 0,
            }));

        return (
            <div className="bg-slate-50/50 border border-slate-250/70 p-5 rounded-2xl">
                <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-4">Productos Vendidos</h4>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" angle={-15} textAnchor="end" height={50} style={{ fontSize: '9px', fill: '#64748b' }} />
                            <YAxis style={{ fontSize: '10px', fill: '#64748b' }} />
                            <Tooltip
                                formatter={(value) => [value, 'Cantidad Vendida']}
                                labelFormatter={(label) => `Producto: ${label}`}
                            />
                            <Bar dataKey="cantidad" name="Cantidad" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-500 font-semibold text-sm">
                Cargando datos iniciales...
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 font-sans bg-slate-50 min-h-screen text-slate-800">
            {/* Título principal */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Reportes del Sistema</h1>
                    <p className="text-xs text-slate-500 mt-1">Datos en tiempo real desde la base de datos.</p>
                </div>
                <div>
                    <Btn variant="danger" size="lg" onClick={closeDay}>
                        Cerrar Día
                    </Btn>
                </div>
            </div>

            {/* ========== GESTIÓN DE TURNO ========== */}
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4.5 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-sky-850 font-extrabold text-sm mb-1">Gestión de Turno</h3>
                        <p className="text-xs text-sky-800 leading-normal">
                            {currentShift ? (
                                <span>
                                    Turno: <strong>#{currentShift.shift_number}</strong> | Usuario: {currentShift.user_name || 'Usuario'} | Inicio: {new Date(currentShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | <strong className="text-emerald-700">Ventas: {formatCurrency(currentShift.total_sales || 0)}</strong>
                                </span>
                            ) : (
                                <span className="text-rose-600 font-bold">⚠️ No hay turno abierto. Las ventas no se registrarán correctamente.</span>
                            )}
                        </p>
                    </div>
                    <div>
                        {currentShift ? (
                            <Btn
                                variant="primary"
                                onClick={handleCloseShift}
                                disabled={processingShift}
                                className="flex items-center gap-1.5 font-bold shadow-md shadow-indigo-100"
                            >
                                <span className="material-icons text-base">lock_clock</span>
                                {processingShift ? 'Procesando...' : 'Cerrar Turno y Reporte'}
                            </Btn>
                        ) : (
                            <Btn
                                variant="success"
                                onClick={() => setShowShiftModal(true)}
                                disabled={processingShift}
                                className="flex items-center gap-1.5 font-bold shadow-md shadow-emerald-100"
                            >
                                <span className="material-icons text-base">access_time</span>
                                Abrir Nuevo Turno
                            </Btn>
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Stats */}
            {renderDashboardStats()}

            {/* Panel de Control */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-6">
                <h3 className="text-slate-800 font-extrabold text-sm border-b border-slate-100 pb-3 mb-4">Filtros y Generación</h3>

                <div className="flex gap-4.5 flex-col sm:flex-row flex-wrap items-stretch sm:items-end">
                    <div className="w-full sm:w-48">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Tipo de Reporte</label>
                        <Select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                        >
                            <option value="daily">Diario</option>
                            <option value="shift">Por Turno</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensual</option>
                            <option value="custom">Personalizado</option>
                        </Select>
                    </div>

                    <div className="w-full sm:w-auto">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                            {reportType === 'custom' ? 'Rango de Fechas' : 'Fecha'}
                        </label>
                        <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                            <DatePicker
                                selected={dateRange.startDate}
                                onChange={(date: Date | null) => setDateRange(prev => ({ ...prev, startDate: date }))}
                                dateFormat="dd/MM/yyyy"
                                locale={es}
                                className="w-full sm:w-36 px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 bg-white"
                            />

                            {reportType === 'custom' && (
                                <>
                                    <span className="text-slate-400 text-xs font-semibold">a</span>
                                    <DatePicker
                                        selected={dateRange.endDate}
                                        onChange={(date: Date | null) => setDateRange(prev => ({ ...prev, endDate: date }))}
                                        dateFormat="dd/MM/yyyy"
                                        locale={es}
                                        className="w-full sm:w-36 px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 bg-white"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-w-[150px] flex gap-2 justify-start sm:justify-end">
                        <Btn variant="primary" onClick={forceGenerateReport} disabled={loadingData || !dateRange.startDate}>
                            {loadingData ? 'Procesando...' : 'Generar / Buscar'}
                        </Btn>
                    </div>
                </div>

                {/* Filtros Rápidos */}
                <div className="mt-5 border-t border-slate-100 pt-4">
                    <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Filtros Rápidos</label>
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'yesterday', label: 'Ayer' },
                            { id: 'thisWeek', label: 'Esta Semana' },
                            { id: 'lastWeek', label: 'Semana Pasada' },
                            { id: 'thisMonth', label: 'Este Mes' }
                        ].map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => applyQuickFilter(filter.id)}
                                disabled={connectionError}
                                className={`px-4.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-200 border cursor-pointer ${
                                    filterType === filter.id
                                        ? 'bg-indigo-650 border-indigo-700 text-white'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Lista de Reportes Lateral */}
                <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-4.5 flex flex-col max-h-[750px]">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-3.5">
                        <h3 className="text-slate-800 font-extrabold text-sm">Reportes Recientes ({reports.length})</h3>
                        <button
                            onClick={() => fetchReports()}
                            disabled={connectionError}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold text-[10px] uppercase tracking-wider transition-colors"
                        >
                            Actualizar
                        </button>
                    </div>

                    <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
                        {reports.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-xs italic font-medium">No hay reportes generados.</div>
                        ) : (
                            reports.slice(0, 20).map((report, index) => {
                                const isShiftItem = report.shift_number !== undefined;
                                let reportDate: string, displayDate: string, itemId: string, isClosed: boolean, totalSales: number, totalOrders: number, labelTitle: string;

                                if (isShiftItem) {
                                    reportDate = report.opened_at;
                                    displayDate = `${formatDate(report.opened_at)} ${format(new Date(report.opened_at), 'HH:mm')}`;
                                    itemId = report.id;
                                    isClosed = report.status === 'closed';
                                    totalSales = report.total_sales;
                                    totalOrders = report.total_transactions;
                                    labelTitle = `Turno ${report.shift_number}`;
                                } else {
                                    reportDate = report.date || report.start_date;
                                    displayDate = formatDate(reportDate);
                                    itemId = report.id;
                                    isClosed = report.is_closed;
                                    totalSales = report.total_sales;
                                    totalOrders = report.total_orders;
                                    labelTitle = displayDate;
                                }

                                const isSelected = currentReport?.id === itemId ||
                                    (!isShiftItem && currentReport?.date === reportDate && !currentReport?.id && !report.id);

                                return (
                                    <div
                                        key={itemId || index}
                                        onClick={() => {
                                            if (itemId) {
                                                verDetalleReporte(itemId, isShiftItem);
                                            } else if (!isShiftItem) {
                                                const reportDateObj = getValidDate(reportDate);
                                                if (reportDateObj) {
                                                    loadDailyReport(reportDateObj, false);
                                                }
                                            }
                                        }}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-indigo-50/30 border-indigo-550 shadow-sm'
                                                : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-extrabold text-sm text-slate-800">{labelTitle}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                                                isClosed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-705 border border-rose-200'
                                            }`}>
                                                {isClosed ? 'CERRADO' : 'ABIERTO'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex flex-col bg-slate-50 rounded-lg p-2">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ventas Totales</span>
                                                <strong className="text-sm font-extrabold text-emerald-600 mt-0.5">{formatCurrency(totalSales || 0)}</strong>
                                            </div>
                                            <div className="flex flex-col bg-slate-50 rounded-lg p-2">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Órdenes</span>
                                                <strong className="text-sm font-extrabold text-slate-800 mt-0.5">{(totalOrders || 0).toLocaleString()}</strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Detalle del Reporte Central */}
                <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
                    {currentReport ? (
                        <div className="space-y-6">
                            {/* Header del Reporte */}
                            <div className="flex justify-between items-start border-b border-slate-100 pb-5 gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900">
                                        Reporte {reportType === 'daily' ? 'Diario' : reportType === 'weekly' ? 'Semanal' : reportType === 'monthly' ? 'Mensual' : 'Personalizado'}
                                    </h2>
                                    <div className="flex gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                        <span>Fecha: {formatDate(currentReport.date || currentReport.start_date)}
                                            {currentReport.end_date && currentReport.date !== currentReport.end_date && currentReport.start_date !== currentReport.end_date &&
                                                ` - ${formatDate(currentReport.end_date)}`}
                                        </span>
                                        <span>•</span>
                                        <span>Usuario: {currentReport.generated_by || 'Sistema'}</span>
                                    </div>
                                </div>
                                <div className="text-right sm:text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                                        currentReport.is_closed ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-250'
                                    }`}>
                                        {currentReport.is_closed ? 'DÍA CERRADO' : 'DÍA ABIERTO'}
                                    </span>
                                    <p className="text-[10px] text-slate-400 mt-1">Actualizado: {formatDate(currentReport.generated_at || new Date().toISOString())}</p>
                                </div>
                            </div>

                            {/* Alerta de Conexión */}
                            {connectionError && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs">
                                    <h4 className="font-bold text-sm mb-1">Nota importante</h4>
                                    <p>Estás viendo datos incompletos. Soluciona el error en el backend para ver datos en tiempo real y gráficos.</p>
                                </div>
                            )}

                            {/* Desglose de Turnos */}
                            <div>
                                <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-3">
                                    <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider">Desglose de Turnos</h3>
                                    <Btn
                                        variant="outline"
                                        onClick={handlePrintPDF}
                                        className="flex items-center gap-1 font-bold text-xs"
                                    >
                                        <span className="material-icons text-base">print</span>
                                        Imprimir Reporte del Día
                                    </Btn>
                                </div>

                                <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-4">
                                    {dayShifts && dayShifts.length > 0 ? (
                                        <div className="space-y-3">
                                            {dayShifts.map((shift) => (
                                                <div key={shift.id} className="flex justify-between items-center border-b border-slate-100/70 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <div className="font-bold text-slate-850 text-sm">Turno #{shift.shift_number} - {shift.user_name}</div>
                                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                                            {format(new Date(shift.opened_at), 'HH:mm')} - {shift.closed_at ? format(new Date(shift.closed_at), 'HH:mm') : 'En curso'}
                                                            <span className="ml-3 font-bold text-emerald-600">
                                                                Ventas: {formatCurrency(shift.total_sales || 0)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Btn
                                                        onClick={() => handlePrintShiftReport(shift.id)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="flex items-center gap-0.5 font-bold"
                                                    >
                                                        <span className="material-icons text-xs">picture_as_pdf</span>
                                                        PDF
                                                    </Btn>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-450 text-xs italic text-center py-2">No hay turnos registrados para este día.</p>
                                    )}
                                </div>
                            </div>

                            {/* Métricas Principales */}
                            <div>
                                <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider border-b border-slate-150 pb-2 mb-3">Métricas de Rendimiento</h3>
                                {renderMetrics()}
                            </div>

                            {/* Métricas de Pago */}
                            <div>
                                <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider border-b border-slate-150 pb-2 mb-3">Desglose de Pagos</h3>
                                {renderPaymentMetrics()}
                            </div>

                            {/* Gráficos */}
                            <div>
                                <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider border-b border-slate-150 pb-2 mb-4">Análisis de Gráficos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {renderSalesByHourChart()}
                                    {renderTopProductsChart()}
                                </div>
                            </div>

                            {/* Notas Adicionales */}
                            {currentReport.closing_notes && (
                                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4.5 text-sky-850">
                                    <h4 className="font-extrabold text-sm mb-1.5">Notas de Cierre</h4>
                                    <p className="text-xs leading-normal">{currentReport.closing_notes}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="material-icons text-slate-300 text-5xl mb-4">assessment</span>
                            <h3 className="text-slate-700 font-bold text-base mb-1.5">
                                {noReportMessage || 'Selecciona un reporte'}
                            </h3>
                            <p className="text-slate-450 text-xs max-w-sm leading-normal">
                                {noReportMessage
                                    ? 'Puedes generar un nuevo reporte usando el botón "Generar / Buscar"'
                                    : 'Haz clic en un reporte de la lista para ver su información detallada, métricas y gráficos de análisis.'}
                            </p>
                            {!noReportMessage && (
                                <button
                                    onClick={() => applyQuickFilter('today')}
                                    disabled={connectionError}
                                    className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-md shadow-indigo-100"
                                >
                                    Ver Hoy
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ========== MODAL PARA DETALLE COMPLETO ========== */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-base font-bold text-slate-800">
                                Detalle de Reporte {currentReport?.date ? formatDate(currentReport.date) : ''}
                            </h2>
                            <button className="bg-slate-100 hover:bg-slate-200 text-slate-500 border-none rounded-lg w-8 h-8 text-lg font-medium flex items-center justify-center cursor-pointer transition-colors" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 space-y-6">
                            {modalLoading ? (
                                <div className="text-center py-20 text-slate-400 text-sm font-semibold">Cargando detalles...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                        <div className="flex flex-col bg-slate-50 rounded-xl p-3">
                                            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Órdenes Totales</span>
                                            <strong className="text-lg font-extrabold text-slate-800 mt-1">{currentReport?.total_orders}</strong>
                                        </div>
                                        <div className="flex flex-col bg-slate-50 rounded-xl p-3">
                                            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Ventas Totales</span>
                                            <strong className="text-lg font-extrabold text-emerald-600 mt-1">{formatCurrency(currentReport?.total_sales || 0)}</strong>
                                        </div>
                                        <div className="flex flex-col bg-slate-50 rounded-xl p-3">
                                            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Items Vendidos</span>
                                            <strong className="text-lg font-extrabold text-indigo-600 mt-1">{currentReport?.total_items_sold}</strong>
                                        </div>
                                        <div className="flex flex-col bg-slate-50 rounded-xl p-3">
                                            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">Valor Promedio</span>
                                            <strong className="text-lg font-extrabold text-slate-800 mt-1">{formatCurrency(currentReport?.average_order_value || 0)}</strong>
                                        </div>
                                    </div>

                                    {/* Desglose de Turnos en Modal */}
                                    <div>
                                        <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider mb-3">Turnos del Día</h3>
                                        <div className="bg-white rounded-2xl border border-slate-200 p-4.5 space-y-3">
                                            {dayShifts && dayShifts.length > 0 ? (
                                                dayShifts.map((shift) => (
                                                    <div key={shift.id} className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">Turno #{shift.shift_number} - {shift.user_name}</div>
                                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                                {format(new Date(shift.opened_at), 'HH:mm')} - {shift.closed_at ? format(new Date(shift.closed_at), 'HH:mm') : 'En curso'}
                                                                <span className="ml-3 font-bold text-emerald-600">
                                                                    Ventas: {formatCurrency(shift.total_sales || 0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Btn
                                                            onClick={() => handlePrintShiftReport(shift.id)}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="flex items-center gap-0.5 font-bold"
                                                        >
                                                            <span className="material-icons text-xs">picture_as_pdf</span>
                                                            PDF
                                                        </Btn>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-slate-400 text-xs italic text-center py-2">No hay turnos registrados para este día.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Desglose de Pagos Modal */}
                                    <div>
                                        <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider mb-3">Desglose de Pagos</h3>
                                        {renderPaymentMetrics()}
                                    </div>

                                    {/* Gráficos en Modal */}
                                    <div>
                                        <h3 className="text-slate-800 font-extrabold text-sm uppercase tracking-wider mb-3">Análisis de Gráficos</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {renderSalesByHourChart()}
                                            {renderTopProductsChart()}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-150 flex justify-end gap-2 bg-white">
                            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cerrar</Btn>
                            <Btn variant="primary" onClick={handlePrintPDF}>Imprimir Reporte Completo</Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== MODAL PARA ABRIR TURNO ========== */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-sm font-extrabold text-slate-805">Abrir Nuevo Turno</h2>
                            <button className="bg-slate-100 hover:bg-slate-200 text-slate-500 border-none rounded-lg w-7 h-7 text-lg font-medium flex items-center justify-center cursor-pointer transition-colors" onClick={() => setShowShiftModal(false)}>×</button>
                        </div>
                        <div className="p-5">
                            <form onSubmit={handleOpenShift} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre del Encargado *</label>
                                    <Input
                                        required
                                        type="text"
                                        value={managerName}
                                        onChange={(e) => setManagerName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Notas (Opcional)</label>
                                    <textarea
                                        value={shiftNotes}
                                        onChange={(e) => setShiftNotes(e.target.value)}
                                        placeholder="Observaciones iniciales..."
                                        className="w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-850 transition bg-white resize-none"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Btn type="button" variant="ghost" onClick={() => setShowShiftModal(false)}>Cancelar</Btn>
                                    <Btn type="submit" variant="success" disabled={processingShift}>
                                        {processingShift ? 'Abriendo...' : 'Abrir Turno'}
                                    </Btn>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Micro-componentes Auxiliares ───
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    readOnly?: boolean;
}

const Input: React.FC<InputProps> = (props) => (
    <input
        {...props}
        className={`w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition ${
            props.readOnly ? 'bg-slate-50 cursor-default' : 'bg-white'
        } ${props.className || ''}`}
    />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({ children, ...props }) => (
    <select
        {...props}
        className={`w-full px-3.5 py-2 text-sm text-slate-800 border border-slate-200 rounded-xl outline-none focus:border-slate-800 transition bg-white ${
            props.className || ''
        }`}
    >
        {children}
    </select>
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
        ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-none',
        outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
    };
    const v = variants[variant] || variants.primary;
    const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-6 py-2.5 text-sm' : 'px-4.5 py-2 text-xs';
    return (
        <button
            {...props}
            className={`rounded-xl font-bold uppercase tracking-wider transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${v} ${pad} ${
                props.className || ''
            }`}
        >
            {children}
        </button>
    );
};

export default Reportes;
