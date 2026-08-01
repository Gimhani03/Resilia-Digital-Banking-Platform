import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Content,
  Field,
  HeroTitle,
  Input,
  Sub,
} from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Account = { id: string; mask: string; frozen: boolean };
type CardT = { id: string; label: string; mask: string; frozen: boolean };
type Dispute = {
  id: string;
  transactionId?: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
};

export default function FreezeDisputePage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CardT[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reason, setReason] = useState("Unrecognized merchant charge");
  const [msg, setMsg] = useState("");

  async function refresh() {
    const [a, c, d] = await Promise.all([
      api<Account[]>("/accounts", { token }),
      api<CardT[]>("/cards", { token }),
      api<Dispute[]>("/payments/disputes", { token }).catch(() => []),
    ]);
    setAccounts(a);
    setCards(c);
    setDisputes(d);
  }

  useEffect(() => {
    refresh();
  }, [token]);

  async function freezeCard(id: string) {
    await api(`/cards/${id}/freeze`, { method: "POST", token });
    setMsg("Card frozen · audit log updated");
    refresh();
  }

  async function freezeAccount(id: string) {
    await api(`/accounts/${id}/freeze`, { method: "POST", token });
    setMsg("Account frozen · audit log updated");
    refresh();
  }

  async function dispute() {
    await api("/payments/disputes", {
      method: "POST",
      token,
      body: JSON.stringify({ reason }),
    });
    setMsg("Dispute raised · immutable audit entry written");
    refresh();
  }

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">Security</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <HeroTitle className="!text-[26px]">Freeze & dispute</HeroTitle>
        <Sub>
          Instantly freeze a card or the entire account, or raise a dispute (FR-15).
        </Sub>

        {msg && (
          <Card className="!bg-ok-soft !border-ok/20 text-ok text-sm font-bold">{msg}</Card>
        )}

        <Card>
          <div className="font-bold text-navy mb-3">Cards</div>
          {cards.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-2 border-b border-line last:border-0">
              <div>
                <div className="text-sm font-bold">{c.label}</div>
                <div className="text-xs text-muted">
                  {c.mask} · {c.frozen ? "Frozen" : "Active"}
                </div>
              </div>
              <Button
                variant="secondary"
                className="!w-auto !py-2 !px-3 !text-xs"
                disabled={c.frozen}
                onClick={() => freezeCard(c.id)}
              >
                Freeze
              </Button>
            </div>
          ))}
        </Card>

        <Card>
          <div className="font-bold text-navy mb-3">Accounts</div>
          {accounts.map((a) => (
            <div key={a.id} className="flex justify-between items-center py-2">
              <div className="text-sm font-bold">{a.mask}</div>
              <Button
                variant="secondary"
                className="!w-auto !py-2 !px-3 !text-xs"
                disabled={a.frozen}
                onClick={() => freezeAccount(a.id)}
              >
                {a.frozen ? "Frozen" : "Freeze account"}
              </Button>
            </div>
          ))}
        </Card>

        <Card>
          <div className="font-bold text-navy mb-3">Raise dispute</div>
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button onClick={dispute}>Submit dispute</Button>
        </Card>

        <div className="font-bold text-navy mb-2 text-sm">Your disputes</div>
        {disputes.length === 0 && (
          <div className="text-xs text-muted mb-4">No disputes yet.</div>
        )}
        {disputes.map((d) => (
          <Card key={d.id}>
            <div className="flex justify-between gap-2 items-start">
              <div className="text-sm font-bold text-navy">{d.reason}</div>
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
            <div className="text-xs text-muted mt-1">
              {new Date(d.createdAt).toLocaleString()}
            </div>
            {d.resolution && (
              <div className="text-xs text-navy mt-2 font-semibold">
                Officer: {d.resolution}
              </div>
            )}
          </Card>
        ))}
      </Content>
    </>
  );
}
