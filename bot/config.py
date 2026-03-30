import hashlib
import os
import re
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()


def _req(name: str) -> str:
    v = os.environ.get(name, "").strip()
    return v


def _telegram_safe_webhook_secret(raw: str) -> str:
    """Telegram API: secret_token только A–Z, a–z, 0–9, _ и - (до 256 символов).
    Render generateValue и др. часто дают другие символы — приводим к допустимому виду.
    """
    if not raw:
        return ""
    s = raw.strip()
    if len(s) <= 256 and re.fullmatch(r"[A-Za-z0-9_-]+", s):
        return s
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:64]


def validate_webhook_base_url(url: str) -> None:
    """Перевірка перед set_webhook: Telegram резолвить хост і вимагає https."""
    if not url or not url.strip():
        raise RuntimeError(
            "WEBHOOK_URL порожній. У Render → Environment вкажіть URL сервісу "
            "(наприклад https://finance-bot-xxxx.onrender.com), без /webhook на кінці."
        )
    u = url.strip().rstrip("/")
    if not u.startswith("https://"):
        raise RuntimeError(
            "WEBHOOK_URL має починатися з https:// (як у панелі Render). "
            f"Зараз: {u[:100]!r}"
        )
    parsed = urlparse(u)
    if not parsed.netloc:
        raise RuntimeError(
            "WEBHOOK_URL не містить імені хоста — вставте повний URL з копіювання з Render."
        )
    host = parsed.hostname or ""
    hints = (
        "placeholder",
        "your-app",
        "your-service",
        "changeme",
        "example.invalid",
    )
    low = host.lower()
    for h in hints:
        if h in low:
            raise RuntimeError(
                f"WEBHOOK_URL схожий на заглушку ({host!r}). Вкажіть точний URL з карточки сервісу в Render."
            )


BOT_TOKEN = _req("BOT_TOKEN")
MONGODB_URI = _req("MONGODB_URI")
MONGODB_DB = _req("MONGODB_DB") or "finance_bot"
WEBHOOK_BASE_URL = _req("WEBHOOK_URL").rstrip("/")
WEBHOOK_SECRET = _telegram_safe_webhook_secret(_req("WEBHOOK_SECRET"))
PORT = int(os.environ.get("PORT", "10000"))

WEBHOOK_PATH = "/webhook"
# Публична URL Mini App (якщо порожньо — збігається з WEBHOOK_BASE_URL)
WEBAPP_URL = (_req("WEBAPP_URL").rstrip("/") or _req("WEBHOOK_URL").rstrip("/"))
