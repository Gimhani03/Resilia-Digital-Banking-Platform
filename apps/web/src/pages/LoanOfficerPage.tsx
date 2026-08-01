import { useEffect, useState } from "react";
import { Badge, Button, Card } from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type Loan = {
  id: string;
  product: string;
  amount: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  eligibilityScore: number;
  dti: number;
  fraudFlags: string[];
  aiRecommendation: string;
  applicantName: string;
};

export default function LoanOfficerPage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<Loan[]>([]);
  const [selected, setSelected] = useState<Loan | null>(null);

  async function load() {
    const rows = await api<Loan[]>("/loans/queue", { token });
    setQueue(rows);
    setSelected(rows[0] || null);
  }

  useEffect(() => {
    load();
  }, [token]);

  async function decide(status: "APPROVED" | "REJECTED") {
    if (!selected) return;
    await api(`/loans/${selected.id}/decide`, {
      method: "POST",
      token,
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-[28px] text-navy mb-1">Loan officer review</h1>
      <p className="text-muted text-[13px] mb-5">
        Approve or reject with full applicant and risk-scoring context (FR-08).
      </p>
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <div className="bg-white border border-line rounded-[18px] p-3">
          <div className="text-xs font-extrabold uppercase text-muted mb-2">Queue</div>
          {queue.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelected(l)}
              className={`w-full text-left p-3 rounded-xl mb-2 border ${
                selected?.id === l.id ? "border-crimson bg-crimson-soft" : "border-line"
              }`}
            >
              <div className="font-bold text-sm text-navy">{l.applicantName}</div>
              <div className="text-xs text-muted">
                {formatLkr(l.amount)} · score {l.eligibilityScore}
              </div>
            </button>
          ))}
          {queue.length === 0 && (
            <div className="text-sm text-muted p-3">No pending applications</div>
          )}
        </div>
        {selected && (
          <Card className="!mb-0">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-navy">{selected.applicantName}</h2>
                <div className="text-sm text-muted">
                  {selected.product} · {selected.purpose} · {selected.tenureMonths} mo
                </div>
              </div>
              <Badge>{selected.status}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-surface rounded-xl p-3">
                <div className="text-xs text-muted">Amount</div>
                <div className="font-display text-2xl">{formatLkr(selected.amount)}</div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-xs text-muted">Eligibility</div>
                <div className="font-display text-2xl text-crimson">
                  {selected.eligibilityScore}
                </div>
              </div>
              <div className="bg-surface rounded-xl p-3">
                <div className="text-xs text-muted">DTI</div>
                <div className="font-display text-2xl">{selected.dti}</div>
              </div>
            </div>
            <div className="mb-4 p-3 rounded-xl border border-crimson/20 bg-gradient-to-br from-white to-crimson-soft">
              <div className="text-xs font-bold text-muted mb-1">AI recommendation</div>
              <div className="font-bold text-navy">{selected.aiRecommendation}</div>
              {selected.fraudFlags.length > 0 && (
                <div className="text-xs text-crimson mt-2">
                  Flags: {selected.fraudFlags.join(", ")}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => decide("APPROVED")}>Approve</Button>
              <Button variant="secondary" onClick={() => decide("REJECTED")}>
                Reject
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
