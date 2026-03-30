import WebApp from "@twa-dev/sdk";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../utils/constants";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

export default function AddPage() {
  const [params] = useSearchParams();
  const initial = params.get("type") === "income" ? "income" : "expense";
  const [kind, setKind] = useState(initial);
  const [amountStr, setAmountStr] = useState("");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const { initData } = useTelegram();
  const h = useHaptic();
  const nav = useNavigate();

  const categories = useMemo(
    () => (kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [kind]
  );

  useEffect(() => {
    if (categories.length) setCategory(categories[0].label);
  }, [kind, categories]);

  const press = (k) => {
    h.light();
    if (k === "⌫") {
      setAmountStr((s) => s.slice(0, -1));
    } else if (k === ".") {
      setAmountStr((s) => (s.includes(".") ? s : s + "."));
    } else {
      setAmountStr((s) => (s === "0" && k !== "." ? k : s + k));
    }
  };

  const amount = parseFloat(amountStr.replace(",", ".")) || 0;

  useEffect(() => {
    WebApp.MainButton.setText("Зберегти");
    WebApp.MainButton.show();
    const save = async () => {
      if (!initData || amount <= 0) return;
      try {
        await api.post("/transactions", initData, {
          type: kind,
          amount,
          category: category || null,
          comment,
        });
        h.success();
        WebApp.MainButton.hide();
        nav(-1);
      } catch {
        h.error();
      }
    };
    WebApp.MainButton.onClick(save);
    return () => {
      WebApp.MainButton.offClick(save);
      WebApp.MainButton.hide();
    };
  }, [initData, amount, kind, category, comment, nav, h]);

  return (
    <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
      <div className="flex rounded-xl overflow-hidden mb-4 bg-[var(--app-secondary)] p-1">
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            kind === "expense" ? "bg-red-500/30 text-red-400" : ""
          }`}
          onClick={() => setKind("expense")}
        >
          Витрата
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            kind === "income" ? "bg-green-500/30 text-green-400" : ""
          }`}
          onClick={() => setKind("income")}
        >
          Дохід
        </button>
      </div>

      <div className="text-center text-5xl font-bold my-6">
        {amountStr || "0"}{" "}
        <span className="text-2xl text-[var(--app-hint)]">₴</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6 max-w-xs mx-auto">
        {KEYS.flat().map((k) => (
          <motion.button
            type="button"
            key={k}
            whileTap={{ scale: 0.95 }}
            className="h-14 rounded-2xl bg-[var(--app-secondary)] text-xl font-medium"
            onClick={() => press(k)}
          >
            {k}
          </motion.button>
        ))}
      </div>

      <p className="text-sm text-[var(--app-hint)] mb-2">Категорія</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {categories.map((c) => (
          <button
            type="button"
            key={c.label}
            onClick={() => {
              setCategory(c.label);
              h.light();
            }}
            className={`rounded-xl py-2 text-xs border ${
              category === c.label
                ? "border-[var(--app-button)] bg-[var(--app-button)]/10"
                : "border-transparent bg-[var(--app-secondary)]"
            }`}
          >
            <div className="text-lg">{c.emoji}</div>
            {c.name}
          </button>
        ))}
      </div>

      <input
        className="w-full rounded-xl px-3 py-3 bg-[var(--app-secondary)] border border-white/10 placeholder:text-[var(--app-hint)]"
        placeholder="Коментар..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
    </div>
  );
}
