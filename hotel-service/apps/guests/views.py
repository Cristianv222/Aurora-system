from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import IsJWTAuthenticated
from .models import Guest
from .serializers import GuestSerializer

class GuestViewSet(viewsets.ModelViewSet):
    queryset = Guest.objects.all()
    serializer_class = GuestSerializer
    permission_classes = [IsJWTAuthenticated]

    @action(detail=False, methods=['get'], url_path='by-id')
    def get_by_id(self, request):
        """Busca un huésped por su número de identificación"""
        identification = request.query_params.get('identification', '')
        if not identification:
            return Response({'error': 'Parámetro identification es requerido'}, status=400)
        
        try:
            guest = Guest.objects.get(identification=identification)
            serializer = self.get_serializer(guest)
            return Response(serializer.data)
        except Guest.DoesNotExist:
            return Response({'error': 'Huésped no encontrado'}, status=404)
