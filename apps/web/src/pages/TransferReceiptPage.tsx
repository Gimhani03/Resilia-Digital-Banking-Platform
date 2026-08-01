import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader, Badge, Button, Card, Content, HeroTitle, Sub } from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type Txn = {
  id: string;
  reference: string;
  counterparty: string;
  amount: number;
  fee: number;
  status: string;
  settledAt?: string;
};

export default function TransferReceiptPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [txn, setTxn] = useState<Txn | null>(null);

  useEffect(() => {
    if (id) api<Txn>(`/payments/${id}`, { token }).then(setTxn);
  }, [id, token]);

  return (
    <>
      <AppHeader
        left={<Link to="/app" className="text-crimson text-[13px] font-bold">Done</Link>}
        center={<div className="font-extrabold text-navy">Receipt</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <div className="text-center my-6">
          <div className="w-16 h-16 rounded-full bg-ok-soft text-ok grid place-items-center text-2xl mx-auto mb-3 font-bold">
            ✓
          </div>
          <HeroTitle className="!text-[26px]">Transfer settled</HeroTitle>
          <Sub>Saga completed · balances updated · audit event chained</Sub>
        </div>
        <Card>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted">Amount</span>
            <strong>{txn ? formatLkr(txn.amount) : "…"}</strong>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted">Fee</span>
            <strong>{txn ? formatLkr(txn.fee) : "…"}</strong>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted">To</span>
            <strong className="text-right max-w-[60%]">{txn?.counterparty}</strong>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-muted">Reference</span>
            <strong>{txn?.reference}</strong>
          </div>
          <div className="flex justify-between py-2 text-sm items-center">
            <span className="text-muted">Status</span>
            <Badge>{txn?.status || "…"}</Badge>
          </div>
        </Card>
        <Button onClick={() => (window.location.href = "/app")}>Back to home</Button>
      </Content>
    </>
  );
}
