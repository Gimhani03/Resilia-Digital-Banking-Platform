import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AppHeader,
  Button,
  Card,
  Content,
  Field,
  HeroTitle,
  Input,
  SectionLabel,
  Sub,
} from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Account = { id: string; label: string; mask: string };
type Txn = { id: string; status: string };

export default function PaymentsPage() {
  const { token } = useAuth();
  const nav = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [tab, setTab] = useState<"BILL" | "QR">("BILL");
  const [biller, setBiller] = useState("CEB Electricity");
  const [amount, setAmount] = useState("6890");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Account[]>("/accounts", { token }).then((a) => {
      setAccounts(a);
      setAccountId(a[0]?.id || "");
    });
  }, [token]);

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const res = await api<Txn>("/payments/bill", {
        method: "POST",
        token,
        body: JSON.stringify({
          accountId,
          biller: tab === "QR" ? `QR · ${biller}` : biller,
          amount: Number(amount),
          method: tab,
        }),
      });
      if (res.status === "HELD") nav(`/app/held/${res.id}`);
      else nav(`/app/transfer/receipt/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppHeader
        left={
          <div className="flex items-center gap-2">
            <div className="font-extrabold text-navy">Pay</div>
          </div>
        }
        right={
          <Link to="/app/history" className="text-crimson text-[13px] font-bold">
            History
          </Link>
        }
      />
      <Content>
        <HeroTitle className="!text-[26px]">Bills & QR</HeroTitle>
        <Sub>Pay utilities or scan a merchant QR from your linked account (FR-06).</Sub>

        <div className="flex gap-2 mb-4">
          {(["BILL", "QR"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setBiller(t === "BILL" ? "CEB Electricity" : "Keells Super");
              }}
              className={`px-3 py-2 rounded-full text-xs font-bold border-[1.5px] ${
                tab === t ? "bg-navy text-white border-navy" : "bg-white border-line text-navy"
              }`}
            >
              {t === "BILL" ? "Utility bill" : "Merchant QR"}
            </button>
          ))}
        </div>

        <Card>
          <SectionLabel>{tab === "BILL" ? "Biller" : "Merchant"}</SectionLabel>
          <Field label="Name">
            <Input value={biller} onChange={(e) => setBiller(e.target.value)} />
          </Field>
          <Field label="Amount (LKR)">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="From">
            <select
              className="w-full border-[1.5px] border-line rounded-[14px] px-3.5 py-3.5 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} {a.mask}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        {error && <p className="text-crimson text-sm mb-3">{error}</p>}
        <Button disabled={loading} onClick={pay}>
          {loading ? "Processing…" : tab === "QR" ? "Pay QR" : "Pay bill"}
        </Button>
      </Content>
    </>
  );
}
