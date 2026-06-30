import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export const generateHotelShiftPDF = (report: any): void => {
    if (!report || !report.shift_info) {
        alert('No hay datos del turno para generar el reporte PDF.');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const MARGIN = 15;

    // --- 1. Header (Negocio / Info Impresión) ---
    doc.setFontSize(9);
    doc.setTextColor(100);
    const printDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    doc.text(`Impreso: ${printDate}`, MARGIN, y);
    doc.text("HOTEL AURORA - GESTIÓN RECURSOS", pageWidth - MARGIN, y, { align: 'right' });
    y += 5;
    
    // --- 2. Title ---
    y += 10;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('REPORTE DE AUDITORÍA DE TURNO', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Line under title
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 8;

    // --- 3. Shift Metadata Block ---
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // slate-700
    
    const info = report.shift_info;
    const openedStr = info.opened_at ? format(new Date(info.opened_at), 'dd/MM/yyyy HH:mm:ss') : 'No registrado';
    const closedStr = info.closed_at ? format(new Date(info.closed_at), 'dd/MM/yyyy HH:mm:ss') : 'Activo (Sin cerrar)';
    
    // Grid alignment for metadata
    const col1 = MARGIN;
    const col2 = pageWidth / 2;
    
    doc.setFont(undefined, 'bold');
    doc.text("Turno Nro:", col1, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(info.shift_number), col1 + 25, y);
    
    doc.setFont(undefined, 'bold');
    doc.text("Recepcionista:", col2, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(info.user_name), col2 + 28, y);
    y += 6;
    
    doc.setFont(undefined, 'bold');
    doc.text("Hora Entrada:", col1, y);
    doc.setFont(undefined, 'normal');
    doc.text(openedStr, col1 + 25, y);
    
    doc.setFont(undefined, 'bold');
    doc.text("Hora Salida:", col2, y);
    doc.setFont(undefined, 'normal');
    doc.text(closedStr, col2 + 28, y);
    y += 10;

    // Notes if any
    if (info.opening_notes || info.closing_notes) {
        doc.setFontSize(9);
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(241, 245, 249); // slate-100
        
        let notesText = '';
        if (info.opening_notes) notesText += `Apertura: ${info.opening_notes}   `;
        if (info.closing_notes) notesText += `Salida: ${info.closing_notes}`;
        
        doc.rect(MARGIN, y - 4, pageWidth - (MARGIN * 2), 10, 'FD');
        doc.setFont(undefined, 'italic');
        doc.text(`Novedades: ${notesText}`, MARGIN + 4, y + 2, { maxWidth: pageWidth - (MARGIN * 2) - 8 });
        y += 12;
    }

    // --- 4. Summary Totals (Cards style) ---
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Resumen de Transacciones', MARGIN, y);
    y += 6;

    const summary = report.summary || { total_sales: 0, cash_sales: 0, card_sales: 0, transfer_sales: 0, total_transactions: 0 };
    
    const summaryRows = [
        ['Efectivo Recaudado', `$${Number(summary.cash_sales || 0).toFixed(2)}`],
        ['Tarjeta (Débito/Crédito)', `$${Number(summary.card_sales || 0).toFixed(2)}`],
        ['Transferencia Bancaria', `$${Number(summary.transfer_sales || 0).toFixed(2)}`],
        ['Total Recaudado en Turno', `$${Number(summary.total_sales || 0).toFixed(2)}`],
        ['Total Reservaciones / Check-ins', `${summary.total_transactions} movimientos`]
    ];

    (doc as any).autoTable({
        startY: y,
        head: [['Detalle Financiero', 'Monto / Cantidad']],
        body: summaryRows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }, // indigo-600
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    // --- 5. Table of Payments ---
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Detalle de Cobros y Movimientos', MARGIN, y);
    y += 6;

    const payments = report.payments || [];
    const paymentRows = payments.map((p: any) => {
        const timeStr = p.created_at ? format(new Date(p.created_at), 'HH:mm') : '-';
        return [
            timeStr,
            `Habitación ${p.room_number}`,
            p.reservation_code,
            p.guest_name,
            p.payment_method.toUpperCase(),
            `$${Number(p.amount).toFixed(2)}`
        ];
    });

    if (paymentRows.length === 0) {
        paymentRows.push(['-', 'Sin movimientos registrados', '-', '-', '-', '$0.00']);
    }

    (doc as any).autoTable({
        startY: y,
        head: [['Hora', 'Hab.', 'Código', 'Huésped', 'Método', 'Monto']],
        body: paymentRows,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: { bottom: 0.1 } },
        headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold', lineWidth: { bottom: 1 }, lineColor: [203, 213, 225] },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 25 },
            2: { cellWidth: 35, fontStyle: 'italic' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    // Save report PDF
    const filename = `Reporte_Turno_${info.shift_number}.pdf`;
    doc.save(filename);
};
