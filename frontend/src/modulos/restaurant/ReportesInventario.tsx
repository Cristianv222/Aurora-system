import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Utilidad para convertir decimales a fracciones comunes
const formatFraction = (decimalStr: string) => {
    const val = parseFloat(decimalStr);
    if (isNaN(val)) return decimalStr;
    if (val === 0) return '0';
    
    const whole = Math.floor(val);
    const fraction = val - whole;
    
    let fractionStr = '';
    if (Math.abs(fraction - 0.25) < 0.01) fractionStr = '1/4';
    else if (Math.abs(fraction - 0.5) < 0.01) fractionStr = '1/2';
    else if (Math.abs(fraction - 0.75) < 0.01) fractionStr = '3/4';
    else if (fraction > 0) fractionStr = fraction.toFixed(2).replace('0.', '.');

    if (whole > 0 && fractionStr) {
        return `${whole} ${fractionStr}`;
    } else if (fractionStr) {
        return fractionStr;
    }
    return whole.toString();
};

interface DailyInventory {
    id: string;
    raw_material_name: string;
    raw_material_unit: string;
    previous_balance: string;
    income: string;
    consumption: string;
    current_balance: string;
}

const ReportesInventario: React.FC = () => {
    // Formato YYYY-MM-DD para el input type="date"
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [reportData, setReportData] = useState<DailyInventory[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadData = async () => {
            // Si la fecha seleccionada es hoy, primero intentamos generar/asegurar el cierre de hoy
            if (selectedDate === today) {
                try {
                    await api.post('/api/restaurant/inventory/daily-inventory/generate_daily/', {
                        date: today
                    });
                } catch (err) {
                    console.error("Error al generar cierre diario automático:", err);
                }
            }
            // Luego, cargamos el reporte de la fecha seleccionada
            fetchReport(selectedDate);
        };
        
        loadData();
    }, [selectedDate]);

    const fetchReport = async (date: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/api/restaurant/inventory/daily-inventory/?date=${date}`);
            setReportData(res.data.results || res.data || []);
        } catch (error) {
            console.error('Error fetching report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        
        // Configurar Título
        doc.setFontSize(18);
        doc.text('Reporte Diario de Inventario', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        // Fecha formateada
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        doc.text(`Fecha: ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`, 14, 30);
        
        const tableColumn = ["Materia Prima", "Unidad", "Saldo Anterior", "Ingreso", "Consumo", "Saldo Actual"];
        const tableRows: any[] = [];

        reportData.forEach(item => {
            const rowData = [
                item.raw_material_name,
                item.raw_material_unit,
                formatFraction(item.previous_balance),
                formatFraction(item.income) !== '0' ? formatFraction(item.income) : '-',
                formatFraction(item.consumption) !== '0' ? formatFraction(item.consumption) : '-',
                formatFraction(item.current_balance)
            ];
            tableRows.push(rowData);
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        doc.save(`Reporte_Inventario_${selectedDate}.pdf`);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 m-0 mb-1">Cierres Diarios</h2>
                    <p className="text-xs text-slate-500 m-0">Consulta el historial de movimientos de inventario por día</p>
                </div>
                
                <div className="flex gap-2 items-center w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <input 
                            type="date" 
                            className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-slate-400 font-medium cursor-pointer"
                            value={selectedDate}
                            max={today}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={reportData.length === 0 || loading}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 whitespace-nowrap"
                    >
                        <i className="bi bi-file-earmark-pdf-fill" /> Descargar PDF
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium">Cargando reporte...</p>
                </div>
            ) : reportData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <i className="bi bi-calendar-x text-4xl block mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No hay registros de inventario para esta fecha.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse min-w-[800px] text-sm text-center">
                        <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wider">MATERIA PRIMA</th>
                                <th className="px-4 py-3.5 font-bold text-slate-600 text-xs uppercase tracking-wider">SALDO ANTERIOR</th>
                                <th className="px-4 py-3.5 font-bold text-emerald-600 text-xs uppercase tracking-wider">INGRESO</th>
                                <th className="px-4 py-3.5 font-bold text-rose-600 text-xs uppercase tracking-wider">CONSUMO</th>
                                <th className="px-4 py-3.5 font-bold text-slate-800 text-xs uppercase tracking-wider">SALDO FINAL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {reportData.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-left font-semibold text-slate-800">
                                        {row.raw_material_name} <span className="text-xs text-slate-400 font-normal ml-1">({row.raw_material_unit})</span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{formatFraction(row.previous_balance)}</td>
                                    <td className="px-4 py-3 text-emerald-600 font-medium">
                                        {formatFraction(row.income) !== '0' ? formatFraction(row.income) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-rose-600 font-medium">
                                        {formatFraction(row.consumption) !== '0' ? formatFraction(row.consumption) : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800">{formatFraction(row.current_balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ReportesInventario;
