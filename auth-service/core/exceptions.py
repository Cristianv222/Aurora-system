from rest_framework.exceptions import APIException

class ServiceException(APIException):
    status_code = 500
    default_detail = 'Error interno del servicio.'
    default_code = 'service_error'
