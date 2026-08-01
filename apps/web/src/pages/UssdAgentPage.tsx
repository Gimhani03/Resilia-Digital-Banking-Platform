import { Link } from "react-router-dom";
import { BrandMark, Button, Card } from "../components/ui";

export default function UssdAgentPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto grid md:grid-cols-2 gap-6 items-start">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BrandMark />
          <div className="font-extrabold text-navy">USSD & Agent</div>
        </div>
        <h1 className="font-display text-4xl text-navy mb-3">Inclusion channel</h1>
        <p className="text-muted leading-relaxed mb-4">
          Feature-phone USSD menu and agent cash-in for users without smartphones
          or reliable data (FR-11). This screen is a demo shell — production would
          connect to an Africa&apos;s Talking-style gateway.
        </p>
        <Link to="/">
          <Button variant="secondary" className="!w-auto">
            ← Demo hub
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <Card className="!bg-navy !text-white !border-none font-mono text-sm leading-relaxed">
          <div className="opacity-70 mb-2">*#2065#</div>
          <div>RESILIA USSD</div>
          <div className="mt-3">1. Balance</div>
          <div>2. Send money</div>
          <div>3. Mini statement</div>
          <div>4. Agent cash-in</div>
          <div>0. Exit</div>
          <div className="mt-4 opacity-70">Reply with option:</div>
        </Card>
        <Card>
          <div className="font-bold text-navy mb-2">Agent terminal</div>
          <div className="text-sm text-muted mb-3">
            Agent ID AG-4421 · Branch: Kandy East
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-surface rounded-xl p-3">
              <div className="text-xs text-muted">Customer</div>
              <div className="font-bold">Amal Perera</div>
            </div>
            <div className="bg-surface rounded-xl p-3">
              <div className="text-xs text-muted">Cash-in</div>
              <div className="font-bold">LKR 5,000.00</div>
            </div>
          </div>
          <Button className="mt-3">Confirm cash-in</Button>
        </Card>
      </div>
    </div>
  );
}
