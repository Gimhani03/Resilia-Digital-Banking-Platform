import { useEffect, useState } from "react";
import { Badge, Button, Card } from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type DisputeRow = {
  id: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  customer?: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    nic: string;
  };
  transaction?: {
    id: string;
    reference: string;
    counterparty: string;
    category: string;
    amount: number;
    fee: number;
    direction: string;
    status: string;
    note: string;
    createdAt: string;
    account?: { id: string; mask: string; label: string; nickname: string };
  };
  accounts?: {
    id: string;
    label: string;
    nickname: string;
    mask: string;
    type: string;
    balance: number;
    frozen: boolean;
  }[];
  cards?: {
    id: string;
    label: string;
    mask: string;
    type: string;
    frozen: boolean;
  }[];
  refunded?: boolean;
};

const FILTERS = ["OPEN", "RESOLVED", "REJECTED", "ALL"] as const;

export default function DisputeOfficerPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("OPEN");
  const [queue, setQueue] = useState<DisputeRow[]>([]);
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(preferredId?: string) {
    setError("");
    const rows = await api<DisputeRow[]>(
      `/ops/disputes?status=${encodeURIComponent(filter)}`,
      { token },
    );
    setQueue(rows);
    const keep =
      rows.find((r) => r.id === (preferredId || selected?.id)) || rows[0] || null;
    if (keep) {
      const detail = await api<DisputeRow>(`/ops/disputes/${keep.id}`, { token });
      setSelected(detail);
    } else {
      setSelected(null);
    }
  }

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load disputes"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  async function selectRow(id: string) {
    setMsg("");
    setError("");
    const detail = await api<DisputeRow>(`/ops/disputes/${id}`, { token });
    setSelected(detail);
    setResolution(detail.resolution || "");
  }

  async function decide(status: "RESOLVED" | "REJECTED") {
    if (!selected) return;
    if (!resolution.trim()) {
      setError("Add a resolution note before deciding");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await api<DisputeRow>(`/ops/disputes/${selected.id}/decide`, {
        method: "POST",
        token,
        body: JSON.stringify({
          status,
          resolution: resolution.trim(),
          refund: status === "RESOLVED" ? refund : false,
        }),
      });
      setMsg(
        status === "RESOLVED"
          ? res.refunded
            ? "Dispute upheld · refund credited · customer notified"
            : "Dispute upheld · customer notified"
          : "Dispute rejected · customer notified",
      );
      await load(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  async function freeze(target: "card" | "account", targetId: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/ops/disputes/${selected.id}/freeze`, {
        method: "POST",
        token,
        body: JSON.stringify({ target, targetId }),
      });
      setMsg(
        target === "card"
          ? "Card frozen · customer notified"
          : "Account frozen · customer notified",
      );
      await selectRow(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Freeze failed");
    } finally {
      setBusy(false);
    }
  }

  const canRefund =
    selected?.transaction?.status === "SETTLED" &&
    selected?.transaction?.direction === "OUT";

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="font-display text-[28px] text-navy mb-1">
            Dispute review
          </h1>
          <p className="text-muted text-[13px]">
            Review customer disputes, uphold with optional refund, reject with a
            note, or freeze cards/accounts from the case.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold tracking-wide ${
                filter === f
                  ? "bg-navy text-white"
                  : "bg-white border border-line text-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="mb-3 p-3 rounded-xl bg-ok-soft border border-ok/20 text-ok text-sm font-bold">
          {msg}
        </div>
      )}
      {error && (
        <div className="mb-3 p-3 rounded-xl bg-crimson-soft border border-crimson/20 text-crimson text-sm font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[300px_1fr] gap-4">
        <div className="bg-white border border-line rounded-[18px] p-3 max-h-[70vh] overflow-auto">
          <div className="text-xs font-extrabold uppercase text-muted mb-2">
            Queue · {queue.length}
          </div>
          {queue.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => selectRow(d.id)}
              className={`w-full text-left p-3 rounded-xl mb-2 border ${
                selected?.id === d.id
                  ? "border-crimson bg-crimson-soft"
                  : "border-line"
              }`}
            >
              <div className="flex justify-between gap-2 items-start">
                <div className="font-bold text-sm text-navy">
                  {d.customer?.fullName || "Customer"}
                </div>
                <Badge
                  tone={
                    d.status === "OPEN"
                      ? "warn"
                      : d.status === "RESOLVED"
                        ? "ok"
                        : "danger"
                  }
                >
                  {d.status}
                </Badge>
              </div>
              <div className="text-xs text-muted mt-1 line-clamp-2">{d.reason}</div>
              <div className="text-[11px] text-muted mt-1">
                {new Date(d.createdAt).toLocaleString()}
                {d.transaction
                  ? ` · ${formatLkr(d.transaction.amount)}`
                  : ""}
              </div>
            </button>
          ))}
          {queue.length === 0 && (
            <div className="text-sm text-muted p-3">No disputes in this filter</div>
          )}
        </div>

        {selected ? (
          <Card className="!mb-0">
            <div className="flex justify-between items-start mb-4 gap-3">
              <div>
                <h2 className="text-xl font-bold text-navy">
                  {selected.customer?.fullName}
                </h2>
                <div className="text-sm text-muted">
                  {selected.customer?.email} · {selected.customer?.phone}
                </div>
                <div className="text-xs text-muted mt-1">
                  NIC {selected.customer?.nic} · Case {selected.id.slice(-8)}
                </div>
              </div>
              <Badge
                tone={
                  selected.status === "OPEN"
                    ? "warn"
                    : selected.status === "RESOLVED"
                      ? "ok"
                      : "danger"
                }
              >
                {selected.status}
              </Badge>
            </div>

            <div className="mb-4 p-3.5 rounded-xl bg-surface border border-line">
              <div className="text-xs font-bold text-muted mb-1">
                Customer reason
              </div>
              <div className="font-bold text-navy">{selected.reason}</div>
            </div>

            {selected.transaction ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface rounded-xl p-3">
                  <div className="text-xs text-muted">Amount</div>
                  <div className="font-display text-2xl">
                    {formatLkr(selected.transaction.amount)}
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    Fee {formatLkr(selected.transaction.fee)}
                  </div>
                </div>
                <div className="bg-surface rounded-xl p-3">
                  <div className="text-xs text-muted">Counterparty</div>
                  <div className="font-bold text-navy text-sm mt-1">
                    {selected.transaction.counterparty}
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    {selected.transaction.reference}
                  </div>
                </div>
                <div className="bg-surface rounded-xl p-3">
                  <div className="text-xs text-muted">Txn status</div>
                  <div className="font-bold text-navy text-sm mt-1">
                    {selected.transaction.status} · {selected.transaction.direction}
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    {selected.transaction.account?.mask} ·{" "}
                    {selected.transaction.category}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-xl border border-warn/30 bg-warn/10 text-sm text-navy">
                No linked transaction — uphold can close the case, but refund is
                unavailable.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-line rounded-xl p-3">
                <div className="text-xs font-extrabold uppercase text-muted mb-2">
                  Cards
                </div>
                {(selected.cards || []).map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center py-2 border-b border-line last:border-0 gap-2"
                  >
                    <div>
                      <div className="text-sm font-bold text-navy">{c.label}</div>
                      <div className="text-xs text-muted">
                        {c.mask} · {c.frozen ? "Frozen" : "Active"}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="!w-auto !py-1.5 !px-2.5 !text-[11px]"
                      disabled={c.frozen || busy || selected.status !== "OPEN"}
                      onClick={() => freeze("card", c.id)}
                    >
                      Freeze
                    </Button>
                  </div>
                ))}
                {(selected.cards || []).length === 0 && (
                  <div className="text-xs text-muted">No cards</div>
                )}
              </div>
              <div className="border border-line rounded-xl p-3">
                <div className="text-xs font-extrabold uppercase text-muted mb-2">
                  Accounts
                </div>
                {(selected.accounts || []).map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center py-2 border-b border-line last:border-0 gap-2"
                  >
                    <div>
                      <div className="text-sm font-bold text-navy">
                        {a.nickname || a.label} {a.mask}
                      </div>
                      <div className="text-xs text-muted">
                        {formatLkr(a.balance)}
                        {a.frozen ? " · Frozen" : ""}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="!w-auto !py-1.5 !px-2.5 !text-[11px]"
                      disabled={a.frozen || busy || selected.status !== "OPEN"}
                      onClick={() => freeze("account", a.id)}
                    >
                      Freeze
                    </Button>
                  </div>
                ))}
                {(selected.accounts || []).length === 0 && (
                  <div className="text-xs text-muted">No accounts</div>
                )}
              </div>
            </div>

            {selected.status === "OPEN" ? (
              <>
                <label className="block text-xs font-bold text-muted mb-1.5">
                  Resolution note
                </label>
                <textarea
                  className="w-full border border-line rounded-xl p-3 text-sm text-navy min-h-[88px] mb-3 bg-white"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Explain the decision for the customer and audit trail"
                />
                <label className="flex items-center gap-2 text-sm text-navy mb-4">
                  <input
                    type="checkbox"
                    checked={refund && canRefund}
                    disabled={!canRefund}
                    onChange={(e) => setRefund(e.target.checked)}
                  />
                  Credit refund on uphold
                  {!canRefund && (
                    <span className="text-xs text-muted">
                      (needs settled outbound txn)
                    </span>
                  )}
                </label>
                <div className="flex gap-3">
                  <Button disabled={busy} onClick={() => decide("RESOLVED")}>
                    Uphold customer
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => decide("REJECTED")}
                  >
                    Reject dispute
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-3.5 rounded-xl border border-line bg-surface">
                <div className="text-xs font-bold text-muted mb-1">
                  Officer resolution
                </div>
                <div className="font-bold text-navy">
                  {selected.resolution || "—"}
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div className="bg-white border border-line rounded-[18px] p-8 text-muted text-sm">
            Select a dispute from the queue to review.
          </div>
        )}
      </div>
    </div>
  );
}
