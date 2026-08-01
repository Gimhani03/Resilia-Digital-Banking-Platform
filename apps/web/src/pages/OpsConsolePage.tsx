import { useEffect, useState } from "react";
import { Badge } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Overview = {
  uptime: string;
  txnPerMin: number;
  activeFraudHolds: number;
  highPriorityHolds: number;
  openDisputes?: number;
  pendingKyc?: number;
  rpoMinutes: number;
  rtoMinutes: number;
  services: { name: string; latencyMs: number | null; status: string }[];
  alerts: { severity: "HIGH" | "MED" | "LOW"; title: string; detail: string }[];
};

export default function OpsConsolePage() {
  const { token } = useAuth();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api<Overview>("/ops/overview", { token }).then(setData);
  }, [token]);

  const tone = (s: string) =>
    s === "Healthy" || s === "Sealed" ? "ok" : s === "Degraded" ? "warn" : "danger";

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="font-display text-[28px] text-navy">Fraud & Security Operations</h1>
          <p className="text-muted text-[13px] mt-1">
            Live visibility into uptime, per-service health, fraud alerts, and DR readiness
          </p>
        </div>
        <Badge>● All core services online</Badge>
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-4">
        {[
          { k: "Platform uptime", v: data?.uptime ?? "…", s: "30-day rolling", ok: true },
          {
            k: "Pending KYC",
            v: String(data?.pendingKyc ?? "…"),
            s: "Identity cases awaiting review",
            warn: (data?.pendingKyc ?? 0) > 0,
            ok: (data?.pendingKyc ?? 0) === 0,
          },
          {
            k: "Active fraud holds",
            v: String(data?.activeFraudHolds ?? "…"),
            s: `${data?.highPriorityHolds ?? 0} high priority`,
            warn: true,
          },
          {
            k: "Open disputes",
            v: String(data?.openDisputes ?? "…"),
            s: "Customer cases awaiting review",
            warn: (data?.openDisputes ?? 0) > 0,
            ok: (data?.openDisputes ?? 0) === 0,
          },
        ].map((kpi) => (
          <div key={kpi.k} className="bg-white border border-line rounded-2xl p-4">
            <div className="text-xs text-muted font-bold mb-2">{kpi.k}</div>
            <div className="font-display text-[28px] text-navy">{kpi.v}</div>
            <div
              className={`text-[11px] mt-1.5 font-bold ${
                kpi.ok ? "text-ok" : kpi.warn ? "text-warn" : "text-muted"
              }`}
            >
              {kpi.s}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-3.5">
        <div className="bg-white border border-line rounded-[18px] p-4">
          <h3 className="text-sm text-navy font-bold mb-3">Microservice health</h3>
          {(data?.services || []).map((s) => (
            <div
              key={s.name}
              className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-center py-2.5 border-b border-line last:border-0 text-[13px]"
            >
              <span className="font-bold text-navy">{s.name}</span>
              <span className="text-muted text-xs">
                {s.latencyMs == null ? "—" : `${s.latencyMs} ms`}
              </span>
              <Badge tone={tone(s.status) as "ok" | "warn" | "danger"}>{s.status}</Badge>
            </div>
          ))}
        </div>
        <div className="bg-white border border-line rounded-[18px] p-4">
          <h3 className="text-sm text-navy font-bold mb-3">Active fraud alerts</h3>
          {(data?.alerts || []).map((a) => (
            <div key={a.title} className="flex gap-2.5 p-3 rounded-xl bg-surface mb-2 text-xs">
              <Badge tone={a.severity === "HIGH" ? "danger" : "warn"}>{a.severity}</Badge>
              <div>
                <strong className="block text-navy mb-0.5">{a.title}</strong>
                <span className="text-muted">{a.detail}</span>
              </div>
            </div>
          ))}
          <div className="mt-3 p-3.5 rounded-[14px] bg-ok-soft border border-ok/20">
            <strong className="text-ok block mb-1">
              ● Disaster recovery · warm standby Region B
            </strong>
            <span className="text-xs text-muted">
              Continuous replication healthy. Automated failover armed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
