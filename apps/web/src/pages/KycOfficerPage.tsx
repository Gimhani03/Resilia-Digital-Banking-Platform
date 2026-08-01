import { useEffect, useState } from "react";
import { Badge, Button, Card } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type KycDoc = {
  id: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  previewDataUrl?: string;
};

type KycCase = {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  address: string;
  kycStatus: string;
  createdAt: string;
  documentCount: number;
  documents?: KycDoc[];
};

const FILTERS = ["PENDING_REVIEW", "VERIFIED", "REJECTED", "ALL"] as const;

export default function KycOfficerPage() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("PENDING_REVIEW");
  const [queue, setQueue] = useState<KycCase[]>([]);
  const [selected, setSelected] = useState<KycCase | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(preferredId?: string) {
    setError("");
    const rows = await api<KycCase[]>(
      `/ops/kyc?status=${encodeURIComponent(filter)}`,
      { token },
    );
    setQueue(rows);
    const keep =
      rows.find((r) => r.userId === (preferredId || selected?.userId)) ||
      rows[0] ||
      null;
    if (keep) {
      const detail = await api<KycCase>(`/ops/kyc/${keep.userId}`, { token });
      setSelected(detail);
    } else {
      setSelected(null);
    }
  }

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load KYC queue"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  async function selectRow(userId: string) {
    setMsg("");
    setError("");
    const detail = await api<KycCase>(`/ops/kyc/${userId}`, { token });
    setSelected(detail);
  }

  async function decide(status: "VERIFIED" | "REJECTED") {
    if (!selected) return;
    if (!note.trim()) {
      setError("Add a decision note before approving or rejecting");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await api(`/ops/kyc/${selected.userId}/decide`, {
        method: "POST",
        token,
        body: JSON.stringify({ status, note: note.trim() }),
      });
      setMsg(
        status === "VERIFIED"
          ? "KYC approved · customer notified · banking unlocked"
          : "KYC rejected · customer notified",
      );
      setNote("");
      await load(selected.userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="font-display text-[28px] text-navy mb-1">KYC review</h1>
          <p className="text-muted text-[13px]">
            Review ID photo + liveness selfie, then approve or reject. No third-party
            vendor — officer decision unlocks banking.
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
              {f.replace("_", " ")}
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
          {queue.map((c) => (
            <button
              key={c.userId}
              type="button"
              onClick={() => selectRow(c.userId)}
              className={`w-full text-left p-3 rounded-xl mb-2 border ${
                selected?.userId === c.userId
                  ? "border-crimson bg-crimson-soft"
                  : "border-line"
              }`}
            >
              <div className="flex justify-between gap-2 items-start">
                <div className="font-bold text-sm text-navy">{c.fullName}</div>
                <Badge
                  tone={
                    c.kycStatus === "PENDING_REVIEW"
                      ? "warn"
                      : c.kycStatus === "VERIFIED"
                        ? "ok"
                        : "danger"
                  }
                >
                  {c.kycStatus.replace("_", " ")}
                </Badge>
              </div>
              <div className="text-xs text-muted mt-1">@{c.username}</div>
              <div className="text-[11px] text-muted mt-1">
                {c.documentCount} doc(s) · {new Date(c.createdAt).toLocaleString()}
              </div>
            </button>
          ))}
          {queue.length === 0 && (
            <div className="text-sm text-muted p-3">No cases in this filter</div>
          )}
        </div>

        {selected ? (
          <Card className="!mb-0">
            <div className="flex justify-between items-start mb-4 gap-3">
              <div>
                <h2 className="text-xl font-bold text-navy">{selected.fullName}</h2>
                <div className="text-sm text-muted">
                  @{selected.username} · {selected.email} · {selected.phone}
                </div>
                <div className="text-xs text-muted mt-1">
                  NIC {selected.nationalId}
                  {selected.address ? ` · ${selected.address}` : ""}
                </div>
              </div>
              <Badge
                tone={
                  selected.kycStatus === "PENDING_REVIEW"
                    ? "warn"
                    : selected.kycStatus === "VERIFIED"
                      ? "ok"
                      : "danger"
                }
              >
                {selected.kycStatus.replace("_", " ")}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(selected.documents || []).map((d) => (
                <div key={d.id} className="border border-line rounded-xl p-3 bg-surface">
                  <div className="text-xs font-extrabold uppercase text-muted mb-2">
                    {d.documentType === "SELFIE_LIVENESS" ? "Liveness selfie" : d.documentType}
                  </div>
                  {d.previewDataUrl ? (
                    <img
                      src={d.previewDataUrl}
                      alt={d.documentType}
                      className="w-full max-h-56 object-contain rounded-lg bg-white border border-line"
                    />
                  ) : (
                    <div className="text-xs text-muted py-8 text-center">
                      Preview unavailable · {Math.round(d.sizeBytes / 1024)} KB stored
                    </div>
                  )}
                  <div className="text-[11px] text-muted mt-2">
                    {d.mimeType} · {Math.round(d.sizeBytes / 1024)} KB
                  </div>
                </div>
              ))}
              {(selected.documents || []).length === 0 && (
                <div className="col-span-2 text-sm text-muted">No documents on file</div>
              )}
            </div>

            {selected.kycStatus === "PENDING_REVIEW" ? (
              <>
                <label className="block text-xs font-bold text-muted mb-1.5">
                  Decision note
                </label>
                <textarea
                  className="w-full border border-line rounded-xl p-3 text-sm text-navy min-h-[88px] mb-3 bg-white"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. ID clear and selfie matches · approve"
                />
                <div className="flex gap-3">
                  <Button disabled={busy} onClick={() => decide("VERIFIED")}>
                    Approve KYC
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => decide("REJECTED")}
                  >
                    Reject KYC
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-3.5 rounded-xl border border-line bg-surface text-sm text-navy">
                This case is already <strong>{selected.kycStatus.replace("_", " ")}</strong>.
              </div>
            )}
          </Card>
        ) : (
          <div className="bg-white border border-line rounded-[18px] p-8 text-muted text-sm">
            Select a KYC case from the queue.
          </div>
        )}
      </div>
    </div>
  );
}
