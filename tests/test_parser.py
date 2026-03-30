import pytest

from bot.services.parser import parse_transaction_message


def test_coffee_expense():
    r = parse_transaction_message("кава 85")
    assert r is not None
    assert r.type == "expense"
    assert r.amount == 85
    assert r.category == "🍔 Їжа"
    assert "кава" in r.comment.lower()


def test_salary_income():
    r = parse_transaction_message("+45000 зарплата")
    assert r is not None
    assert r.type == "income"
    assert r.amount == 45000
    assert r.category == "💰 Зарплата"


def test_taxi():
    r = parse_transaction_message("таксі 120")
    assert r is not None
    assert r.amount == 120
    assert r.category == "🚕 Транспорт"


def test_amount_only_no_category():
    r = parse_transaction_message("1200")
    assert r is not None
    assert r.amount == 1200
    assert r.category is None


def test_metro_decimal():
    r = parse_transaction_message("метро 14.50")
    assert r is not None
    assert r.amount == 14.5
    assert r.category == "🚕 Транспорт"


def test_empty():
    assert parse_transaction_message("") is None
    assert parse_transaction_message("   ") is None


def test_no_amount():
    assert parse_transaction_message("привіт") is None


def test_two_numbers_first_wins():
    r = parse_transaction_message("100 200")
    assert r is not None
    assert r.amount == 100


def test_products_uah():
    r = parse_transaction_message("продукти 2500 грн")
    assert r is not None
    assert r.amount == 2500
    assert r.category == "🍔 Їжа"


def test_gym():
    r = parse_transaction_message("1200 зал")
    assert r is not None
    assert r.amount == 1200
    assert r.category == "💊 Здоров'я"
