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

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ base64, mime: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState("National ID");
  const [docBase64, setDocBase64] = useState("");
  const [docMime, setDocMime] = useState("image/jpeg");
  const [docName, setDocName] = useState("");
  const [selfieBase64, setSelfieBase64] = useState("");
  const [selfieMime, setSelfieMime] = useState("image/jpeg");
  const [selfieName, setSelfieName] = useState("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("Resilia2065!");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function onIdFile(file?: File | null) {
    if (!file) return;
    const { base64, mime } = await fileToBase64(file);
    setDocBase64(base64);
    setDocMime(mime);
    setDocName(file.name);
  }

  async function onSelfieFile(file?: File | null) {
    if (!file) return;
    const { base64, mime } = await fileToBase64(file);
    setSelfieBase64(base64);
    setSelfieMime(mime);
    setSelfieName(file.name);
  }

  async function submit() {
    setError("");
    if (!docBase64 || !selfieBase64) {
      setError("ID photo and liveness selfie are both required");
      return;
    }
    try {
      const res = await api<{ message: string; kycStatus?: string }>("/auth/onboard", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          nationalId,
          username,
          password,
          documentType,
          documentBase64: docBase64,
          documentMimeType: docMime,
          selfieBase64,
          selfieMimeType: selfieMime,
        }),
      });
      setMsg(res.message);
      setTimeout(() => nav("/signin"), 1600);
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
          Upload ID + selfie for officer review. Banking unlocks after approval (FR-01).
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
            <label className="block border-2 border-dashed border-line rounded-2xl text-center py-8 text-sm text-navy cursor-pointer mb-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onIdFile(e.target.files?.[0])}
              />
              {docName ? `ID attached · ${docName}` : "Tap to photograph / upload ID"}
              <div className="text-xs mt-2 text-muted">Camera or photo library</div>
            </label>
            <Button disabled={!docBase64} onClick={() => setStep(2)}>
              Continue
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <label className="block !bg-crimson-soft border border-crimson/20 rounded-2xl p-4 cursor-pointer mb-3">
              <div className="font-bold text-crimson-dark mb-1">Liveness selfie</div>
              <div className="text-xs text-muted mb-3">
                Use the front camera · look straight ahead
              </div>
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => onSelfieFile(e.target.files?.[0])}
              />
              <div className="h-28 rounded-2xl bg-navy/10 grid place-items-center text-sm font-bold text-navy">
                {selfieName ? `Selfie attached · ${selfieName}` : "Tap to take selfie"}
              </div>
            </label>
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amal Perera" />
            </Field>
            <Field label="National ID">
              <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </Field>
            <Button disabled={!selfieBase64 || !fullName || !nationalId} onClick={() => setStep(3)}>
              Continue
            </Button>
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
            <Button onClick={submit}>Submit for KYC review</Button>
            <Card className="mt-3 text-xs text-muted">
              Status after submit: <strong>PENDING REVIEW</strong>. An officer must approve
              before transfers unlock.
            </Card>
          </>
        )}
      </Content>
    </>
  );
}
