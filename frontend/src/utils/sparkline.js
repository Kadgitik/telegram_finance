// Build an SVG path string for a tiny sparkline from a list of numbers.
export function sparklinePath(values, width = 100, height = 28, pad = 2) {
  const nums = (values || []).map((v) => Number(v) || 0);
  if (nums.length === 0) return "";
  const y0 = height / 2;
  if (nums.length === 1) return `M ${pad} ${y0} L ${width - pad} ${y0}`;

  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / (nums.length - 1);

  return nums
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
