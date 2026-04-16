const GET_FRESH_TTL_MS = 45_000;
const GET_STALE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_STORAGE_KEY = "finance:get-cache:v1";
const getCache = new Map();
const inFlightGet = new Map();

function keyFor(path, initData) {
  const userKey = (initData || "").slice(0, 48);
  return `${userKey}|${path}`;
}

function loadCacheFromStorage() {
  try {
    const raw = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed || {})) {
      if (v && typeof v.ts === "number") {
        getCache.set(k, v);
      }
    }
  } catch {
    // ignore cache restore errors
  }
}

function persistCacheToStorage() {
  try {
    const now = Date.now();
    const entries = [...getCache.entries()]
      .filter(([, v]) => now - v.ts < GET_STALE_TTL_MS)
      .slice(-80);
    const obj = Object.fromEntries(entries);
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
}

loadCacheFromStorage();

function parseErrorMessage(text, status, statusText) {
  const body = String(text || "").trim();
  if (!body) return `Помилка запиту (${status || statusText || "unknown"})`;
  if (body.startsWith("<") || /<!DOCTYPE|<html/i.test(body)) {
    return `Сервер тимчасово недоступний (${status || statusText || "error"}). Спробуйте ще раз.`;
  }
  try {
    const parsed = JSON.parse(body);
    if (parsed?.detail) return String(parsed.detail);
  } catch {
    // no-op
  }
  return body.slice(0, 240);
}

function clearGetCache() {
  getCache.clear();
  inFlightGet.clear();
  try {
    sessionStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function getCached(path, initData) {
  const key = keyFor(path, initData);
  const cached = getCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > GET_STALE_TTL_MS) return null;
  return cached.data;
}

function setCached(path, initData, data, ts = Date.now()) {
  getCache.set(keyFor(path, initData), { ts, data });
}

async function request(path, initData, options = {}) {
  const headers = {
    ...options.headers,
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
  };
  if (options.method === "GET" && !options.noCache) {
    const key = keyFor(path, initData);
    const cached = getCache.get(key);
    if (cached && Date.now() - cached.ts < GET_FRESH_TTL_MS) {
      return cached.data;
    }
    if (inFlightGet.has(key)) {
      return inFlightGet.get(key);
    }
    const fetchPromise = (async () => {
      const r = await fetch(`/api${path}`, { ...options, headers });
      if (r.status === 204) return null;
      const text = await r.text();
      if (!r.ok) throw new Error(parseErrorMessage(text, r.status, r.statusText));
      try {
        const data = JSON.parse(text);
        getCache.set(key, { ts: Date.now(), data });
        persistCacheToStorage();
        return data;
      } catch {
        getCache.set(key, { ts: Date.now(), data: text });
        persistCacheToStorage();
        return text;
      } finally {
        inFlightGet.delete(key);
      }
    })();
    inFlightGet.set(key, fetchPromise);
    return fetchPromise;
  }
  const r = await fetch(`/api${path}`, { ...options, headers });
  if (r.status === 204) return null;
  const text = await r.text();
  if (!r.ok) throw new Error(parseErrorMessage(text, r.status, r.statusText));
  try {
    const data = JSON.parse(text);
    if (options.method === "GET" && !options.noCache) {
      getCache.set(keyFor(path, initData), { ts: Date.now(), data });
    }
    return data;
  } catch {
    if (options.method === "GET" && !options.noCache) {
      getCache.set(keyFor(path, initData), { ts: Date.now(), data: text });
    }
    return text;
  }
}

export const api = {
  get: (p, initData, opts = {}) => request(p, initData, { method: "GET", ...opts }),
  post: (p, initData, body) =>
    request(p, initData, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => {
      clearGetCache();
      return res;
    }),
  patch: (p, initData, body) =>
    request(p, initData, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => {
      clearGetCache();
      return res;
    }),
  put: (p, initData, body) =>
    request(p, initData, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((res) => {
      clearGetCache();
      return res;
    }),
  delete: (p, initData) =>
    request(p, initData, { method: "DELETE" }).then((res) => {
      clearGetCache();
      return res;
    }),
  setCached,
  primeCache: (entries, initData) => {
    const now = Date.now();
    for (const [path, data] of entries || []) {
      setCached(path, initData, data, now);
    }
    persistCacheToStorage();
  },
  clearCache: clearGetCache,
  getCached,
};
