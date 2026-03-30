import { Link } from "react-router-dom";

const links = [
  ["/budgets", "💰 Бюджети"],
  ["/settings", "⚙️ Налаштування"],
];

export default function MorePage() {
  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">Ще</h1>
      <ul className="space-y-2">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link
              to={to}
              className="block rounded-xl px-4 py-4 bg-[var(--app-secondary)]"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
