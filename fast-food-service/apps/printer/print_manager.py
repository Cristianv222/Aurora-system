import socket
import os
from escpos.printer import Network, Usb, Serial, Dummy
from escpos.exceptions import USBNotFoundError, Error
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class PrinterManager:
    """Gestor centralizado de impresión sin templates"""
    
    @staticmethod
    def get_printer_driver(printer):
        """Obtiene el driver de impresión según la configuración"""
        try:
            if printer.connection_type == 'network':
                host = printer.connection_string
                port = printer.port or 9100
                
                # Verificar conexión
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                result = sock.connect_ex((host, port))
                sock.close()
                
                if result != 0:
                    raise ConnectionError(f"No se puede conectar a {host}:{port}")
                
                return Network(host=host, port=port)
            
            elif printer.connection_type == 'usb':
                # Para USB, usar auto-detección
                return Usb()
            
            elif printer.connection_type == 'serial':
                return Serial(devfile=printer.connection_string)
            
            elif printer.connection_type == 'bluetooth':
                # Para Bluetooth (requiere configuración adicional)
                return Dummy()  # Por ahora, dummy
            
            else:
                # Impresora dummy para pruebas
                return Dummy()
                
        except Exception as e:
            logger.error(f"Error al crear driver: {str(e)}")
            raise
    
    @staticmethod
    def print_job(print_job):
        """Ejecuta un trabajo de impresión"""
        try:
            # Marcar como imprimiendo
            if not print_job.mark_as_printing():
                return False, "El trabajo no está pendiente"
            
            printer = print_job.printer
            
            # Obtener driver
            escpos_printer = PrinterManager.get_printer_driver(printer)
            
            # Configurar según tipo de impresora
            if printer.printer_type == 'thermal':
                escpos_printer.set(align='left')
                escpos_printer.set(font='a')
                escpos_printer.set(width=1, height=1)
            
            # Abrir caja si está configurado
            if print_job.open_cash_drawer and printer.has_cash_drawer:
                try:
                    escpos_printer.cashdraw(printer.cash_drawer_pin)
                    print_job.cash_drawer_opened = True
                    print_job.save()
                    
                    # Importar aquí para evitar circular import
                    from .models import CashDrawerEvent
                    CashDrawerEvent.objects.create(
                        printer=printer,
                        print_job=print_job,
                        event_type='print',
                        success=True,
                        triggered_by=print_job.created_by or 'system'
                    )
                except Exception as e:
                    logger.error(f"Error al abrir caja: {str(e)}")
                    from .models import CashDrawerEvent
                    CashDrawerEvent.objects.create(
                        printer=printer,
                        print_job=print_job,
                        event_type='print',
                        success=False,
                        notes=str(e),
                        triggered_by=print_job.created_by or 'system'
                    )
            
            # Imprimir contenido
            content = print_job.content
            
            # Imprimir múltiples copias
            for i in range(print_job.copies):
                escpos_printer.text(content)
                
                if i < print_job.copies - 1:
                    escpos_printer.text("\n\n")  # Separar copias
            
            # Cortar papel (si es térmica y tiene corte)
            if printer.printer_type == 'thermal':
                escpos_printer.cut()
            
            # Cerrar conexión
            escpos_printer.close()
            
            # Marcar como completado
            print_job.mark_as_completed()
            
            return True, "Impresión completada"
            
        except Exception as e:
            logger.error(f"Error en impresión: {str(e)}")
            print_job.mark_as_failed(str(e))
            return False, str(e)
    
    @staticmethod
    def open_cash_drawer(printer):
        """Abre la caja registradora"""
        try:
            if not printer.has_cash_drawer:
                return False, "La impresora no tiene caja registradora"
            
            escpos_printer = PrinterManager.get_printer_driver(printer)
            
            # Enviar comando para abrir caja
            escpos_printer.cashdraw(printer.cash_drawer_pin)
            escpos_printer.close()
            
            return True, "Caja abierta exitosamente"
            
        except Exception as e:
            logger.error(f"Error al abrir caja: {str(e)}")
            return False, str(e)
    
    @staticmethod
    def test_connection(connection_type, connection_string, port=None):
        """Prueba de conexión a impresora"""
        try:
            if connection_type == 'network':
                host = connection_string
                port = port or 9100
                
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(3)
                result = sock.connect_ex((host, port))
                sock.close()
                
                if result == 0:
                    return True, f"Conexión exitosa a {host}:{port}"
                else:
                    return False, f"No se puede conectar a {host}:{port}"
            
            elif connection_type == 'usb':
                # Probar USB
                import subprocess
                
                if os.path.exists('/dev/usb'):
                    devices = os.listdir('/dev/usb')
                    if devices:
                        return True, f"Dispositivos USB encontrados: {devices}"
                
                # En Windows
                import platform
                if platform.system() == 'Windows':
                    # Intentar listar dispositivos USB
                    try:
                        import usb.core
                        devices = usb.core.find(find_all=True)
                        if devices:
                            return True, f"Dispositivos USB detectados: {len(list(devices))}"
                    except:
                        return True, "Sistema Windows (USB disponible)"
                
                return False, "No se detectaron dispositivos USB"
            
            return True, "Configuración aceptada"
            
        except Exception as e:
            return False, f"Error en prueba: {str(e)}"
    
    @staticmethod
    def check_connection(printer):
        """Verifica el estado de conexión de una impresora"""
        try:
            if printer.connection_type == 'network':
                host = printer.connection_string
                port = printer.port or 9100
                
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                result = sock.connect_ex((host, port))
                sock.close()
                
                return 'online' if result == 0 else 'offline'
            
            elif printer.connection_type == 'usb':
                # Para USB, asumimos que está bien si está activa
                return 'configured' if printer.is_active else 'offline'
            
            else:
                return 'configured'
                
        except:
            return 'error'
    
    @staticmethod
    def print_receipt(printer, data):
        """Método directo para imprimir tickets"""
        from .models import PrintJob
        
        # Generar contenido simple
        content = f"""
TICKET DE VENTA
================
Total: ${data.get('total', 0):.2f}
Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M')}
================
"""
        
        # Crear y ejecutar trabajo
        print_job = PrintJob.objects.create(
            printer=printer,
            document_type='receipt',
            content=content,
            data=data,
            open_cash_drawer=True,
            created_by='system'
        )
        
        return PrinterManager.print_job(print_job)