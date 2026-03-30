import hashlib
import os
import re

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


BOT_TOKEN = _req("BOT_TOKEN")
MONGODB_URI = _req("MONGODB_URI")
MONGODB_DB = _req("MONGODB_DB") or "finance_bot"
WEBHOOK_BASE_URL = _req("WEBHOOK_URL").rstrip("/")
WEBHOOK_SECRET = _telegram_safe_webhook_secret(_req("WEBHOOK_SECRET"))
PORT = int(os.environ.get("PORT", "10000"))

WEBHOOK_PATH = "/webhook"
