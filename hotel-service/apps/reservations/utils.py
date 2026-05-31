import base64
import hashlib
from django.conf import settings

def encrypt_token(plain_text: str) -> str:
    """Encripta un token usando un cifrador de flujo derivado de settings.SECRET_KEY"""
    if not plain_text:
        return ""
    secret = settings.SECRET_KEY
    key = hashlib.sha256(secret.encode()).digest()
    encrypted_bytes = bytearray()
    for i, byte in enumerate(plain_text.encode('utf-8')):
        pad_byte = hashlib.sha256(key + str(i).encode()).digest()[0]
        encrypted_bytes.append(byte ^ pad_byte)
    return base64.b64encode(encrypted_bytes).decode('utf-8')

def decrypt_token(cipher_text: str) -> str:
    """Desencripta un token usando settings.SECRET_KEY"""
    if not cipher_text:
        return ""
    try:
        secret = settings.SECRET_KEY
        key = hashlib.sha256(secret.encode()).digest()
        encrypted_bytes = base64.b64decode(cipher_text.encode('utf-8'))
        decrypted_bytes = bytearray()
        for i, byte in enumerate(encrypted_bytes):
            pad_byte = hashlib.sha256(key + str(i).encode()).digest()[0]
            decrypted_bytes.append(byte ^ pad_byte)
        return decrypted_bytes.decode('utf-8')
    except Exception:
        return ""
