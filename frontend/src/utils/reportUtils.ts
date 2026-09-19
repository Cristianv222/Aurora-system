import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Formato de moneda
export const formatCurrency = (amount: any): string => {
    if (amount === undefined || amount === null) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD', // Ecuador usa USD
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
};

// Formato de fecha
export const formatDate = (dateString: any): string => {
    try {
        if (!dateString) return 'Fecha no disponible';

        let date: Date;
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-').map(Number);
            date = new Date(y, m - 1, d);
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-EC', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Guayaquil'
        });
    } catch (e) {
        return dateString;
    }
};

// Obtener fecha válida
export const getValidDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;

    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [y, m, d] = dateValue.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
};

// Generar PDF Detallado Profesional
export const generateDetailedPDF = (report: any, reportType: string, dateRangeStr: string): void => {
    if (!report) {
        alert('No hay reporte seleccionado para imprimir.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 0;
    const MARGIN = 14;

    // --- 1. BANNER ENCABEZADO MODERNO ---
    doc.setFillColor(15, 23, 42); // #0f172a (Dark Slate)
    doc.rect(0, 0, pageWidth, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('AURORA POS SYSTEM', MARGIN, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // #94a3b8
    const titleSub = report.is_shift_report ? 'REPORTE DETALLADO DE TURNO' : 'REPORTE DE VENTAS Y OPERACIONES';
    doc.text(titleSub, MARGIN, 24);

    // Información del reporte (Derecha del Banner)
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    const printDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    doc.text(`Generado: ${printDate}`, pageWidth - MARGIN, 14, { align: 'right' });

    let periodLabel = dateRangeStr || report.date_formatted || report.date || 'Actual';
    if (report.is_shift_report && report.shift_info) {
        periodLabel = `Turno #${report.shift_info.number || report.shift_number || ''}`;
    }
    doc.text(`Periodo: ${periodLabel}`, pageWidth - MARGIN, 22, { align: 'right' });

    y = 44;

    // --- 2. TARJETAS KPI RESUMEN ---
    // Determinar Total de Ventas REAL del reporte
    const totalSalesVal = parseFloat(
        report.total_sales ?? report.summary?.total_sales ?? report.total_sales_amount ?? 0
    );
    const totalOrdersVal = report.total_orders ?? report.summary?.total_orders ?? report.total_transactions ?? 0;
    const totalItemsVal = report.total_items_sold ?? report.summary?.total_items_sold ?? 0;
    const avgOrderVal = totalOrdersVal > 0 ? (totalSalesVal / totalOrdersVal) : (report.average_order_value || 0);

    const cardWidth = (pageWidth - (MARGIN * 2) - 9) / 4;
    const cardHeight = 18;

    const kpis = [
        { label: 'VENTAS TOTALES', val: formatCurrency(totalSalesVal), color: [16, 185, 129] },
        { label: 'TOTAL ÓRDENES', val: `${totalOrdersVal}`, color: [59, 130, 246] },
        { label: 'PRODUCTOS', val: `${totalItemsVal}`, color: [245, 158, 11] },
        { label: 'PROMEDIO / ORDEN', val: formatCurrency(avgOrderVal), color: [139, 92, 246] },
    ];

    kpis.forEach((kpi, idx) => {
        const xPos = MARGIN + (idx * (cardWidth + 3));
        
        // Card Background
        doc.setFillColor(248, 250, 252); // #f8fafc
        doc.setDrawColor(226, 232, 240); // #e2e8f0
        doc.roundedRect(xPos, y, cardWidth, cardHeight, 2, 2, 'FD');

        // Top Color Bar
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.rect(xPos, y, cardWidth, 2, 'F');

        // Text
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, xPos + 4, y + 7);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(kpi.val, xPos + 4, y + 14);
    });

    y += cardHeight + 10;

    // --- 3. TABLA DE DESGLOSE DE PAGOS ---
    const cashSales    = parseFloat(report.cash_sales ?? report.summary?.cash_sales ?? 0);
    const cashCount    = report.cash_count ?? report.summary?.cash_count ?? 0;
    const transferSales= parseFloat(report.transfer_sales ?? report.summary?.transfer_sales ?? 0);
    const transferCount= report.transfer_count ?? report.summary?.transfer_count ?? 0;
    const cardSales    = parseFloat(report.card_sales ?? report.summary?.card_sales ?? 0);
    const copSales     = parseFloat(report.cop_sales ?? report.summary?.cop_sales ?? 0);
    const copCount     = report.cop_count ?? report.summary?.cop_count ?? 0;
    const otherSales   = parseFloat(report.other_sales ?? report.summary?.other_sales ?? 0);

    const paymentRows: any[] = [];
    paymentRows.push(['Efectivo (USD)', `${cashCount} transacción(es)`, formatCurrency(cashSales)]);
    paymentRows.push(['Transferencia', `${transferCount} transacción(es)`, formatCurrency(transferSales)]);
    paymentRows.push(['Tarjetas (TDD/TDC)', '—', formatCurrency(cardSales)]);
    if (copSales > 0 || copCount > 0) {
        paymentRows.push(['Pesos (COP)', `${copCount} transacción(es)`, `$${Math.round(copSales).toLocaleString('es-CO')} COP`]);
    }
    if (otherSales > 0) {
        paymentRows.push(['Otros métodos', '—', formatCurrency(otherSales)]);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Desglose de Pagos Registrados', MARGIN, y);
    y += 4;

    (doc as any).autoTable({
        startY: y,
        head: [['Método de Pago', 'Transacciones', 'Monto Registrado']],
        body: paymentRows,
        theme: 'striped',
        headStyles: {
            fillColor: [30, 41, 59], // #1e293b
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5
        },
        bodyStyles: {
            fontSize: 8.5,
            cellPadding: 2.5
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 45, halign: 'center' },
            2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // --- 4. TABLA DE PRODUCTOS MÁS VENDIDOS ---
    const topProductsRaw = report.top_products || [];
    const topProductsRows = topProductsRaw.map((p: any) => {
        const qty = p.quantity || p.quantity_sold || 0;
        const total = p.total_amount || 0;
        const avgPrice = p.average_price || (qty > 0 ? total / qty : 0);
        const pName = p.product_name || p.product__name || 'Producto';
        const category = p.category || p.product__category__name || 'Sin Categoría';

        return [
            p.rank || '-',
            pName,
            category,
            `${qty}`,
            formatCurrency(avgPrice),
            formatCurrency(total)
        ];
    });

    if (topProductsRows.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Productos Vendidos', MARGIN, y);
        y += 4;

        (doc as any).autoTable({
            startY: y,
            head: [['#', 'Producto', 'Categoría', 'Cantidad', 'Precio Prom.', 'Monto Total']],
            body: topProductsRows,
            theme: 'striped',
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2.5
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 35 },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
            },
            margin: { left: MARGIN, right: MARGIN }
        });

        y = (doc as any).lastAutoTable.finalY + 10;
    }

    // --- 5. CUADRO RESUMEN DE VENTAS FINAL ---
    if (y + 25 > pageHeight - 15) {
        doc.addPage();
        y = 20;
    }

    doc.setFillColor(15, 23, 42); // #0f172a
    doc.roundedRect(MARGIN, y, pageWidth - (MARGIN * 2), 16, 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL DE VENTAS (ÓRDENES COMPLETADAS):', MARGIN + 6, y + 10.5);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(52, 211, 153); // #34d399 (Emerald Green)
    doc.text(formatCurrency(totalSalesVal), pageWidth - MARGIN - 6, y + 10.5, { align: 'right' });

    // Pie de página
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Aurora System POS • Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    const reportFileName = report.is_shift_report && report.shift_info
        ? `Reporte_Turno_${report.shift_info.number || ''}.pdf`
        : `Reporte_Ventas_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

    doc.save(reportFileName);
};
