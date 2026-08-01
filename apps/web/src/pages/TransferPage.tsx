import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type Account = { id: string; label: string; mask: string; balance: number };
type Txn = {
  id: string;
  status: string;
  amount: number;
  fee: number;
  riskScore?: number;
  riskReason?: string;
  screening?: { held: boolean; riskScore: number; reason: string };
};

export default function TransferPage() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [counterparty, setCounterparty] = useState("Nimal Fernando · People’s Bank ****3190");
  const [amount, setAmount] = useState("25000");
  const [forceHold, setForceHold] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Txn | null>(null);

  useEffect(() => {
    api<Account[]>("/accounts", { token }).then((a) => {
      setAccounts(a);
      setAccountId(a[0]?.id || "");
    });
  }, [token]);

  const fee = 25;
  const amt = Number(amount) || 0;

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      const res = await api<Txn>("/payments/transfer", {
        method: "POST",
        token,
        body: JSON.stringify({
          accountId,
          counterparty,
          amount: amt,
          forceHold,
        }),
      });
      setPreview(res);
      if (res.status === "HELD" || res.screening?.held) {
        nav(`/app/held/${res.id}`);
      } else {
        nav(`/app/transfer/receipt/${res.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  const account = accounts.find((a) => a.id === accountId);

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">Transfer</div>}
        right={<span className="w-12" />}
      />
      <Content>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`flex-1 h-1.5 rounded-full ${i <= 3 ? "bg-crimson" : "bg-line"}`}
            />
          ))}
        </div>
        <HeroTitle className="!text-[26px]">Review & confirm</HeroTitle>
        <Sub>
          Fraud check and settlement details are shown before you authorize with MFA.
        </Sub>

        <Card>
          <div className="text-xs font-extrabold uppercase tracking-wider text-muted mb-2">
            Recipient
          </div>
          <Field label="Payee">
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </Field>
        </Card>

        <Field label="Amount (LKR)">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="!text-[22px] !font-extrabold font-display"
          />
        </Field>

        <Field label="From account">
          <select
            className="w-full border-[1.5px] border-line rounded-[14px] px-3.5 py-3.5 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} {a.mask} · {formatLkr(a.balance)}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-xs font-bold text-navy mb-3">
          <input
            type="checkbox"
            checked={forceHold}
            onChange={(e) => setForceHold(e.target.checked)}
          />
          Demo: force fraud hold (FR-09)
        </label>

        <div className="bg-surface rounded-2xl p-3.5 my-3.5">
          <div className="flex justify-between text-[13px] py-1.5 text-muted">
            <span>Transfer fee</span>
            <strong className="text-navy">{formatLkr(fee)}</strong>
          </div>
          <div className="flex justify-between text-[13px] py-1.5 text-muted">
            <span>Settlement</span>
            <strong className="text-navy">Instant · event saga</strong>
          </div>
          <div className="flex justify-between text-[13px] py-1.5 text-muted items-center">
            <span>Fraud screening</span>
            <Badge tone={forceHold ? "warn" : "ok"}>
              ● {forceHold ? "Likely hold" : "Pre-check"}
            </Badge>
          </div>
          <div className="flex justify-between text-[13px] py-1.5 text-muted">
            <span>Total debit</span>
            <strong className="text-navy">{formatLkr(amt + fee)}</strong>
          </div>
        </div>

        <Card className="!bg-ok-soft !border-ok/25 flex gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-ok mt-1.5 shadow-[0_0_0_4px_rgba(15,122,76,0.15)]" />
          <div>
            <strong className="block text-ok text-[13px] mb-1">
              Pre-settlement fraud check ready
            </strong>
            <span className="text-xs text-muted">
              From {account?.mask}. Transaction can still be frozen by Fraud & Risk
              before final settlement.
            </span>
          </div>
        </Card>

        {error && <p className="text-crimson text-sm mb-3">{error}</p>}
        <Button disabled={loading || !accountId} onClick={confirm}>
          {loading ? "Authorizing…" : "Confirm with MFA"}
        </Button>
        <Button variant="secondary" className="mt-2.5" onClick={() => nav("/app")}>
          Cancel transfer
        </Button>
        {preview && <p className="sr-only">{preview.id}</p>}
      </Content>
    </>
  );
}
