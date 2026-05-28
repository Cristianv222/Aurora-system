// src/services/printerServiceRestaurant.ts
import api from './api';
import { Order } from '../types';

// Base URL del módulo de impresión en el backend
const PRINTER_API_URL = '/api/restaurant/hardware';

class PrinterServiceRestaurant {

  /**
   * Imprime el ticket de recibo (POS) y abre la caja registradora.
   * Se usa al finalizar el pago en caja (Cobrar / Pagar).
   */
  async printReceipt(orderData: Order | any, printerId: string | null = null): Promise<any> {
    try {
      const payload = this._buildPayload(orderData, printerId);
      const response = await api.post(`${PRINTER_API_URL}/print/order/pos/`, payload);
      return response.data;
    } catch (error) {
      console.error('Error al imprimir ticket POS:', error);
      throw error;
    }
  }

  /**
   * Envía la comanda a la cocina (sin precios).
   */
  async printKitchenOrder(orderData: Order | any, destination: string = 'kitchen'): Promise<any> {
    try {
      const payload = {
        order_number: orderData.order_number || orderData.id || '',
        table_number: orderData.table_number || '',
        items:        this._normalizeItems(orderData.items || []),
        subtotal:     parseFloat(orderData.subtotal || 0),
        total:        parseFloat(orderData.total || 0),
        notes:        orderData.notes || '',
        printed_at:   new Date().toISOString(),
        destination:  destination,
      };
      const response = await api.post(`${PRINTER_API_URL}/print/order/kitchen/`, payload);
      return response.data;
    } catch (error) {
      console.error('Error al imprimir comanda de cocina:', error);
      throw error;
    }
  }

  /**
   * Imprime ticket POS + comanda de cocina simultáneamente.
   */
  async printBoth(orderData: Order | any, printerId: string | null = null): Promise<any> {
    try {
      const payload = this._buildPayload(orderData, printerId);
      const response = await api.post(`${PRINTER_API_URL}/print/order/both/`, payload);
      return response.data;
    } catch (error) {
      console.error('Error al imprimir ambos tickets:', error);
      throw error;
    }
  }

  /**
   * Abre la caja registradora manualmente.
   */
  async openCashDrawer(printerId: string | null = null): Promise<any> {
    try {
      const payload = printerId ? { printer_id: printerId } : {};
      const response = await api.post(`${PRINTER_API_URL}/open-drawer/`, payload);
      return response.data;
    } catch (error) {
      console.error('Error al abrir caja:', error);
      throw error;
    }
  }

  /**
   * Consulta el estado del sistema de impresión.
   */
  async getPrintStatus(): Promise<any> {
    try {
      const response = await api.get(`${PRINTER_API_URL}/status/`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener estado:', error);
      return null;
    }
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private _buildPayload(orderData: any, printerId: string | null = null): any {
    let customerName = 'CONSUMIDOR FINAL';
    if (orderData.customer_name && typeof orderData.customer_name === 'string') {
        customerName = orderData.customer_name;
    } else if (orderData.customer && typeof orderData.customer === 'object') {
        const first = orderData.customer.first_name || '';
        const last = orderData.customer.last_name || '';
        if (first || last) customerName = `${first} ${last}`.trim();
    } else if (typeof orderData.customer === 'string') {
        customerName = orderData.customer;
    }

    const payload: any = {
      order_number:  orderData.order_number  || orderData.id || '',
      table_number:  orderData.table_number  || 'N/A',
      customer_name: customerName,
      items:         this._normalizeItems(orderData.items || []),
      subtotal:      parseFloat(orderData.subtotal || 0),
      discount:      parseFloat(orderData.discount_amount || 0),
      total:         parseFloat(orderData.total || 0),
      notes:         orderData.notes || '',
      printed_at:    new Date().toISOString(),
    };

    // Incluir métodos de pago si existen
    if (orderData.payments_list && orderData.payments_list.length > 0) {
      payload.payments_list = orderData.payments_list;
    }

    if (printerId) payload.printer_id = printerId;
    return payload;
  }

  /**
   * Normaliza ítems del carrito o de la API de órdenes al formato esperado por el backend.
   */
  private _normalizeItems(items: any[]): any[] {
    return items.map(item => ({
      name:     item.name     || item.product_details?.name || 'Producto',
      quantity: item.quantity || 1,
      price:    parseFloat(item.price || item.unit_price || 0),
      total:    parseFloat(
        item.total     ||
        item.line_total ||
        ((item.price || item.unit_price || 0) * (item.quantity || 1))
      ),
      note: item.note || item.notes || '',
    }));
  }
}

export default new PrinterServiceRestaurant();
