import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const tabs = [
  { to: "/app", label: "Home", icon: "⌂", end: true },
  { to: "/app/payments", label: "Pay", icon: "⇄" },
  { to: "/app/cards", label: "Cards", icon: "◇" },
  { to: "/app/profile", label: "More", icon: "☰" },
];

export function PhoneShell({
  children,
  showTabbar,
}: {
  children?: ReactNode;
  showTabbar?: boolean;
}) {
  const location = useLocation();
  const hideTab =
    location.pathname.includes("/transfer") ||
    location.pathname.includes("/held") ||
    location.pathname.includes("/security") ||
    location.pathname.includes("/loans") ||
    location.pathname.includes("/history") ||
    location.pathname.includes("/notifications");

  return (
    <div className="min-h-screen grid place-items-center p-5">
      <div className="w-[390px] min-h-[844px] bg-white rounded-[36px] shadow-[var(--shadow-phone),0_0_0_10px_#11111a,0_0_0_12px_#3a3a4d] overflow-hidden flex flex-col relative">
        <div className="flex justify-between items-center px-[22px] pt-3.5 pb-1.5 text-xs font-bold text-navy">
          <span>9:41</span>
          <div className="flex gap-2 opacity-75 text-[11px]">
            <span>■■■</span>
            <span>Wi‑Fi</span>
            <span>100%</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {children ?? <Outlet />}
        </div>
        {showTabbar && !hideTab && (
          <nav className="mt-auto grid grid-cols-4 border-t border-line pt-2.5 pb-4 px-2 bg-white">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `text-center text-[11px] font-semibold ${isActive ? "text-crimson" : "text-muted"}`
                }
              >
                <span className="block text-base mb-1">{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
        {!showTabbar && (
          <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] text-muted">
            <Link to="/" className="hover:text-crimson">
              RESILIA demo hub
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
