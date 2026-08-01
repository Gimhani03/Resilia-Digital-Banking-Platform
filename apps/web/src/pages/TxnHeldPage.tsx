import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Content,
  HeroTitle,
  Sub,
} from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type Txn = {
  id: string;
  reference: string;
  counterparty: string;
  amount: number;
  status: string;
  riskScore?: number;
  riskReason?: string;
};

export default function TxnHeldPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const nav = useNavigate();
  const [txn, setTxn] = useState<Txn | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) api<Txn>(`/payments/${id}`, { token }).then(setTxn);
  }, [id, token]);

  async function release() {
    setLoading(true);
    try {
      const res = await api<Txn>(`/payments/${id}/release`, {
        method: "POST",
        token,
      });
      nav(`/app/transfer/receipt/${res.id}`);
    } finally {
      setLoading(false);
    }
  }

  async function reject(freezeCard: boolean) {
    setLoading(true);
    try {
      await api(`/payments/${id}/reject`, {
        method: "POST",
        token,
        body: JSON.stringify({ freezeCard }),
      });
      nav("/app");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">Held</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <Badge tone="warn">● Held pending review</Badge>
        <HeroTitle className="!text-[26px] mt-3">Payment on hold</HeroTitle>
        <Sub>
          Fraud & Risk froze this transaction before settlement. Release with MFA or
          reject and freeze the card (FR-09).
        </Sub>

        <Card>
          <div className="font-display text-3xl text-navy mb-2">
            {txn ? formatLkr(txn.amount) : "…"}
          </div>
          <div className="text-sm text-navy font-bold">{txn?.counterparty}</div>
          <div className="text-xs text-muted mt-1">{txn?.reference}</div>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-muted">Risk score</span>
            <strong>{txn?.riskScore ?? "—"}/100</strong>
          </div>
          <div className="mt-2 text-xs text-muted">{txn?.riskReason}</div>
        </Card>

        <Button disabled={loading} onClick={release}>
          Release with MFA
        </Button>
        <Button
          variant="secondary"
          className="mt-2.5"
          disabled={loading}
          onClick={() => reject(true)}
        >
          Reject & freeze card
        </Button>
        <Button variant="ghost" className="w-full mt-1" disabled={loading} onClick={() => reject(false)}>
          Reject only
        </Button>
      </Content>
    </>
  );
}
