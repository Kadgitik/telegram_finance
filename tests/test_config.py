"""Перевірка нормалізації WEBHOOK_SECRET під обмеження Telegram API."""
import importlib

import bot.config as config_module


def _reload_config():
    importlib.reload(config_module)


def test_webhook_secret_valid_passthrough(monkeypatch):
    monkeypatch.setenv("WEBHOOK_SECRET", "ab_CD-01")
    _reload_config()
    try:
        assert config_module.WEBHOOK_SECRET == "ab_CD-01"
    finally:
        monkeypatch.setenv("WEBHOOK_SECRET", "")
        _reload_config()


def test_webhook_secret_invalid_becomes_hex(monkeypatch):
    monkeypatch.setenv("WEBHOOK_SECRET", "bad+token=/")
    _reload_config()
    try:
        assert len(config_module.WEBHOOK_SECRET) == 64
        assert config_module.WEBHOOK_SECRET.isalnum()
    finally:
        monkeypatch.setenv("WEBHOOK_SECRET", "")
        _reload_config()
