// src/services/printerService.ts
import api from './api';
import { Order } from '../types';

const PRINTER_API_URL = `${import.meta.env.VITE_FAST_FOOD_SERVICE}/api/hardware`;

class PrinterService {
  async printReceipt(orderData: Order | any, printerId: string | null = null): Promise<any> {
    try {
      const response = await api.post(`${PRINTER_API_URL}/print/receipt/`, {
        order: orderData,
        printer_id: printerId
      });
      return response.data;
    } catch (error) {
      console.error('Error al imprimir ticket:', error);
      throw error;
    }
  }

  async openCashDrawer(printerId: string | null = null): Promise<any> {
    try {
      const response = await api.post(`${PRINTER_API_URL}/open-drawer/`, {
        printer_id: printerId
      });
      return response.data;
    } catch (error) {
      console.error('Error al abrir caja:', error);
      throw error;
    }
  }

  async getPrintStatus(): Promise<any> {
    try {
      const response = await api.get(`${PRINTER_API_URL}/status/`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener estado:', error);
      return null;
    }
  }
}

export default new PrinterService();
