import { sparklinePath } from "../utils/sparkline";

export default function Sparkline({
  values,
  width = 100,
  height = 28,
  color = "#FF6B6B",
  className = "",
}) {
  const d = sparklinePath(values, width, height);
  if (!d) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
