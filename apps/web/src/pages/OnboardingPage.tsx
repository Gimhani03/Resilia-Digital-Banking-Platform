import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AppHeader,
  BrandMark,
  Button,
  Card,
  Content,
  Field,
  HeroTitle,
  Input,
  Select,
  Sub,
} from "../components/ui";
import { api } from "../lib/api";

export default function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState("National ID");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("Resilia2065!");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    try {
      const res = await api<{ message: string }>("/auth/onboard", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          nationalId,
          username,
          password,
          documentType,
        }),
      });
      setMsg(res.message);
      setTimeout(() => nav("/signin"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    }
  }

  return (
    <>
      <AppHeader
        left={
          <div className="flex items-center gap-2 font-extrabold text-navy">
            <BrandMark />
            RESILIA
          </div>
        }
        right={
          <Link to="/signin" className="text-crimson text-[13px] font-bold">
            Sign in
          </Link>
        }
      />
      <Content>
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-crimson" : "bg-line"}`}
            />
          ))}
        </div>
        <HeroTitle className="!text-[26px]">e-KYC onboarding</HeroTitle>
        <Sub>
          Guided identity verification with document upload and liveness (FR-01).
        </Sub>

        {step === 1 && (
          <>
            <Field label="Document type">
              <Select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option>National ID</option>
                <option>Passport</option>
                <option>Driving licence</option>
              </Select>
            </Field>
            <Card className="border-dashed !border-2 text-center py-8 text-sm text-muted">
              Tap to upload ID photo
              <div className="text-xs mt-2 text-ok font-bold">Demo · auto-extract ready</div>
            </Card>
            <Button onClick={() => setStep(2)}>Continue</Button>
          </>
        )}

        {step === 2 && (
          <>
            <Card className="!bg-crimson-soft">
              <div className="font-bold text-crimson-dark mb-1">Liveness selfie</div>
              <div className="text-xs text-muted">
                Look at the camera · match confidence 97%
              </div>
              <div className="mt-3 h-28 rounded-2xl bg-navy/10 grid place-items-center text-3xl">
                🙂
              </div>
            </Card>
            <Field label="Full name (extracted)">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amal Perera" />
            </Field>
            <Field label="National ID">
              <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </Field>
            <Button onClick={() => setStep(3)}>Fields look correct</Button>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-crimson text-sm mb-2">{error}</p>}
            {msg && <p className="text-ok text-sm mb-2">{msg}</p>}
            <Button onClick={submit}>Complete enrolment</Button>
          </>
        )}
      </Content>
    </>
  );
}
