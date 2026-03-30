async function request(path, initData, options = {}) {
  const headers = {
    ...options.headers,
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
  };
  const r = await fetch(`/api${path}`, { ...options, headers });
  if (r.status === 204) return null;
  const text = await r.text();
  if (!r.ok) throw new Error(text || r.statusText);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: (p, initData) => request(p, initData, { method: "GET" }),
  post: (p, initData, body) =>
    request(p, initData, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  patch: (p, initData, body) =>
    request(p, initData, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  delete: (p, initData) => request(p, initData, { method: "DELETE" }),
};
