import logging
from cryptography.fernet import Fernet, InvalidToken

_LOGGER = logging.getLogger(__name__)

class SecurityService:
    def __init__(self, key: str | None):
        self._fernet = None
        if not key:
            # Dev-режим без ключа: шифрування вимкнене, але голосно попереджаємо.
            _LOGGER.warning(
                "ENCRYPTION_KEY не заданий — mono-токени зберігатимуться у plain text. "
                "Для production обов'язково задайте Fernet-ключ."
            )
            return
        try:
            self._fernet = Fernet(key.encode('utf-8'))
        except Exception as e:
            # Ключ заданий, але некоректний — це критична помилка конфігурації.
            # Раніше ми тихо падали у plain-text fallback, що саботувало security.
            raise RuntimeError(
                f"Недійсний ENCRYPTION_KEY: {e}. "
                "Згенеруйте коректний ключ: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            ) from e

    def encrypt_token(self, token: str) -> str:
        """Encrypt a plain text token."""
        if not self._fernet or not token:
            return token  # Fallback: if no key is configured, return plain string
        try:
            return self._fernet.encrypt(token.encode('utf-8')).decode('utf-8')
        except Exception as e:
            _LOGGER.error("Encryption failed: %s", e)
            return token

    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt a fernet token."""
        if not self._fernet or not encrypted_token:
            return encrypted_token
        # Fernet tokens start with gAAAAA
        if not encrypted_token.startswith("gAAAAA"):
            return encrypted_token # Probably already plain text
        try:
            return self._fernet.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
        except InvalidToken:
            _LOGGER.error("Invalid token during decryption")
            return encrypted_token
        except Exception as e:
            _LOGGER.error("Decryption failed: %s", e)
            return encrypted_token

from bot import config
security_service = SecurityService(config.ENCRYPTION_KEY)
