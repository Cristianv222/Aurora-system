import jsPDF from 'jspdf';

export const printOrderPDF = (order) => {
    if (!order) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('ORDEN DE COMPRA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Order number and date
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Orden: ${order.order_number}`, 20, yPos);
    yPos += 7;
    doc.text(`Fecha: ${new Date(order.created_at).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}`, 20, yPos);
    yPos += 10;

    // Separator line
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    // Customer info
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Cliente:', 20, yPos);
    yPos += 7;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(order.customer_name || 'Cliente Casual', 20, yPos);
    yPos += 7;
    doc.text(`Tipo: ${order.order_type_display}`, 20, yPos);
    if (order.table_number) {
        yPos += 7;
        doc.text(`Mesa: ${order.table_number}`, 20, yPos);
    }
    yPos += 10;

    // Separator line
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    // Products header
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Productos:', 20, yPos);
    yPos += 10;

    // Products table header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Producto', 20, yPos);
    doc.text('Cant.', 120, yPos);
    doc.text('Precio', 145, yPos);
    doc.text('Total', 170, yPos, { align: 'right' });
    yPos += 5;
    doc.setLineWidth(0.3);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 7;

    // Products list
    doc.setFont(undefined, 'normal');
    if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
            const productName = item.product_details?.name || item.product_name || 'Producto';

            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.text(productName, 20, yPos);
            doc.text(item.quantity.toString(), 120, yPos);
            doc.text(`$${parseFloat(item.unit_price).toFixed(2)}`, 145, yPos);
            doc.text(`$${parseFloat(item.line_total || item.subtotal).toFixed(2)}`, 170, yPos, { align: 'right' });
            yPos += 7;
        });
    }

    yPos += 5;
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;

    // Totals
    doc.setFont(undefined, 'normal');
    doc.text('Subtotal:', 120, yPos);
    doc.text(`$${parseFloat(order.subtotal).toFixed(2)}`, 170, yPos, { align: 'right' });
    yPos += 7;

    if (order.tax_amount && order.tax_amount > 0) {
        doc.text('Impuestos:', 120, yPos);
        doc.text(`$${parseFloat(order.tax_amount).toFixed(2)}`, 170, yPos, { align: 'right' });
        yPos += 7;
    }

    if (order.discount_amount && order.discount_amount > 0) {
        doc.text('Descuento:', 120, yPos);
        doc.text(`-$${parseFloat(order.discount_amount).toFixed(2)}`, 170, yPos, { align: 'right' });
        yPos += 7;
    }

    yPos += 3;
    doc.setLineWidth(0.5);
    doc.line(120, yPos, pageWidth - 20, yPos);
    yPos += 7;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', 120, yPos);
    doc.text(`$${parseFloat(order.total).toFixed(2)}`, 170, yPos, { align: 'right' });

    // Notes
    if (order.notes) {
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Notas:', 20, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(order.notes, pageWidth - 40);
        doc.text(splitNotes, 20, yPos);
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text('Gracias por su compra', pageWidth / 2, footerY, { align: 'center' });

    // Save PDF
    doc.save(`Orden-${order.order_number}.pdf`);
};
