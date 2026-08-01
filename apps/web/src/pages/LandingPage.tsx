import { Link } from "react-router-dom";
import { BrandMark } from "../components/ui";

export default function LandingPage() {
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BrandMark />
        <div>
          <div className="font-extrabold tracking-wide text-navy">RESILIA</div>
          <div className="text-xs text-muted font-semibold">
            Duothan 6.0 · Team Cybernauts · Pragmatic MVP
          </div>
        </div>
      </div>
      <h1 className="font-display text-5xl text-navy mb-3">Secure banking after the breach</h1>
      <p className="text-muted max-w-xl leading-relaxed mb-8">
        Customer banking runs as a <strong>React Native</strong> app
        (<code>npm run dev:mobile</code>). This web hub is for staff ops,
        loan review, audit trail, and the USSD inclusion demo.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { to: "/ops", title: "Ops console", desc: "Health, fraud, DR readiness (FR-12)" },
          { to: "/ops/loans", title: "Loan officer", desc: "Approve / reject with AI context" },
          { to: "/ops/audit", title: "Audit trail", desc: "Hash-chained immutable log (FR-13)" },
          { to: "/ussd", title: "USSD & agent", desc: "Inclusion channel demo (FR-11)" },
          { to: "/signin", title: "Web preview (legacy)", desc: "Optional web mirror · prefer Expo app" },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="bg-white border border-line rounded-[18px] p-5 shadow-[0_10px_30px_rgba(26,26,46,0.06)] hover:-translate-y-0.5 transition"
          >
            <div className="text-xs font-extrabold text-crimson tracking-widest mb-2">OPEN</div>
            <h2 className="text-lg text-navy font-bold mb-1">{c.title}</h2>
            <p className="text-sm text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
