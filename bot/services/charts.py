from __future__ import annotations

import io
from typing import Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from bot.constants import DEFAULT_CATEGORIES

COLORS = {
    "bg": "#1a1a2e",
    "card": "#16213e",
    "accent": "#0f3460",
    "highlight": "#e94560",
    "text": "#ffffff",
    "text_secondary": "#a0a0b0",
    "green": "#00d2ff",
    "categories": [
        "#e94560",
        "#0f3460",
        "#00d2ff",
        "#f5a623",
        "#7b68ee",
        "#50c878",
        "#ff6b6b",
        "#ffd93d",
        "#6bcb77",
        "#a0a0b0",
    ],
}


def _apply_dark_style() -> None:
    plt.style.use("dark_background")
    plt.rcParams["figure.facecolor"] = COLORS["bg"]
    plt.rcParams["axes.facecolor"] = COLORS["card"]
    plt.rcParams["text.color"] = COLORS["text"]
    plt.rcParams["axes.labelcolor"] = COLORS["text_secondary"]
    plt.rcParams["xtick.color"] = COLORS["text_secondary"]
    plt.rcParams["ytick.color"] = COLORS["text_secondary"]


def generate_pie_chart(
    title: str,
    labels: Sequence[str],
    values: Sequence[float],
) -> io.BytesIO:
    _apply_dark_style()
    fig, ax = plt.subplots(figsize=(8, 6), facecolor=COLORS["bg"])
    ax.set_facecolor(COLORS["bg"])
    if not values or sum(values) <= 0:
        ax.text(0.5, 0.5, "Немає даних", ha="center", va="center", color=COLORS["text"])
        ax.set_axis_off()
    else:
        pal = COLORS["categories"]
        colors = [pal[i % len(pal)] for i in range(len(labels))]
        total = sum(values)
        pct = [100 * v / total for v in values]
        legend_labels = [f"{lab} ({p:.0f}%)" for lab, p in zip(labels, pct, strict=True)]
        wedges, _texts, autotexts = ax.pie(
            values,
            labels=None,
            colors=colors,
            autopct="%1.0f%%",
            textprops={"color": COLORS["text"], "fontsize": 9},
            wedgeprops={"linewidth": 1, "edgecolor": COLORS["bg"]},
        )
        for t in autotexts:
            t.set_color("white")
        ax.legend(
            wedges,
            legend_labels,
            loc="center left",
            bbox_to_anchor=(1, 0, 0.5, 1),
            facecolor=COLORS["card"],
            labelcolor=COLORS["text"],
        )
    ax.set_title(title, color=COLORS["text"], fontsize=14, pad=16)
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor=COLORS["bg"])
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_bar_chart(
    title: str,
    labels: Sequence[str],
    values: Sequence[float],
) -> io.BytesIO:
    _apply_dark_style()
    fig, ax = plt.subplots(figsize=(9, 5), facecolor=COLORS["bg"])
    ax.set_facecolor(COLORS["card"])
    if not values:
        ax.text(0.5, 0.5, "Немає даних", ha="center", va="center", color=COLORS["text"])
        ax.set_axis_off()
    else:
        vmax = max(values) or 1.0
        bar_colors = [
            plt.cm.RdYlGn_r(min(1.0, max(0.0, v / vmax * 0.9))) for v in values
        ]
        y_pos = range(len(labels))
        ax.barh(list(y_pos), list(values), color=bar_colors, height=0.65, edgecolor=COLORS["bg"])
        ax.set_yticks(list(y_pos), labels=list(labels))
        ax.invert_yaxis()
        for i, v in enumerate(values):
            ax.text(v + vmax * 0.01, i, f"{v:.0f}", va="center", color=COLORS["text"], fontsize=9)
    ax.set_title(title, color=COLORS["text"], fontsize=14, pad=12)
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor=COLORS["bg"])
    plt.close(fig)
    buf.seek(0)
    return buf


def generate_line_chart(
    title: str,
    labels: Sequence[str],
    values: Sequence[float],
) -> io.BytesIO:
    _apply_dark_style()
    fig, ax = plt.subplots(figsize=(10, 5), facecolor=COLORS["bg"])
    ax.set_facecolor(COLORS["card"])
    if not values:
        ax.text(0.5, 0.5, "Немає даних", ha="center", va="center", color=COLORS["text"])
        ax.set_axis_off()
    else:
        x = range(len(labels))
        ax.plot(
            list(x),
            list(values),
            color=COLORS["highlight"],
            marker="o",
            linewidth=2,
            markersize=6,
        )
        ax.fill_between(list(x), list(values), alpha=0.25, color=COLORS["highlight"])
        avg = sum(values) / len(values)
        ax.axhline(avg, color=COLORS["green"], linestyle="--", linewidth=1, label="Середнє")
        ax.set_xticks(list(x), labels=list(labels), rotation=45, ha="right")
        ax.legend(facecolor=COLORS["card"], labelcolor=COLORS["text"])
        ax.grid(True, alpha=0.2)
    ax.set_title(title, color=COLORS["text"], fontsize=14, pad=12)
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor=COLORS["bg"])
    plt.close(fig)
    buf.seek(0)
    return buf


def default_expense_category_labels() -> list[str]:
    return list(DEFAULT_CATEGORIES.keys())
