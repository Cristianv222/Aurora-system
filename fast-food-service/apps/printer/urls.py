from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'printers', views.PrinterViewSet, basename='printer')
router.register(r'jobs', views.PrintJobViewSet, basename='job')
router.register(r'cash-drawer-events', views.CashDrawerEventViewSet, basename='cashdrawerevent')

urlpatterns = [
    path('', include(router.urls)),
    path('print/', views.PrintAPIView.as_view(), name='print'),
    path('print/receipt/', views.PrintReceiptView.as_view(), name='print-receipt'),
    path('print/invoice/', views.PrintInvoiceView.as_view(), name='print-invoice'),
    path('print/open-cash-drawer/', views.open_cash_drawer, name='open-cash-drawer'),
    path('print/settings/', views.PrinterSettingsView.as_view(), name='print-settings'),
    path('print/status/', views.print_status, name='print-status'),
]