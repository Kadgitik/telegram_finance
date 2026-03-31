import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../utils/constants";

const QUICK_EMOJIS = ["🍔", "🚕", "🏠", "🎮", "👕", "💊", "🎁", "📱", "💼", "💰", "💵", "📈", "🏷"];

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
  const [customCats, setCustomCats] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("🏷");
  const savingRef = useRef(false);
  const { initData } = useTelegram();
  const h = useHaptic();
  const nav = useNavigate();

  const categories = useMemo(
    () =>
      [
        ...(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
        ...customCats.map((c) => ({ ...c, custom: true })),
      ],
    [kind, customCats]
  );

  useEffect(() => {
    if (categories.length) setCategory(categories[0].label);
  }, [kind, categories]);

  useEffect(() => {
    if (!initData) return;
    api
      .get("/categories", initData)
      .then((r) => {
        const custom = (r.custom || []).map((x) => {
          const label = x.label || `${x.emoji || "🏷"} ${x.name || ""}`.trim();
          return {
            emoji: x.emoji || label.split(" ")[0] || "🏷",
            name: x.name || label.split(" ").slice(1).join(" ") || label,
            label,
          };
        });
        setCustomCats(custom);
      })
      .catch(() => {});
  }, [initData]);

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

  const saveNewCategory = async () => {
    if (!initData || !newCatName.trim()) return;
    const name = newCatName.trim();
    const emoji = (newCatEmoji || "🏷").trim() || "🏷";
    const created = await api.post("/categories", initData, { emoji, name, keywords: [] });
    const label = created?.label || `${emoji} ${name}`;
    setCustomCats((prev) => {
      const next = [...prev];
      if (!next.some((x) => x.label === label)) {
        next.push({ emoji, name, label });
      }
      return next;
    });
    setCategory(label);
    setShowAddCat(false);
    setNewCatName("");
    setNewCatEmoji("🏷");
    h.success();
  };

  return (
    <div className="px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] max-w-lg mx-auto min-h-screen overflow-y-auto">
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

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-[var(--app-hint)]">Категорія</p>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded-lg bg-[var(--app-secondary)] border border-white/10"
          onClick={() => setShowAddCat(true)}
        >
          ➕ Додати категорію
        </button>
      </div>
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
      <button
        type="button"
        disabled={!amount || saving}
        className="mt-4 w-full py-3 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium disabled:opacity-50 sticky bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        onClick={async () => {
          if (!initData || amount <= 0 || savingRef.current) return;
          savingRef.current = true;
          setSaving(true);
          try {
            await api.post("/transactions", initData, {
              type: kind,
              amount,
              category: category || null,
              comment,
            });
            h.success();
            nav(-1);
          } catch {
            h.error();
            setSaving(false);
            savingRef.current = false;
          }
        }}
      >
        {saving ? "Збереження..." : "Зберегти"}
      </button>
      {showAddCat ? (
        <div className="fixed inset-0 z-[80] bg-black/60 p-4" onClick={() => setShowAddCat(false)}>
          <div
            className="max-w-sm mx-auto mt-16 rounded-2xl bg-[var(--app-secondary)] p-3 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">Нова категорія</p>
            <div className="grid grid-cols-7 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  className={`rounded-lg py-1 text-lg ${
                    newCatEmoji === emoji ? "bg-[var(--app-button)]/25 border border-[var(--app-button)]" : "bg-black/20"
                  }`}
                  onClick={() => setNewCatEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-xl px-3 py-2 bg-black/20"
              placeholder="Назва категорії"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl py-2 bg-black/20"
                onClick={() => setShowAddCat(false)}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="rounded-xl py-2 bg-[var(--app-button)] text-white disabled:opacity-60"
                disabled={!newCatName.trim()}
                onClick={saveNewCategory}
              >
                Додати
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
