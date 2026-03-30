"""Перевірка нормалізації WEBHOOK_SECRET під обмеження Telegram API."""
import importlib

import pytest

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


def test_validate_webhook_empty():
    with pytest.raises(RuntimeError, match="WEBHOOK_URL"):
        config_module.validate_webhook_base_url("")


def test_validate_webhook_requires_https():
    with pytest.raises(RuntimeError, match="https"):
        config_module.validate_webhook_base_url("http://x.com")


def test_validate_webhook_ok():
    config_module.validate_webhook_base_url("https://finance-bot-7pf0.onrender.com")
