from bot.services.charts import (
    generate_bar_chart,
    generate_line_chart,
    generate_pie_chart,
)


def _is_png(buf) -> bool:
    data = buf.getvalue()
    return len(data) > 100 and data[:8] == b"\x89PNG\r\n\x1a\n"


def test_generate_pie_chart():
    buf = generate_pie_chart(
        "Test",
        ["A", "B"],
        [30.0, 70.0],
    )
    assert _is_png(buf)


def test_generate_bar_chart():
    buf = generate_bar_chart("Days", ["Пн", "Вт"], [100.0, 200.0])
    assert _is_png(buf)


def test_generate_line_chart():
    buf = generate_line_chart("Trend", ["1", "2", "3"], [10.0, 20.0, 15.0])
    assert _is_png(buf)


def test_pie_empty():
    buf = generate_pie_chart("Empty", [], [])
    assert _is_png(buf)
