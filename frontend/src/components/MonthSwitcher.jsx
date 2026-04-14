import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel, parseMonthKey, shiftMonth } from "../utils/month";

function buildMonthList(current, count = 24) {
  const items = [];
  const today = new Date();
  const realCurrent = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const start = current && current > realCurrent ? current : realCurrent;
  
  for (let i = 0; i < count; i += 1) {
    const key = shiftMonth(start, -i);
    items.push(key);
  }
  return items;
}

export default function MonthSwitcher({ month, onChange, subtitle = "", periodLabel = "", compact = false }) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => buildMonthList(month, 24), [month]);
  const { year, month: m } = parseMonthKey(month);
  const monthLabel = formatMonthLabel(`${year}-${String(m).padStart(2, "0")}`);

  if (compact) {
    return (
      <>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 transition-colors"
            onClick={() => onChange(shiftMonth(month, -1))}
            aria-label="Попередній місяць"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="text-center px-4 py-1.5 rounded-2xl bg-white/5 border border-white/10 active:bg-white/10 transition-colors"
            onClick={() => setOpen(true)}
          >
            <p className="font-semibold text-[17px] text-white/90 leading-tight">{monthLabel}</p>
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 transition-colors"
            onClick={() => onChange(shiftMonth(month, 1))}
            aria-label="Наступний місяць"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {open ? (
          <div className="fixed inset-0 z-[70] bg-black/60 p-4" onClick={() => setOpen(false)}>
            <div className="max-w-sm mx-auto mt-16 rounded-2xl bg-[var(--app-secondary)] p-3" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-[var(--app-hint)] mb-2">Оберіть місяць</p>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {list.map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`w-full text-left px-3 py-2 rounded-lg ${key === month ? "bg-[var(--app-button)]/30" : "bg-black/20"}`}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                  >
                    {formatMonthLabel(key)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--app-secondary)]/95 px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="h-9 w-9 rounded-xl bg-black/25 border border-white/10 flex items-center justify-center text-[var(--app-text)]"
          onClick={() => onChange(shiftMonth(month, -1))}
          aria-label="Попередній місяць"
        >
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="text-center min-w-0 flex-1" onClick={() => setOpen(true)}>
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--app-hint)] mb-0.5">Фінансовий місяць</p>
          <p className="font-semibold text-[19px] leading-tight">{monthLabel}</p>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-[var(--app-hint)]">
            <CalendarDays size={13} />
            {periodLabel ? <span>Період: {periodLabel}</span> : null}
          </div>
          {subtitle ? <p className="text-xs text-[var(--app-hint)] mt-0.5">{subtitle}</p> : null}
        </button>
        <button
          type="button"
          className="h-9 w-9 rounded-xl bg-black/25 border border-white/10 flex items-center justify-center text-[var(--app-text)]"
          onClick={() => onChange(shiftMonth(month, 1))}
          aria-label="Наступний місяць"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[70] bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="max-w-sm mx-auto mt-16 rounded-2xl bg-[var(--app-secondary)] p-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-[var(--app-hint)] mb-2">Оберіть місяць</p>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {list.map((key) => (
                <button
                  type="button"
                  key={key}
                  className={`w-full text-left px-3 py-2 rounded-lg ${key === month ? "bg-[var(--app-button)]/30" : "bg-black/20"}`}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {formatMonthLabel(key)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
