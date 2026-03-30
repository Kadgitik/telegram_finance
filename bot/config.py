import os

from dotenv import load_dotenv

load_dotenv()


def _req(name: str) -> str:
    v = os.environ.get(name, "").strip()
    return v


BOT_TOKEN = _req("BOT_TOKEN")
MONGODB_URI = _req("MONGODB_URI")
MONGODB_DB = _req("MONGODB_DB") or "finance_bot"
WEBHOOK_BASE_URL = _req("WEBHOOK_URL").rstrip("/")
WEBHOOK_SECRET = _req("WEBHOOK_SECRET")
PORT = int(os.environ.get("PORT", "10000"))

WEBHOOK_PATH = "/webhook"
