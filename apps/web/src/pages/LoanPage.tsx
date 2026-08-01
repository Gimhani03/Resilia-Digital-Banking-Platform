import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AppHeader,
  Button,
  Card,
  Content,
  Field,
  HeroTitle,
  Input,
  Select,
  Sub,
} from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type Estimate = {
  eligibilityScore: number;
  dti: number;
  aiRecommendation: string;
  fraudFlags: string[];
};

export default function LoanPage() {
  const { token } = useAuth();
  const [product, setProduct] = useState<"PERSONAL" | "BUSINESS">("PERSONAL");
  const [amount, setAmount] = useState("350000");
  const [tenureMonths, setTenureMonths] = useState("24");
  const [income, setIncome] = useState("185000");
  const [purpose, setPurpose] = useState("Home renovation");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [done, setDone] = useState("");

  const amt = Number(amount) || 0;
  const tenure = Number(tenureMonths) || 1;
  const monthlyIncome = Number(income) || 1;

  async function runEstimate() {
    const res = await api<Estimate>("/loans/estimate", {
      method: "POST",
      token,
      body: JSON.stringify({ amount: amt, tenureMonths: tenure, monthlyIncome }),
    });
    setEstimate(res);
  }

  async function apply() {
    const res = await api<{ id: string }>("/loans/apply", {
      method: "POST",
      token,
      body: JSON.stringify({
        product,
        amount: amt,
        tenureMonths: tenure,
        purpose,
        monthlyIncome,
      }),
    });
    setDone(`Application ${res.id.slice(-6)} submitted to Credit Desk`);
  }

  return (
    <>
      <AppHeader
        left={
          <Link to="/app" className="text-crimson text-[13px] font-bold">
            ← Back
          </Link>
        }
        center={<div className="font-extrabold text-navy">Loans</div>}
        right={<span className="w-10" />}
      />
      <Content>
        <HeroTitle className="!text-[26px]">Apply for credit</HeroTitle>
        <Sub>Guided form with real-time AI eligibility estimate (FR-07).</Sub>

        <Field label="Product">
          <Select
            value={product}
            onChange={(e) => setProduct(e.target.value as "PERSONAL" | "BUSINESS")}
          >
            <option value="PERSONAL">Personal loan</option>
            <option value="BUSINESS">Business loan</option>
          </Select>
        </Field>
        <Field label="Amount (LKR)">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Tenure (months)">
          <Input value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
        </Field>
        <Field label="Monthly income (LKR)">
          <Input value={income} onChange={(e) => setIncome(e.target.value)} />
        </Field>
        <Field label="Purpose">
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>

        <Button variant="secondary" onClick={runEstimate}>
          Refresh AI estimate
        </Button>

        <div className="mt-4 p-4 rounded-[18px] border-[1.5px] border-crimson/20 bg-gradient-to-br from-white to-crimson-soft">
          <div className="text-xs font-bold text-muted mb-1">Eligibility score</div>
          <div className="font-display text-[42px] text-crimson leading-none">
            {estimate?.eligibilityScore ?? "—"}
          </div>
          <div className="h-2 bg-line rounded-full overflow-hidden my-3">
            <i
              className="block h-full bg-gradient-to-r from-crimson to-[#f43f5e]"
              style={{ width: `${estimate?.eligibilityScore ?? 0}%` }}
            />
          </div>
          <div className="text-xs text-muted">
            {estimate
              ? `${estimate.aiRecommendation} · DTI ${estimate.dti}`
              : `Indicative for ${formatLkr(amt)} over ${tenure} months`}
          </div>
        </div>

        {done && <Card className="!bg-ok-soft text-ok font-bold text-sm mt-3">{done}</Card>}
        <Button className="mt-3" onClick={apply}>
          Submit application
        </Button>
      </Content>
    </>
  );
}
