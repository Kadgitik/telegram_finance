import os

# Тести не потребують реального BOT_TOKEN / Mongo, якщо не імпортують main до встановлення змінних.
os.environ.setdefault("BOT_TOKEN", "123456:TEST")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB", "finance_bot_test")
os.environ.setdefault("WEBHOOK_URL", "https://example.com")
os.environ.setdefault("WEBHOOK_SECRET", "")
os.environ.setdefault("PORT", "9999")
