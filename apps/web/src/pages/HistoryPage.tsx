import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader, Card, Content, HeroTitle, SectionLabel, Sub } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Txn = {
  id: string;
  counterparty: string;
  category: string;
  amount: number;
  direction: string;
  status: string;
  createdAt: string;
};

const cats = ["All", "TRANSFER", "MERCHANT", "UTILITIES", "SALARY"];

export default function HistoryPage() {
  const { token } = useAuth();
  const [category, setCategory] = useState("All");
  const [rows, setRows] = useState<Txn[]>([]);

  useEffect(() => {
    api<Txn[]>(`/payments/history?category=${category}`, { token }).then(setRows);
  }, [token, category]);

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">History</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <HeroTitle className="!text-[26px]">Transactions</HeroTitle>
        <Sub>Categorised history beyond the dashboard list (FR-04).</Sub>
        <div className="flex flex-wrap gap-2 mb-4">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-full text-xs font-bold border-[1.5px] ${
                category === c ? "bg-navy text-white border-navy" : "bg-white border-line"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <SectionLabel>All activity</SectionLabel>
        <Card className="!py-1">
          {rows.map((t) => (
            <Link
              key={t.id}
              to={t.status === "HELD" ? `/app/held/${t.id}` : "#"}
              className="flex items-center gap-3 py-3 border-b border-line last:border-0"
            >
              <div className="w-10 h-10 rounded-xl bg-surface grid place-items-center text-sm font-extrabold">
                {t.counterparty.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <strong className="block text-[13px] truncate">{t.counterparty}</strong>
                <span className="text-[11px] text-muted">
                  {new Date(t.createdAt).toLocaleString()} · {t.status}
                </span>
              </div>
              <div className={`font-extrabold text-[13px] ${t.direction === "IN" ? "text-ok" : ""}`}>
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
