const GET_TTL_MS = 45_000;
const getCache = new Map();

function keyFor(path, initData) {
  const userKey = (initData || "").slice(0, 48);
  return `${userKey}|${path}`;
}

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
}

function getCached(path, initData) {
  const key = keyFor(path, initData);
  const cached = getCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > GET_TTL_MS) return null;
  return cached.data;
}

async function request(path, initData, options = {}) {
  const headers = {
    ...options.headers,
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
  };
  if (options.method === "GET" && !options.noCache) {
    const key = keyFor(path, initData);
    const cached = getCache.get(key);
    if (cached && Date.now() - cached.ts < GET_TTL_MS) {
      return cached.data;
    }
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
  clearCache: clearGetCache,
  getCached,
};
