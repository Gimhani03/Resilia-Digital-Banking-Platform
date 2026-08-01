import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const nav = [
  { to: "/ops", label: "Security overview", icon: "⌁", end: true },
  { to: "/ops/disputes", label: "Disputes", icon: "⚑" },
  { to: "/ops/loans", label: "Loan officer", icon: "◇" },
  { to: "/ops/audit", label: "Audit trail", icon: "≡" },
];

export function DesktopShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const section =
    nav.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    )?.label || "Operations";

  function signOut() {
    logout();
    navigate("/ops/signin", { replace: true });
  }

  return (
    <div className="ops-app">
      <aside className="ops-sidebar">
          <div className="flex items-center gap-2.5 font-extrabold tracking-wide mb-8">
            <div className="w-9 h-9 rounded-[10px] bg-linear-to-br from-crimson to-crimson-dark grid place-items-center font-display shadow-lg shadow-crimson/20">
              R
            </div>
            <div>
              <div className="tracking-[0.08em]">RESILIA</div>
              <div className="text-[10px] opacity-55 font-semibold tracking-[0.12em]">OPS CONSOLE</div>
            </div>
          </div>
          <div className="text-[10px] text-white/35 tracking-[0.16em] font-extrabold mb-2 px-3">
            WORKSPACE
          </div>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-3 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-3 transition-colors ${
                  isActive
                    ? "bg-crimson text-white shadow-lg shadow-crimson/20"
                    : "text-white/70 hover:bg-white/5"
                }`
              }
            >
              <span className="w-5 text-center text-base opacity-90">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <div className="mt-auto">
            <div className="mb-3 flex items-center gap-2 text-[11px] text-white/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              Secure connection
            </div>
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs leading-relaxed text-white/75">
              <strong className="block text-white mb-0.5">
                {user?.fullName || "S. Jayasuriya"}
              </strong>
              <span className="text-white/45">Operations officer</span>
            <button
              type="button"
                onClick={signOut}
                className="block mt-3 text-crimson-soft hover:text-white transition-colors"
            >
              Sign out
            </button>
            </div>
          </div>
      </aside>
      <div className="ops-workspace">
        <header className="ops-header">
          <div>
            <div className="text-[10px] tracking-[0.15em] text-muted font-extrabold uppercase">
              Operations / {section}
            </div>
            <div className="text-sm font-bold text-navy mt-0.5">RESILIA Control Centre</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:block text-xs text-muted">
              {new Date().toLocaleDateString("en-LK", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </span>
            <div className="w-9 h-9 rounded-full bg-navy text-white grid place-items-center text-xs font-extrabold">
              {(user?.fullName || "SO")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
          </div>
        </header>
        <section className="ops-content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
