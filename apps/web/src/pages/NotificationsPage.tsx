import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader, Card, Content, HeroTitle, Sub } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type N = {
  id: string;
  channel: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<N[]>([]);

  async function load() {
    setRows(await api<N[]>("/notifications", { token }));
  }

  useEffect(() => {
    load();
  }, [token]);

  async function mark(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST", token });
    load();
  }

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">Alerts</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <HeroTitle className="!text-[26px]">Notifications</HeroTitle>
        <Sub>Security, payment, and loan alerts via push / SMS / email (FR-10).</Sub>
        {rows.map((n) => (
          <Card
            key={n.id}
            className={`cursor-pointer ${n.read ? "opacity-70" : "!border-crimson/30"}`}
            onClick={() => !n.read && mark(n.id)}
          >
            <div className="flex justify-between text-[11px] text-muted mb-1">
              <span className="uppercase font-bold">{n.kind}</span>
              <span>{n.channel}</span>
            </div>
            <div className="font-bold text-navy text-sm">{n.title}</div>
            <div className="text-xs text-muted mt-1">{n.body}</div>
          </Card>
        ))}
      </Content>
    </>
  );
}
