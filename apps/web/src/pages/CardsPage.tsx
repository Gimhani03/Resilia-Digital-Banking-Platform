import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader, Button, Card, Content, HeroTitle, Sub } from "../components/ui";
import { api, formatLkr } from "../lib/api";
import { useAuth } from "../lib/auth";

type CardT = {
  id: string;
  label: string;
  mask: string;
  type: string;
  frozen: boolean;
  dailyLimit: number;
  online: boolean;
  contactless: boolean;
  international: boolean;
};

export default function CardsPage() {
  const { token } = useAuth();
  const [cards, setCards] = useState<CardT[]>([]);

  async function load() {
    setCards(await api<CardT[]>("/cards", { token }));
  }

  useEffect(() => {
    load();
  }, [token]);

  async function toggle(card: CardT, key: "online" | "contactless" | "international") {
    await api(`/cards/${card.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ [key]: !card[key] }),
    });
    load();
  }

  async function freeze(id: string) {
    await api(`/cards/${id}/freeze`, { method: "POST", token });
    load();
  }

  const debit = cards.find((c) => c.type === "DEBIT") || cards[0];

  return (
    <>
      <AppHeader
        left={<div className="font-extrabold text-navy">Cards</div>}
        right={
          <Link to="/app/security" className="text-crimson text-[13px] font-bold">
            Security
          </Link>
        }
      />
      <Content>
        <HeroTitle className="!text-[26px]">Your cards</HeroTitle>
        <Sub>Controls, limits, and freeze entry point.</Sub>

        {debit && (
          <Card className="!bg-gradient-to-br from-navy to-[#4a1830] !border-none text-white mb-4">
            <div className="text-xs opacity-75 mb-8">{debit.label}</div>
            <div className="font-display text-2xl tracking-widest mb-2">{debit.mask}</div>
            <div className="flex justify-between text-xs opacity-85">
              <span>{debit.type}</span>
              <span>{debit.frozen ? "FROZEN" : "ACTIVE"}</span>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4">
          {["Freeze", "Limits", "PIN", "Details"].map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => x === "Freeze" && debit && freeze(debit.id)}
              className="text-center p-3 rounded-[14px] bg-surface border border-line text-[11px] font-bold"
            >
              {x}
            </button>
          ))}
        </div>

        {cards.map((c) => (
          <Card key={c.id}>
            <div className="font-bold text-navy mb-2">
              {c.label} · {c.mask}
            </div>
            <div className="text-xs text-muted mb-3">
              Daily limit {formatLkr(c.dailyLimit)}
            </div>
            {(
              [
                ["online", "Online payments"],
                ["contactless", "Contactless"],
                ["international", "International"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex justify-between items-center py-2 text-sm border-b border-line last:border-0"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={c[key]}
                  onChange={() => toggle(c, key)}
                />
              </label>
            ))}
            {!c.frozen && (
              <Button variant="secondary" className="mt-3" onClick={() => freeze(c.id)}>
                Freeze card
              </Button>
            )}
          </Card>
        ))}
      </Content>
    </>
  );
}
