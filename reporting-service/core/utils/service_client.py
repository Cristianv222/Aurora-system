import requests
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class ServiceClient:
    """
    Cliente para hacer peticiones HTTP a otros servicios
    """
    
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
    
    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        token: Optional[str] = None,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[Any, Any]:
        """
        Hacer petición HTTP a otro servicio
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
                timeout=self.timeout
            )
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.Timeout:
            logger.error(f"Timeout al conectar con {url}")
            raise Exception(f"Servicio no disponible: timeout")
        
        except requests.exceptions.HTTPError as e:
            logger.error(f"Error HTTP {e.response.status_code}: {url}")
            raise Exception(f"Error del servicio: {e.response.status_code}")
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error al conectar con {url}: {str(e)}")
            raise Exception(f"Error de conexión con el servicio")
        
        except Exception as e:
            logger.error(f"Error inesperado: {str(e)}")
            raise
    
    def get(self, endpoint: str, token: Optional[str] = None, params: Optional[Dict] = None):
        return self._make_request('GET', endpoint, token=token, params=params)
    
    def post(self, endpoint: str, data: Dict, token: Optional[str] = None):
        return self._make_request('POST', endpoint, token=token, data=data)
    
    def put(self, endpoint: str, data: Dict, token: Optional[str] = None):
        return self._make_request('PUT', endpoint, token=token, data=data)
    
    def patch(self, endpoint: str, data: Dict, token: Optional[str] = None):
        return self._make_request('PATCH', endpoint, token=token, data=data)
    
    def delete(self, endpoint: str, token: Optional[str] = None):
        return self._make_request('DELETE', endpoint, token=token)


# Clientes pre-configurados
class AuthServiceClient(ServiceClient):
    """Cliente para auth-service"""
    pass


class FastFoodServiceClient(ServiceClient):
    """Cliente para fast-food-service"""
    pass


class RestaurantServiceClient(ServiceClient):
    """Cliente para restaurant-service"""
    pass


class ReportingServiceClient(ServiceClient):
    """Cliente para reporting-service"""
    pass