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
        """Encrypt a plain text token.

        If no Fernet key is configured (dev only), returns plaintext — caller
        was warned at construction. If a key IS configured, encryption errors
        are fatal (we never silently store plaintext when crypto is expected).
        """
        if not token:
            return token
        if not self._fernet:
            return token
        return self._fernet.encrypt(token.encode('utf-8')).decode('utf-8')

    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt a fernet token.

        Legacy plaintext rows (not starting with gAAAAA) are returned as-is for
        backwards compat. Fernet rows with bad signatures raise — we don't want
        to silently leak garbage to callers.
        """
        if not self._fernet or not encrypted_token:
            return encrypted_token
        if not encrypted_token.startswith("gAAAAA"):
            return encrypted_token  # legacy plaintext, pre-encryption rollout
        try:
            return self._fernet.decrypt(encrypted_token.encode('utf-8')).decode('utf-8')
        except InvalidToken as e:
            _LOGGER.error("Invalid Fernet token during decryption")
            raise RuntimeError("Не вдалося розшифрувати mono-токен") from e

from bot import config
security_service = SecurityService(config.ENCRYPTION_KEY)
