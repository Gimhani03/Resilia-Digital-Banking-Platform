import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader, BrandMark, Card, Content, SectionLabel } from "../components/ui";
import { api, formatLkr, initials } from "../lib/api";
import { useAuth } from "../lib/auth";

type Dash = {
  primary: { id: string; label: string; mask: string; balance: number };
  recent: {
    id: string;
    counterparty: string;
    category: string;
    amount: number;
    direction: string;
    status: string;
    createdAt: string;
  }[];
  securityAlerts: { id: string; title: string; body: string }[];
};

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    api<Dash>("/accounts/dashboard", { token }).then(setData).catch(console.error);
  }, [token]);

  const actions = [
    { to: "/app/transfer", icon: "↗", label: "Transfer" },
    { to: "/app/payments", icon: "▦", label: "Pay bills" },
    { to: "/app/loans", icon: "%", label: "Loans" },
    { to: "/app/security", icon: "❄", label: "Freeze" },
  ];

  return (
    <>
      <AppHeader
        left={
          <div>
            <div className="text-xs text-muted font-bold">Good morning</div>
            <div className="font-extrabold text-navy">{user?.fullName}</div>
          </div>
        }
        right={
          <Link to="/app/notifications">
            <BrandMark text={initials(user?.fullName || "AP")} />
          </Link>
        }
      />
      <Content>
        <Card className="!bg-gradient-to-br from-navy via-[#2d2d4a] to-[#4a1830] !border-none text-white relative overflow-hidden">
          <div className="absolute w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(201,24,74,0.35),transparent_70%)] -right-10 -top-10" />
          <div className="text-xs opacity-75 mb-1.5 relative z-10">
            Available balance · {data?.primary.label} {data?.primary.mask}
          </div>
          <div className="font-display text-[34px] mb-3.5 relative z-10">
            {data ? formatLkr(data.primary.balance) : "…"}
          </div>
          <div className="flex justify-between text-xs opacity-85 relative z-10">
            <span>Last sync · just now</span>
            <span>Region A · Healthy</span>
          </div>
        </Card>

        {(data?.securityAlerts?.length ?? 0) > 0 && (
          <Card className="!bg-crimson-soft !border-[1.5px] !border-crimson/25 flex gap-3 items-start">
            <div className="w-2.5 h-2.5 rounded-full bg-crimson mt-1.5 shadow-[0_0_0_4px_rgba(201,24,74,0.15)] shrink-0" />
            <div>
              <strong className="block text-crimson-dark text-[13px] mb-1">
                Security alert
              </strong>
              <Link to="/app/profile" className="text-xs text-muted leading-snug">
                {data!.securityAlerts[0].body} Review devices →
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2 my-1 mb-4">
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="text-center p-3 rounded-[14px] bg-surface border border-line"
            >
              <div className="w-9 h-9 mx-auto mb-2 rounded-xl bg-navy text-white grid place-items-center text-sm">
                {a.icon}
              </div>
              <span className="text-[11px] font-bold text-navy">{a.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex justify-between items-center">
          <SectionLabel>Recent activity</SectionLabel>
          <Link to="/app/history" className="text-xs font-bold text-crimson">
            See all
          </Link>
        </div>
        <Card className="!py-1">
          {(data?.recent || []).map((t) => (
            <Link
              key={t.id}
              to={t.status === "HELD" ? `/app/held/${t.id}` : `/app/history`}
              className="flex items-center gap-3 py-3 border-b border-line last:border-0"
            >
              <div className="w-10 h-10 rounded-xl bg-surface grid place-items-center text-sm font-extrabold text-navy">
                {t.counterparty.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <strong className="block text-[13px] text-navy truncate">
                  {t.counterparty}
                </strong>
                <span className="text-[11px] text-muted">
                  {new Date(t.createdAt).toLocaleDateString()} · {t.category}
                  {t.status === "HELD" ? " · HELD" : ""}
                </span>
              </div>
              <div
                className={`font-extrabold text-[13px] ${
                  t.direction === "IN" ? "text-ok" : "text-navy"
                }`}
              >
                {t.direction === "IN" ? "+" : "−"}
                {t.amount.toLocaleString()}
              </div>
            </Link>
          ))}
        </Card>
      </Content>
    </>
  );
}
