"""
apps/pos/report_utils.py

Utilidades para generar reportes de ventas.
"""

from django.db.models import Sum, Count, Avg, Q, F
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta, date
from decimal import Decimal
import calendar


class ReportGenerator:
    """Clase para generar diferentes tipos de reportes"""
    
    @staticmethod
    def generate_daily_report(target_date=None, generated_by='system'):
        """
        Genera reporte detallado para un día específico.
        
        Args:
            target_date: datetime.date - Fecha del reporte (hoy si es None)
            generated_by: str - User ID de quien genera el reporte
            
        Returns:
            SalesReport instance
        """
        if target_date is None:
            target_date = timezone.now().date()
        
        from apps.orders.models import Order
        from apps.payments.models import Payment
        from .models import SalesReport, TopProductsReport, SalesByHour
        
        # ============ 1. CREAR O ACTUALIZAR REPORTE PRINCIPAL ============
        report, created = SalesReport.objects.get_or_create(
            report_type='daily',
            start_date=target_date,
            end_date=target_date,
            defaults={
                'period_name': target_date.strftime('%d/%m/%Y'),
                'generated_by': generated_by
            }
        )
        
        # ============ 2. CONSULTAR ÓRDENES DEL DÍA ============
        orders = Order.objects.filter(
            created_at__date=target_date,
            status__in=['delivered', 'completed']
        ).prefetch_related('items__product')
        
        # ============ 3. CALCULAR ESTADÍSTICAS GENERALES ============
        report.total_orders = orders.count()
        report.total_sales = orders.aggregate(
            total=Sum('total')
        )['total'] or Decimal('0')
        
        # Productos vendidos
        total_items = 0
        for order in orders:
            total_items += order.items.count()
        report.total_items_sold = total_items
        
        # ============ 4. POR TIPO DE ORDEN ============
        report.dine_in_sales = orders.filter(
            order_type='dine_in'
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        
        report.takeout_sales = orders.filter(
            order_type='takeout'
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        
        report.delivery_sales = orders.filter(
            order_type='delivery'
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        
        # ============ 5. DESCUENTOS Y PROPINAS ============
        report.total_discounts = orders.aggregate(
            total=Sum('discount_amount')
        )['total'] or Decimal('0')
        
        report.total_tips = orders.aggregate(
            total=Sum('tip_amount')
        )['total'] or Decimal('0')
        
        # ============ 6. CONSULTAR PAGOS DEL DÍA ============
        payments = Payment.objects.filter(
            created_at__date=target_date,
            status='completed'
        )
        
        report.cash_sales = payments.filter(
            payment_method__method_type='cash'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        report.card_sales = payments.filter(
            payment_method__method_type__in=['credit_card', 'debit_card']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        report.other_sales = payments.exclude(
            payment_method__method_type__in=['cash', 'credit_card', 'debit_card']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # ============ 7. CALCULAR PROMEDIOS ============
        if report.total_orders > 0:
            report.average_order_value = report.total_sales / report.total_orders
            report.average_items_per_order = report.total_items_sold / report.total_orders
        else:
            report.average_order_value = Decimal('0')
            report.average_items_per_order = Decimal('0')
        
        report.generated_by = generated_by
        report.save()
        
        # ============ 8. GENERAR TOP PRODUCTOS ============
        ReportGenerator._generate_top_products(report, orders)
        
        # ============ 9. GENERAR VENTAS POR HORA ============
        ReportGenerator._generate_sales_by_hour(report, target_date)
        
        return report
    @staticmethod
    def _generate_top_products(report, orders):
        """Genera ranking de productos más vendidos"""
        from apps.orders.models import OrderItem
    
        # Obtener todos los items de las órdenes
        order_ids = orders.values_list('id', flat=True)
        order_items = OrderItem.objects.filter(order__id__in=order_ids)
    
        # Agrupar por producto usando aggregate de Django
        from django.db.models import Sum, Avg, F
        from decimal import Decimal
    
        product_stats = order_items.values(
            'product__id',
            'product__name',
            'product__category__name'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_amount=Sum(F('price') * F('quantity'), output_field=models.DecimalField()),
            avg_price=Avg('price')
        ).order_by('-total_quantity')
    
         #Crear registros con ranking
        TopProductsReport.objects.filter(sales_report=report).delete()
    
        for idx, stats in enumerate(product_stats[:20]):
            TopProductsReport.objects.create(
                sales_report=report,
                product_id=stats['product__id'],
                product_name=stats['product__name'],
                category_name=stats['product__category__name'] or 'Sin Categoría',
                quantity_sold=stats['total_quantity'],
                total_amount=stats['total_amount'] or Decimal('0'),
                average_price=stats['avg_price'] or Decimal('0'),
                rank_by_quantity=idx + 1,
                rank_by_amount=idx + 1
            )
    @staticmethod
    def _generate_sales_by_hour(report, target_date):
        """Genera ventas agrupadas por hora"""
        from .models import SalesByHour
        from apps.orders.models import Order
        
        SalesByHour.objects.filter(sales_report=report).delete()
        
        # Consultar órdenes por hora
        for hour in range(24):
            hour_start = timezone.make_aware(datetime.combine(target_date, datetime.min.time()))
            hour_start = hour_start.replace(hour=hour)
            hour_end = hour_start + timedelta(hours=1)
            
            orders_in_hour = Order.objects.filter(
                created_at__gte=hour_start,
                created_at__lt=hour_end,
                status__in=['delivered', 'completed']
            )
            
            total_sales = orders_in_hour.aggregate(
                total=Sum('total')
            )['total'] or Decimal('0')
            
            total_orders = orders_in_hour.count()
            
            total_items = 0
            for order in orders_in_hour:
                total_items += order.items.count()
            
            average_order_value = total_sales / total_orders if total_orders > 0 else Decimal('0')
            
            SalesByHour.objects.create(
                sales_report=report,
                hour=hour,
                hour_label=f'{hour:02d}:00',
                total_sales=total_sales,
                total_orders=total_orders,
                total_items=total_items,
                average_order_value=average_order_value
            )
    
    @staticmethod
    def generate_weekly_report(start_date=None, generated_by='system'):
        """Genera reporte semanal"""
        if start_date is None:
            start_date = timezone.now().date() - timedelta(days=timezone.now().weekday())
        
        end_date = start_date + timedelta(days=6)
        
        # Obtener reportes diarios de la semana
        daily_reports = SalesReport.objects.filter(
            report_type='daily',
            start_date__gte=start_date,
            end_date__lte=end_date
        )
        
        # Crear reporte semanal
        weekly_report, created = SalesReport.objects.get_or_create(
            report_type='weekly',
            start_date=start_date,
            end_date=end_date,
            defaults={
                'period_name': f'Semana {start_date.strftime("%d/%m")} - {end_date.strftime("%d/%m/%Y")}',
                'generated_by': generated_by
            }
        )
        
        # Consolidar datos
        if daily_reports.exists():
            weekly_report.total_sales = daily_reports.aggregate(
                total=Sum('total_sales')
            )['total'] or Decimal('0')
            
            weekly_report.total_orders = daily_reports.aggregate(
                total=Sum('total_orders')
            )['total'] or 0
            
            weekly_report.total_items_sold = daily_reports.aggregate(
                total=Sum('total_items_sold')
            )['total'] or 0
            
            weekly_report.save()
        
        return weekly_report
    
    @staticmethod
    def generate_monthly_report(year=None, month=None, generated_by='system'):
        """Genera reporte mensual"""
        now = timezone.now()
        if year is None:
            year = now.year
        if month is None:
            month = now.month
        
        start_date = date(year, month, 1)
        _, last_day = calendar.monthrange(year, month)
        end_date = date(year, month, last_day)
        
        # Obtener reportes diarios del mes
        daily_reports = SalesReport.objects.filter(
            report_type='daily',
            start_date__gte=start_date,
            end_date__lte=end_date
        )
        
        # Crear reporte mensual
        monthly_report, created = SalesReport.objects.get_or_create(
            report_type='monthly',
            start_date=start_date,
            end_date=end_date,
            defaults={
                'period_name': f'{calendar.month_name[month]} {year}',
                'generated_by': generated_by
            }
        )
        
        # Consolidar datos
        if daily_reports.exists():
            monthly_report.total_sales = daily_reports.aggregate(
                total=Sum('total_sales')
            )['total'] or Decimal('0')
            
            monthly_report.total_orders = daily_reports.aggregate(
                total=Sum('total_orders')
            )['total'] or 0
            
            monthly_report.total_items_sold = daily_reports.aggregate(
                total=Sum('total_items_sold')
            )['total'] or 0
            
            monthly_report.save()
        
        return monthly_report
    
    @staticmethod
    def generate_shift_report(target_date=None):
        """Genera reporte consolidado de turnos por día"""
        if target_date is None:
            target_date = timezone.now().date()
        
        from .models import Shift, ShiftReport
        
        # Consultar turnos del día
        shifts = Shift.objects.filter(opened_at__date=target_date)
        
        # Crear reporte
        report, created = ShiftReport.objects.get_or_create(
            date=target_date,
            defaults={
                'total_shifts': shifts.count(),
                'open_shifts': shifts.filter(status='open').count(),
                'closed_shifts': shifts.filter(status='closed').count(),
            }
        )
        
        # Calcular ventas por turno
        closed_shifts = shifts.filter(status='closed')
        if closed_shifts.exists():
            report.total_sales = closed_shifts.aggregate(
                total=Sum('total_sales')
            )['total'] or Decimal('0')
            
            report.average_sales_per_shift = report.total_sales / closed_shifts.count()
            
            report.total_cash_difference = closed_shifts.aggregate(
                total=Sum('cash_difference')
            )['total'] or Decimal('0')
            
            report.shifts_with_difference = closed_shifts.filter(
                cash_difference__gt=0
            ).count()
        
        # Empleados únicos
        report.total_employees = shifts.values('user_id').distinct().count()
        
        report.save()
        
        return report
    
    @staticmethod
    def close_day(target_date=None, generated_by='system'):
        """
        Cierra el día de operaciones.
        Genera reporte final y marca como cerrado.
        
        Args:
            target_date: datetime.date - Fecha a cerrar
            generated_by: str - User ID de quien cierra
            
        Returns:
            dict: Resultado del cierre
        """
        if target_date is None:
            target_date = timezone.now().date()
        
        # Generar reporte diario final
        report = ReportGenerator.generate_daily_report(target_date, generated_by)
        report.is_final = True
        report.notes = f'Cierre de día {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}'
        report.save()
        
        # Generar reporte de turnos
        shift_report = ReportGenerator.generate_shift_report(target_date)
        
        # Cerrar todos los turnos abiertos
        from .models import Shift
        open_shifts = Shift.objects.filter(status='open', opened_at__date=target_date)
        
        closed_shifts = []
        for shift in open_shifts:
            # Cerrar turno con cierre forzado
            success, message = shift.close_shift(
                closing_cash=Decimal('0'),  # Se debe especificar el efectivo final
                closing_notes='Cierre automático por cierre de día'
            )
            if success:
                closed_shifts.append(shift.shift_number)
        
        return {
            'success': True,
            'message': f'Día {target_date} cerrado exitosamente',
            'sales_report_id': str(report.id),
            'shift_report_id': str(shift_report.id),
            'closed_shifts': closed_shifts,
            'total_sales': float(report.total_sales),
            'total_orders': report.total_orders,
            'total_items_sold': report.total_items_sold,
            'cash_sales': float(report.cash_sales),
            'card_sales': float(report.card_sales),
            'other_sales': float(report.other_sales),
            'total_discounts': float(report.total_discounts),
            'total_tips': float(report.total_tips),
        }