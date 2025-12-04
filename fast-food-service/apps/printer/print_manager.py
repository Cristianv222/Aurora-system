import socket
import os
import logging
from escpos.printer import Network, Usb, Serial, Dummy
from escpos.exceptions import USBNotFoundError, Error
from django.utils import timezone

logger = logging.getLogger(__name__)


class PrinterManager:
    """Gestor centralizado de impresión"""
    
    # ✅ Constantes de configuración
    NETWORK_TIMEOUT = 3
    MAX_RETRY_ATTEMPTS = 2
    
    @staticmethod
    def get_printer_driver(printer):
        """
        Obtiene el driver de impresión según la configuración
        
        Args:
            printer: Objeto Printer del modelo
            
        Returns:
            Objeto escpos printer (Network, Usb, Serial, Dummy)
            
        Raises:
            ConnectionError: Si no puede conectar
            ValueError: Si tipo de conexión no es válido
        """
        try:
            if printer.connection_type == 'network':
                host = printer.connection_string
                port = printer.port or 9100
                
                # ✅ Verificar conexión antes de crear driver
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(PrinterManager.NETWORK_TIMEOUT)
                
                try:
                    result = sock.connect_ex((host, port))
                    if result != 0:
                        raise ConnectionError(
                            f"No se puede conectar a {host}:{port}. "
                            f"Verifique que la impresora esté encendida y conectada a la red."
                        )
                finally:
                    sock.close()
                
                # ✅ Crear driver de red
                return Network(
                    host=host, 
                    port=port,
                    timeout=PrinterManager.NETWORK_TIMEOUT
                )
            
            elif printer.connection_type == 'usb':
                # ✅ Mejorada: Intentar con parámetros específicos si existen
                config = printer.config or {}
                vendor_id = config.get('vendor_id')
                product_id = config.get('product_id')
                
                if vendor_id and product_id:
                    # IDs específicos (formato hex: 0x0000)
                    try:
                        vid = int(vendor_id, 16) if isinstance(vendor_id, str) else vendor_id
                        pid = int(product_id, 16) if isinstance(product_id, str) else product_id
                        return Usb(vid, pid)
                    except (ValueError, USBNotFoundError) as e:
                        logger.warning(f"No se pudo usar IDs específicos: {e}")
                        # Fallback a auto-detección
                
                # Auto-detección
                try:
                    return Usb()
                except USBNotFoundError:
                    raise ConnectionError(
                        "No se detectó ninguna impresora USB. "
                        "Verifique que esté conectada y tenga permisos."
                    )
            
            elif printer.connection_type == 'serial':
                devfile = printer.connection_string
                
                # ✅ Verificar que el dispositivo existe
                if not os.path.exists(devfile):
                    raise ConnectionError(
                        f"Dispositivo serial {devfile} no encontrado. "
                        f"Verifique la conexión."
                    )
                
                return Serial(devfile=devfile)
            
            elif printer.connection_type == 'bluetooth':
                # ✅ Bluetooth requiere configuración adicional
                logger.warning("Bluetooth no completamente implementado, usando Dummy")
                return Dummy()
            
            else:
                raise ValueError(
                    f"Tipo de conexión '{printer.connection_type}' no soportado"
                )
                
        except (ConnectionError, ValueError):
            # Re-lanzar errores conocidos
            raise
        except Exception as e:
            logger.error(f"Error inesperado al crear driver: {str(e)}")
            raise ConnectionError(f"Error al conectar con impresora: {str(e)}")
    
    @staticmethod
    def print_job(print_job):
        """
        Ejecuta un trabajo de impresión
        
        Args:
            print_job: Objeto PrintJob del modelo
            
        Returns:
            tuple: (success: bool, message: str)
        """
        escpos_printer = None
        
        try:
            # ✅ Marcar como imprimiendo
            if not print_job.mark_as_printing():
                return False, "El trabajo no está en estado pendiente"
            
            printer = print_job.printer
            
            # ✅ Verificar que la impresora esté activa
            if not printer.is_active:
                raise ValueError("La impresora está desactivada")
            
            # ✅ Obtener driver con retry
            last_error = None
            for attempt in range(PrinterManager.MAX_RETRY_ATTEMPTS):
                try:
                    escpos_printer = PrinterManager.get_printer_driver(printer)
                    break
                except ConnectionError as e:
                    last_error = e
                    if attempt < PrinterManager.MAX_RETRY_ATTEMPTS - 1:
                        logger.warning(f"Reintento {attempt + 1}/{PrinterManager.MAX_RETRY_ATTEMPTS}")
                        continue
                    else:
                        raise
            
            # ✅ Configurar según tipo de impresora
            if printer.printer_type == 'thermal':
                escpos_printer.set(align='left', font='a', width=1, height=1)
            
            # 🖼️ IMPRIMIR LOGO (si existe en los datos)
            logo_path = print_job.data.get('logo_path')
            if logo_path and os.path.exists(logo_path):
                try:
                    # Centrar logo
                    escpos_printer.set(align='center')
                    # Imprimir imagen
                    escpos_printer.image(logo_path)
                    # Espacio después del logo
                    escpos_printer.text("\n")
                    # Volver a alineación izquierda
                    escpos_printer.set(align='left')
                    
                    logger.info(f"Logo impreso: {logo_path}")
                except Exception as e:
                    logger.warning(f"No se pudo imprimir logo: {e}")
                    # Continuar sin logo si hay error
            
            # ✅ Abrir caja registradora si está configurado
            if print_job.open_cash_drawer and printer.has_cash_drawer:
                PrinterManager._handle_cash_drawer(
                    escpos_printer, 
                    printer, 
                    print_job
                )
            
            # ✅ Imprimir contenido
            content = print_job.content
            
            # Validar que hay contenido
            if not content or not content.strip():
                raise ValueError("El contenido de impresión está vacío")
            
            # Imprimir múltiples copias
            for copy_num in range(print_job.copies):
                escpos_printer.text(content)
                
                # Separador entre copias (excepto la última)
                if copy_num < print_job.copies - 1:
                    escpos_printer.text("\n\n" + "=" * 40 + "\n\n")
            
            # ✅ Cortar papel (solo térmicas)
            if printer.printer_type == 'thermal':
                try:
                    escpos_printer.cut()
                except Exception as e:
                    logger.warning(f"No se pudo cortar papel: {e}")
                    # No es crítico, continuar
            
            # ✅ Marcar como completado
            print_job.mark_as_completed()
            
            logger.info(
                f"Impresión completada: Job {print_job.job_number}, "
                f"Impresora: {printer.name}, Copias: {print_job.copies}"
            )
            
            return True, "Impresión completada exitosamente"
            
        except ConnectionError as e:
            error_msg = f"Error de conexión: {str(e)}"
            logger.error(error_msg)
            print_job.mark_as_failed(error_msg)
            return False, error_msg
            
        except ValueError as e:
            error_msg = f"Error de validación: {str(e)}"
            logger.error(error_msg)
            print_job.mark_as_failed(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"Error inesperado en impresión: {str(e)}"
            logger.error(error_msg, exc_info=True)
            print_job.mark_as_failed(error_msg)
            return False, error_msg
            
        finally:
            # ✅ CRÍTICO: Siempre cerrar la conexión
            if escpos_printer:
                try:
                    escpos_printer.close()
                except Exception as e:
                    logger.warning(f"Error al cerrar conexión: {e}")
    
    @staticmethod
    def _handle_cash_drawer(escpos_printer, printer, print_job):
        """
        Maneja la apertura de caja registradora
        
        Args:
            escpos_printer: Driver de la impresora
            printer: Objeto Printer del modelo
            print_job: Objeto PrintJob del modelo
        """
        # ✅ Importar aquí para evitar circular imports
        from .models import CashDrawerEvent
        
        try:
            # Enviar comando de apertura
            escpos_printer.cashdraw(
                pin=printer.cash_drawer_pin,
                time_on=printer.cash_drawer_on_time,
                time_off=printer.cash_drawer_off_time
            )
            
            # Marcar como abierta
            print_job.cash_drawer_opened = True
            print_job.save(update_fields=['cash_drawer_opened'])
            
            # Registrar evento exitoso
            CashDrawerEvent.objects.create(
                printer=printer,
                print_job=print_job,
                event_type='print',
                success=True,
                notes='Caja abierta durante impresión',
                triggered_by=print_job.created_by or 'system'
            )
            
            logger.info(f"Caja registradora abierta: {printer.name}")
            
        except Exception as e:
            # ✅ Registrar fallo pero no detener impresión
            logger.error(f"Error al abrir caja registradora: {str(e)}")
            
            CashDrawerEvent.objects.create(
                printer=printer,
                print_job=print_job,
                event_type='print',
                success=False,
                notes=f'Error: {str(e)}',
                triggered_by=print_job.created_by or 'system'
            )
    
    @staticmethod
    def open_cash_drawer(printer):
        """
        Abre la caja registradora directamente (sin imprimir)
        
        Args:
            printer: Objeto Printer del modelo
            
        Returns:
            tuple: (success: bool, message: str)
        """
        escpos_printer = None
        
        try:
            if not printer.has_cash_drawer:
                return False, "Esta impresora no tiene caja registradora configurada"
            
            if not printer.is_active:
                return False, "La impresora está desactivada"
            
            # Obtener driver
            escpos_printer = PrinterManager.get_printer_driver(printer)
            
            # Enviar comando de apertura
            escpos_printer.cashdraw(
                pin=printer.cash_drawer_pin,
                time_on=printer.cash_drawer_on_time,
                time_off=printer.cash_drawer_off_time
            )
            
            logger.info(f"Caja registradora abierta manualmente: {printer.name}")
            
            return True, "Caja registradora abierta exitosamente"
            
        except ConnectionError as e:
            error_msg = f"Error de conexión: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"Error al abrir caja: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
            
        finally:
            # ✅ CRÍTICO: Siempre cerrar la conexión
            if escpos_printer:
                try:
                    escpos_printer.close()
                except Exception as e:
                    logger.warning(f"Error al cerrar conexión: {e}")
    
    @staticmethod
    def test_connection(connection_type, connection_string, port=None):
        """
        Prueba de conexión a impresora (antes de guardarla)
        
        Args:
            connection_type: Tipo de conexión ('network', 'usb', 'serial', 'bluetooth')
            connection_string: String de conexión (IP, ruta, etc.)
            port: Puerto de red (opcional)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            if connection_type == 'network':
                host = connection_string
                port = port or 9100
                
                # ✅ Validar formato de IP
                try:
                    socket.inet_aton(host)
                except socket.error:
                    return False, f"IP inválida: {host}"
                
                # ✅ Validar puerto
                if not (1 <= port <= 65535):
                    return False, f"Puerto inválido: {port}"
                
                # Intentar conectar
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(PrinterManager.NETWORK_TIMEOUT)
                
                try:
                    result = sock.connect_ex((host, port))
                    
                    if result == 0:
                        return True, f"✅ Conexión exitosa a {host}:{port}"
                    else:
                        return False, f"❌ No se puede conectar a {host}:{port}"
                finally:
                    sock.close()
            
            elif connection_type == 'usb':
                # ✅ Mejorado: Verificar permisos y disponibilidad
                try:
                    # Intentar listar dispositivos USB
                    test_printer = Usb()
                    test_printer.close()
                    return True, "✅ Dispositivos USB disponibles"
                    
                except USBNotFoundError:
                    return False, "❌ No se detectaron impresoras USB conectadas"
                    
                except Exception as e:
                    # Puede ser problema de permisos
                    if "permission" in str(e).lower():
                        return False, (
                            "❌ Sin permisos para acceder a USB. "
                            "En Linux, ejecute: sudo usermod -a -G lp $USER"
                        )
                    return False, f"❌ Error USB: {str(e)}"
            
            elif connection_type == 'serial':
                devfile = connection_string
                
                # Verificar que existe
                if not os.path.exists(devfile):
                    return False, f"❌ Dispositivo {devfile} no encontrado"
                
                # Verificar permisos
                if not os.access(devfile, os.R_OK | os.W_OK):
                    return False, f"❌ Sin permisos de lectura/escritura en {devfile}"
                
                return True, f"✅ Dispositivo serial {devfile} disponible"
            
            elif connection_type == 'bluetooth':
                # ✅ Bluetooth requiere implementación específica
                return True, "⚠️ Bluetooth aceptado (configuración manual requerida)"
            
            else:
                return False, f"❌ Tipo de conexión '{connection_type}' no soportado"
            
        except Exception as e:
            logger.error(f"Error en test_connection: {str(e)}", exc_info=True)
            return False, f"❌ Error en prueba: {str(e)}"
    
    @staticmethod
    def check_connection(printer):
        """
        Verifica el estado actual de conexión de una impresora
        
        Args:
            printer: Objeto Printer del modelo
            
        Returns:
            str: Estado ('online', 'offline', 'configured', 'error')
        """
        try:
            if not printer.is_active:
                return 'offline'
            
            if printer.connection_type == 'network':
                host = printer.connection_string
                port = printer.port or 9100
                
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                
                try:
                    result = sock.connect_ex((host, port))
                    return 'online' if result == 0 else 'offline'
                finally:
                    sock.close()
            
            elif printer.connection_type == 'usb':
                # Para USB, intentar detectar dispositivos
                try:
                    # Esto es rápido y no interrumpe
                    test = Usb()
                    test.close()
                    return 'online'
                except USBNotFoundError:
                    return 'offline'
                except:
                    return 'configured'
            
            elif printer.connection_type == 'serial':
                # Verificar que el dispositivo existe
                if os.path.exists(printer.connection_string):
                    return 'configured'
                return 'offline'
            
            else:
                return 'configured'
                
        except Exception as e:
            logger.warning(f"Error al verificar conexión de {printer.name}: {e}")
            return 'error'
    
    @staticmethod
    def print_test_page(printer, user='system'):
        """
        Imprime una página de prueba simple
        
        Args:
            printer: Objeto Printer del modelo
            user: Usuario que solicita la prueba
            
        Returns:
            tuple: (success: bool, message: str)
        """
        # ✅ Importar aquí para evitar circular imports
        from .models import PrintJob
        
        # Generar contenido de prueba
        test_content = f"""
{'=' * 42}
      PÁGINA DE PRUEBA
{'=' * 42}

Impresora: {printer.name}
Tipo: {printer.get_printer_type_display()}
Conexión: {printer.get_connection_type_display()}

Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
Solicitado por: {user}

{'=' * 42}
Esta es una prueba de impresión.
Si puede leer esto, la impresora
funciona correctamente.
{'=' * 42}


"""
        
        try:
            # Crear trabajo de impresión
            print_job = PrintJob.objects.create(
                printer=printer,
                document_type='other',
                content=test_content,
                data={'test': True, 'user': user},
                created_by=user,
                status='pending'
            )
            
            # Ejecutar impresión
            return PrinterManager.print_job(print_job)
            
        except Exception as e:
            error_msg = f"Error al crear trabajo de prueba: {str(e)}"
            logger.error(error_msg)
            return False, error_msg