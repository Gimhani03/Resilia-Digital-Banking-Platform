import { useEffect, useState } from "react";
import { Badge, Card } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Event = {
  id: string;
  category: string;
  action: string;
  actor: string;
  detail: string;
  hash: string;
  prevHash: string;
  createdAt: string;
};

type Integrity = { events: number; chainValid: boolean; tipHash: string | null };

const cats = ["All", "Payments", "Auth", "Admin", "Fraud", "Security", "Identity", "Infra"];

export default function AuditTrailPage() {
  const { token } = useAuth();
  const [category, setCategory] = useState("All");
  const [rows, setRows] = useState<Event[]>([]);
  const [integrity, setIntegrity] = useState<Integrity | null>(null);

  useEffect(() => {
    api<Event[]>(`/audit?category=${category}`, { token }).then(setRows);
    api<Integrity>("/audit/integrity", { token }).then(setIntegrity);
  }, [token, category]);

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="font-display text-[28px] text-navy">Audit trail</h1>
          <p className="text-muted text-[13px] mt-1">
            Tamper-evident event feed with hash-chain verification (FR-13).
          </p>
        </div>
        <Badge tone={integrity?.chainValid ? "ok" : "danger"}>
          {integrity?.chainValid ? "● Chain valid" : "● Chain broken"}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="!mb-0">
          <div className="text-xs text-muted font-bold">Events</div>
          <div className="font-display text-3xl text-navy">{integrity?.events ?? "…"}</div>
        </Card>
        <Card className="!mb-0">
          <div className="text-xs text-muted font-bold">Integrity</div>
          <div className="font-display text-3xl text-navy">
            {integrity?.chainValid ? "OK" : "FAIL"}
          </div>
        </Card>
        <Card className="!mb-0">
          <div className="text-xs text-muted font-bold">Tip hash</div>
          <div className="text-xs font-mono break-all mt-2">
            {integrity?.tipHash?.slice(0, 24) ?? "…"}…
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-3 py-2 rounded-full text-xs font-bold border ${
              category === c ? "bg-navy text-white border-navy" : "bg-white border-line"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="bg-white border border-line rounded-[18px] overflow-hidden">
        {rows.map((e) => (
          <div key={e.id} className="p-4 border-b border-line last:border-0">
            <div className="flex justify-between gap-3 mb-1">
              <div className="font-bold text-navy text-sm">{e.action}</div>
              <Badge tone="ok">{e.category}</Badge>
            </div>
            <div className="text-xs text-muted mb-1">{e.detail}</div>
            <div className="text-[11px] text-muted flex flex-wrap gap-3">
              <span>{e.actor}</span>
              <span>{new Date(e.createdAt).toLocaleString()}</span>
              <span className="font-mono">{e.hash.slice(0, 16)}…</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
