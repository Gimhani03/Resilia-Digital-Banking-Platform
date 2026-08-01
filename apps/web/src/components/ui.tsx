import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function BrandMark({ text = "R" }: { text?: string }) {
  return (
    <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-crimson to-crimson-dark text-white grid place-items-center font-display font-bold text-base">
      {text}
    </div>
  );
}

export function AppHeader({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="px-[22px] pt-2 pb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      {center}
      <div>{right}</div>
    </div>
  );
}

export function Content({ children }: { children: ReactNode }) {
  return <div className="px-[22px] pb-7 flex-1">{children}</div>;
}

export function HeroTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-display text-[30px] leading-tight text-navy mb-2 ${className}`}>
      {children}
    </h1>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="text-muted text-sm leading-relaxed mb-5">{children}</p>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className="block text-xs font-bold text-navy mb-1.5 tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border-[1.5px] border-line bg-white rounded-[14px] px-3.5 py-3.5 text-sm text-ink outline-none focus:border-crimson focus:shadow-[0_0_0_3px_rgba(201,24,74,0.12)] ${props.className || ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border-[1.5px] border-line bg-white rounded-[14px] px-3.5 py-3.5 text-sm text-ink outline-none focus:border-crimson ${props.className || ""}`}
    />
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[14px] px-[18px] py-3.5 font-bold text-sm cursor-pointer border-none disabled:opacity-50";
  const styles = {
    primary:
      "w-full bg-gradient-to-br from-crimson to-crimson-dark text-white shadow-[0_10px_24px_rgba(201,24,74,0.28)]",
    secondary: "w-full bg-surface text-navy border-[1.5px] border-line",
    ghost: "bg-transparent text-crimson px-0 py-2 text-[13px]",
  };
  return (
    <button
      type="button"
      {...props}
      className={`${base} ${styles[variant]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white border border-line rounded-[18px] p-4 mb-3.5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-extrabold tracking-[0.06em] uppercase text-muted my-2 mb-3">
      {children}
    </div>
  );
}

export function TrustPill({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-warn-soft text-warn rounded-full px-3 py-1.5 text-xs font-bold mb-4">
      {children}
    </div>
  );
}

export function Badge({
  tone = "ok",
  children,
}: {
  tone?: "ok" | "warn" | "danger";
  children: ReactNode;
}) {
  const map = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-crimson-soft text-crimson",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function FooterNote({ children }: { children: ReactNode }) {
  return <p className="text-center mt-4 text-[11px] text-muted">{children}</p>;
}
