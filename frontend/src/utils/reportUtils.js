import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

// Formato de moneda
export const formatCurrency = (amount) => {
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
export const formatDate = (dateString) => {
    try {
        if (!dateString) return 'Fecha no disponible';

        // Fix para strings "YYYY-MM-DD" que JS interpreta como UTC
        let date;
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [y, m, d] = dateString.split('-').map(Number);
            date = new Date(y, m - 1, d); // Constructor local
        } else {
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) return dateString;

        return date.toLocaleDateString('es-EC', {
            weekday: 'long', // "lunes", "martes"...
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
export const getValidDate = (dateValue) => {
    if (!dateValue) return null;

    // Fix para strings "YYYY-MM-DD"
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [y, m, d] = dateValue.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
};

// Generar PDF Detallado
// Generar PDF Simplificado (Estilo Recibo/Reporte Simple)
export const generateDetailedPDF = (report, reportType, dateRangeStr) => {
    if (!report) {
        alert('No hay reporte seleccionado para imprimir.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const MARGIN = 15;

    // --- 1. Encabezado Simple ---
    doc.setFontSize(10);
    doc.setTextColor(50);

    // Fecha y hora de impresión
    const printDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    doc.text(printDate, MARGIN, y);

    // Nombre del Negocio / Usuario (Derecha)
    const businessName = "KROKY Carlos"; // Nombre fijo o configurar si hay
    const userName = report.shift_info?.user || "Guacalés Carvajal"; // O nombre del usuario actual

    doc.text(businessName, pageWidth - MARGIN, y, { align: 'right' });
    y += 5;
    doc.text(userName, pageWidth - MARGIN, y, { align: 'right' });

    y += 20;

    // --- 2. Título Central ---
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text('Detalles de ventas', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Rango de fechas / Fechas del turno
    doc.setFontSize(10);
    doc.setTextColor(0);

    let dateInfo = '';
    if (report.is_shift_report && report.shift_info) {
        // Usar fechas reales del turno si existen
        const open = report.shift_info.opened_at ? format(new Date(report.shift_info.opened_at), 'dd/MM/yyyy HH:mm:ss') : '';
        const close = report.shift_info.closed_at ? format(new Date(report.shift_info.closed_at), 'dd/MM/yyyy HH:mm:ss') : '';
        dateInfo = `${open} - ${close}`;
    } else {
        dateInfo = dateRangeStr;
    }

    doc.text(dateInfo, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // --- 3. Tabla de Productos (Productos) ---
    doc.setFontSize(14);
    doc.text('Productos', MARGIN, y);
    y += 5;

    const topProducts = (report.top_products || [])
        .map(p => {
            // Calcular precio unitario aproximado si no viene
            const qty = p.quantity || p.quantity_sold || 0;
            const total = p.total_amount || 0;
            const unitPrice = qty > 0 ? (total / qty) : 0;

            // Backend puede devolver product__name o product_name
            const pName = p.product_name || p.product__name || 'Desconocido';

            return [
                pName,
                `${qty.toFixed(1)} Unidades`,
                unitPrice.toFixed(1) // Mostrar con 1 decimal o 2 según imagen (imagen muestra 15.0, 3.9, 0.7)
            ];
        });

    if (topProducts.length === 0) {
        topProducts.push(['Sin ventas registradas', '-', '-']);
    }

    doc.autoTable({
        startY: y,
        head: [['Producto', 'Cantidad', 'Unidad de precio']],
        body: topProducts,
        theme: 'plain', // Estilo simple sin stripes
        styles: {
            fontSize: 10,
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: { bottom: 0.1 }
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: { bottom: 1 }, // Línea negra bajo header
            lineColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' }
        },
        margin: { left: MARGIN, right: MARGIN },
    });

    y = doc.lastAutoTable.finalY + 15;

    // --- 4. Desglose de Pagos ---
    const cashSales    = report.summary?.cash_sales     ?? report.cash_sales     ?? 0;
    const cashCount    = report.summary?.cash_count     ?? report.cash_count     ?? 0;
    const transferSales= report.summary?.transfer_sales ?? report.transfer_sales ?? 0;
    const transferCount= report.summary?.transfer_count ?? report.transfer_count ?? 0;
    const cardSales    = report.summary?.card_sales     ?? report.card_sales     ?? 0;
    const copSales     = report.summary?.cop_sales      ?? report.cop_sales      ?? 0;
    const copCount     = report.summary?.cop_count      ?? report.cop_count      ?? 0;
    const otherSales   = report.summary?.other_sales    ?? report.other_sales    ?? 0;

    const hasPaymentData = cashSales || transferSales || cardSales || copSales || otherSales;

    if (hasPaymentData) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Desglose de Pagos', MARGIN, y);
        y += 5;

        const paymentRows = [];
        if (cashSales > 0 || cashCount > 0)
            paymentRows.push(['Efectivo (USD)', `${cashCount} pago(s)`, `$${parseFloat(cashSales).toFixed(2)}`]);
        if (transferSales > 0 || transferCount > 0)
            paymentRows.push(['Transferencia', `${transferCount} pago(s)`, `$${parseFloat(transferSales).toFixed(2)}`]);
        if (cardSales > 0)
            paymentRows.push(['Tarjetas (TDD/TDC)', '—', `$${parseFloat(cardSales).toFixed(2)}`]);
        if (copSales > 0 || copCount > 0)
            paymentRows.push(['Pesos (COP)', `${copCount} pago(s)`, `$${Math.round(parseFloat(copSales)).toLocaleString('es-CO')} COP`]);
        if (otherSales > 0)
            paymentRows.push(['Otros métodos', '—', `$${parseFloat(otherSales).toFixed(2)}`]);

        if (paymentRows.length === 0)
            paymentRows.push(['Sin pagos registrados', '—', '—']);

        doc.autoTable({
            startY: y,
            head: [['Método de Pago', 'Transacciones', 'Monto']],
            body: paymentRows,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: { bottom: 0.1 } },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: { bottom: 1 }, lineColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 45, halign: 'right' }
            },
            margin: { left: MARGIN, right: MARGIN },
        });

        y = doc.lastAutoTable.finalY + 15;
    }

    // --- 5. Total Final ---
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');

    // Total USD = suma de pagos NO-COP (efectivo + transferencia + tarjeta + otros)
    const totalUSD = parseFloat(cashSales || 0) + parseFloat(transferSales || 0) +
                     parseFloat(cardSales || 0) + parseFloat(otherSales || 0);

    // Total COP en pesos
    const totalCOPVal = parseFloat(copSales || 0);

    // Fallback: si no hay pagos registrados, usar el total de las ordenes
    const fallbackTotal = parseFloat(
        report.summary?.total_sales ?? report.total_sales ?? 0
    );
    const displayTotalUSD = (totalUSD === 0 && totalCOPVal === 0 && fallbackTotal > 0)
        ? fallbackTotal
        : totalUSD;

    if (totalCOPVal > 0) {
        // Mostrar dos totales separados
        doc.text(`Total USD: $${displayTotalUSD.toFixed(2)}`, MARGIN + 10, y);
        y += 8;
        doc.setFontSize(13);
        doc.text(`Total COP: $${Math.round(totalCOPVal).toLocaleString('es-CO')} COP  (aprox. $${(totalCOPVal / 4000).toFixed(2)} USD)`, MARGIN + 10, y);
    } else {
        // Solo USD (o fallback de ordenes si no hay pagos)
        doc.text(`Total: $${displayTotalUSD.toFixed(2)}`, MARGIN + 10, y);
    }

    const reportFileName = report.is_shift_report && report.shift_info
        ? `Reporte_Turno_${report.shift_info.number}.pdf`
        : `Reporte_Ventas_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

    doc.save(reportFileName);
};
