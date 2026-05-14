import { CheckCircle, ChevronDown, ChevronUp, Download, ExternalLink, FileUp, Link2Off, RefreshCw, Upload, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useHaptic } from "../hooks/useHaptic";
import { useTelegram } from "../hooks/useTelegram";

export default function SettingsPage() {
  const { initData, WebApp } = useTelegram();
  const h = useHaptic();
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showCsvGuide, setShowCsvGuide] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const openMonoSite = () => {
    try {
      WebApp?.openLink?.("https://api.monobank.ua/", { try_instant_view: false });
    } catch {
      window.open("https://api.monobank.ua/", "_blank");
    }
  };

  const connect = async () => {
    if (!initData || !token.trim()) return;
    setConnecting(true);
    setErr("");
    setMsg("");
    try {
      const r = await api.post("/mono/connect", initData, { token: token.trim() });
      setMsg(`✅ Підключено! ${r.client_name || ""} — ${r.accounts?.length || 0} рахунків`);
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
      await api.post("/mono/disconnect", initData, {}, { "X-Action-Confirm": "yes" });
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
      setMsg(`✅ Синхронізовано: ${r.new} нових, ${r.updated} оновлених з ${r.total}`);
      h.success();
      // Refresh status to show updated card balances
      await loadStatus();
    } catch (e) {
      setErr(String(e.message || "Помилка синхронізації"));
      h.error();
    } finally {
      setSyncing(false);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !initData) return;
    setUploading(true);
    setErr("");
    setMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await api.upload("/import/csv", initData, formData);
      setMsg(`✅ Імпортовано: ${r.new} нових транзакцій, ${r.skipped} пропущено (дублікати)${r.errors ? `, ${r.errors} помилок` : ""}`);
      h.success();
    } catch (e) {
      setErr(String(e.message || "Помилка імпорту CSV"));
      h.error();
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const exportCsv = async () => {
    if (!initData) return;
    try {
      const { token } = await api.post("/export/token", initData, {});
      const r = await fetch(`/api/export/csv?token=${encodeURIComponent(token)}`);
      if (!r.ok) throw new Error(`Помилка ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e.message || "Помилка експорту"));
    }
  };

  const connected = status?.connected;

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold">Налаштування</h1>

      {/* ─── Monobank connection status ─── */}
      <div className="rounded-[24px] bg-[var(--app-card)] p-5">
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

        {/* ─── Not connected: step-by-step guide ─── */}
        {!connected && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--app-hint)] leading-relaxed">
              Підключіть Monobank для автоматичної синхронізації витрат та доходів
            </p>

            {/* Step 1 */}
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--app-button)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[var(--tg-theme-button-text-color,white)] text-xs font-bold">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1.5">Отримайте токен</p>
                <button
                  type="button"
                  onClick={openMonoSite}
                  className="w-full py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <ExternalLink size={14} />
                  Відкрити api.monobank.ua
                </button>
                <p className="text-[11px] text-[var(--app-hint)] mt-1.5 leading-relaxed">
                  Авторизуйтесь через додаток Mono → натисніть "Отримати токен" → скопіюйте його
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--app-button)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[var(--tg-theme-button-text-color,white)] text-xs font-bold">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1.5">Вставте токен</p>
                <input
                  className="w-full rounded-xl px-3 py-2.5 bg-black/20 border border-white/10 placeholder:text-[var(--app-hint)] text-sm font-mono"
                  placeholder="uBe3F_..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-[var(--app-button)] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[var(--tg-theme-button-text-color,white)] text-xs font-bold">3</span>
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={connect}
                  disabled={connecting || !token.trim()}
                  className="w-full py-2.5 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  {connecting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Підключення...
                    </>
                  ) : (
                    "🔗 Підключити Monobank"
                  )}
                </button>
              </div>
            </div>

            {/* Security note */}
            <div className="rounded-xl bg-green-500/5 border border-green-500/15 px-3 py-2 mt-2">
              <p className="text-[11px] text-green-400/80 leading-relaxed">
                🔒 Токен зберігається у зашифрованому вигляді. Він дає доступ тільки на читання — ніхто не зможе переказати чи витратити ваші кошти.
              </p>
            </div>
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

      {/* ─── Messages ─── */}
      {msg && (
        <p className="text-sm text-green-400 bg-green-500/10 rounded-xl px-3 py-2">{msg}</p>
      )}
      {err && (
        <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{err}</p>
      )}

      {/* ─── CSV Import (alternative for nervous users) ─── */}
      <div className="rounded-[24px] bg-[var(--app-card)] p-5">
        <button
          type="button"
          onClick={() => setShowCsvGuide((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-[var(--app-hint)]" />
            <p className="font-semibold text-left">Імпорт виписки (CSV)</p>
          </div>
          {showCsvGuide ? <ChevronUp size={18} className="text-[var(--app-hint)]" /> : <ChevronDown size={18} className="text-[var(--app-hint)]" />}
        </button>

        <p className="text-[11px] text-[var(--app-hint)] mt-1">
          Альтернатива для тих, хто не хоче давати API-доступ
        </p>

        {showCsvGuide && (
          <div className="mt-4 space-y-4">
            {/* Guide */}
            <div className="rounded-xl bg-black/10 border border-white/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider">Як завантажити виписку</p>

              <div className="flex gap-3 items-start">
                <span className="text-sm">📱</span>
                <div>
                  <p className="text-sm font-medium">Крок 1</p>
                  <p className="text-xs text-[var(--app-hint)] leading-relaxed">
                    Відкрийте <b>web.monobank.ua</b> у браузері або додаток Monobank
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-sm">📋</span>
                <div>
                  <p className="text-sm font-medium">Крок 2</p>
                  <p className="text-xs text-[var(--app-hint)] leading-relaxed">
                    Оберіть рахунок → вкажіть період (наприклад, останній місяць)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-sm">⬇️</span>
                <div>
                  <p className="text-sm font-medium">Крок 3</p>
                  <p className="text-xs text-[var(--app-hint)] leading-relaxed">
                    Натисніть <b>«Виписка»</b> → <b>«Експортувати»</b> → оберіть формат <b>CSV</b> → завантажте файл
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-sm">📤</span>
                <div>
                  <p className="text-sm font-medium">Крок 4</p>
                  <p className="text-xs text-[var(--app-hint)] leading-relaxed">
                    Завантажте цей файл нижче — транзакції автоматично з'являться у додатку
                  </p>
                </div>
              </div>
            </div>

            {/* Safety note */}
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 px-3 py-2">
              <p className="text-[11px] text-blue-400/80 leading-relaxed">
                ℹ️ При цьому способі ваші дані не оновлюються автоматично — вам потрібно завантажувати нову виписку вручну. Для автооновлення підключіть Monobank API (вище).
              </p>
            </div>

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2.5 rounded-xl bg-[var(--app-button)] text-[var(--tg-theme-button-text-color,white)] font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Імпортування...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Завантажити CSV файл
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ─── Export ─── */}
      <div className="rounded-[24px] bg-[var(--app-card)] p-5">
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
