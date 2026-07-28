from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


class TokenEncryptor:
    """Encrypts/decrypts OAuth tokens at rest using Fernet (AES-128-CBC + HMAC)."""

    def __init__(self, key: str) -> None:
        if not key:
            raise ValueError(
                "ENCRYPTION_KEY is not set. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\""
            )
        self._fernet = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken as exc:
            raise ValueError("Unable to decrypt token - key mismatch or corrupted data") from exc


@lru_cache
def get_encryptor() -> TokenEncryptor:
    return TokenEncryptor(get_settings().encryption_key)
