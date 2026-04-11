import { CheckCircle, Download, Link2Off, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";

export default function SettingsPage() {
  const { initData } = useTelegram();
  const h = useHaptic();
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadStatus = async () => {
    if (!initData) return;
    try {
      const s = await api.get("/mono/status", initData);
      setStatus(s);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStatus();
  }, [initData]);

  const connect = async () => {
    if (!initData || !token.trim()) return;
    setConnecting(true);
    setErr("");
    setMsg("");
    try {
      const r = await api.post("/mono/connect", initData, { token: token.trim() });
      setMsg(`Підключено! ${r.client_name || ""} — ${r.accounts?.length || 0} рахунків`);
      setToken("");
      h.success();
      await loadStatus();
    } catch (e) {
      setErr(String(e.message || "Помилка підключення"));
      h.error();
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!initData) return;
    try {
      await api.post("/mono/disconnect", initData, {});
      setStatus(null);
      setMsg("Monobank відключено");
      h.success();
    } catch {
      h.error();
    }
  };

  const sync = async () => {
    if (!initData || syncing) return;
    setSyncing(true);
    setMsg("");
    setErr("");
    try {
      const r = await api.post("/mono/sync", initData, {});
      setMsg(`Синхронізовано: ${r.new} нових, ${r.updated} оновлених з ${r.total}`);
      h.success();
    } catch (e) {
      setErr(String(e.message || "Помилка синхронізації"));
      h.error();
    } finally {
      setSyncing(false);
    }
  };

  const exportCsv = () => {
    if (!initData) return;
    window.open(`/api/export/csv?${new URLSearchParams({ authorization: `tma ${initData}` })}`, "_blank");
  };

  const connected = status?.connected;

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">Налаштування</h1>

      {/* Monobank connection status */}
      <div className="rounded-xl bg-[var(--app-secondary)] p-4">
        <div className="flex items-center gap-2 mb-3">
          {connected ? (
            <CheckCircle size={18} className="text-green-400" />
          ) : (
            <XCircle size={18} className="text-[var(--app-hint)]" />
          )}
          <p className="font-semibold">
            Monobank {connected ? "підключено" : "не підключено"}
          </p>
        </div>

        {connected && status?.accounts?.length > 0 && (
          <div className="mb-3 space-y-1">
            {status.accounts.map((acc) => (
              <div
                key={acc.id}
                className={`text-xs px-2 py-1.5 rounded-lg ${
                  acc.id === status.default_account
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-black/10"
                }`}
              >
                <span className="font-medium">
                  {acc.type} {acc.masked_pan?.[0] || ""}
                </span>
                <span className="ml-2 tabular-nums">
                  {(acc.balance || 0).toLocaleString("uk-UA")} {acc.currency_code === 980 ? "₴" : acc.currency_code === 840 ? "$" : "€"}
                </span>
                {acc.id === status.default_account && (
                  <span className="ml-2 text-green-400">основний</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!connected && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--app-hint)]">
              Отримай токен на api.monobank.ua та вставь сюди
            </p>
            <input
              className="w-full rounded-xl px-3 py-2.5 bg-black/20 border border-white/10 placeholder:text-[var(--app-hint)] text-sm font-mono"
              placeholder="Вставте токен Monobank..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              type="button"
              onClick={connect}
              disabled={connecting || !token.trim()}
              className="w-full py-2.5 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium text-sm disabled:opacity-50"
            >
              {connecting ? "Підключення..." : "Підключити Monobank"}
            </button>
          </div>
        )}

        {connected && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="flex-1 py-2.5 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Синхронізація..." : "Синхронізувати"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <Link2Off size={14} />
              Відключити
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p className="text-sm text-green-400 bg-green-500/10 rounded-xl px-3 py-2">{msg}</p>
      )}
      {err && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{err}</p>
      )}

      {/* Export */}
      <div className="rounded-xl bg-[var(--app-secondary)] p-4">
        <p className="font-semibold mb-2">Експорт</p>
        <button
          type="button"
          onClick={exportCsv}
          className="w-full py-2.5 rounded-xl bg-black/20 text-sm flex items-center justify-center gap-2"
        >
          <Download size={14} />
          Завантажити CSV
        </button>
      </div>
    </div>
  );
}
