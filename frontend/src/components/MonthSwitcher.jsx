import { useMemo, useState } from "react";
import { formatMonthLabel, parseMonthKey, shiftMonth } from "../utils/month";

function buildMonthList(current, count = 24) {
  const items = [];
  const start = shiftMonth(current, -Math.floor(count / 2));
  for (let i = 0; i < count; i += 1) {
    const key = shiftMonth(start, i);
    items.push(key);
  }
  return items.reverse();
}

export default function MonthSwitcher({ month, onChange, subtitle = "" }) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => buildMonthList(month, 24), [month]);
  const { year, month: m } = parseMonthKey(month);
  return (
    <div className="rounded-xl bg-[var(--app-secondary)] px-3 py-2">
      <div className="flex items-center justify-between">
        <button type="button" className="px-2 text-lg" onClick={() => onChange(shiftMonth(month, -1))}>
          ◀
        </button>
        <button type="button" className="text-center" onClick={() => setOpen(true)}>
          <p className="font-semibold">{formatMonthLabel(`${year}-${String(m).padStart(2, "0")}`)}</p>
          {subtitle ? <p className="text-xs text-[var(--app-hint)]">{subtitle}</p> : null}
        </button>
        <button type="button" className="px-2 text-lg" onClick={() => onChange(shiftMonth(month, 1))}>
          ▶
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
