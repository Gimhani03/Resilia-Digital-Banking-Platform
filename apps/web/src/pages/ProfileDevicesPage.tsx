import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  Content,
  HeroTitle,
  SectionLabel,
  Sub,
} from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

type Device = {
  id: string;
  name: string;
  platform: string;
  location: string;
  trusted: boolean;
  pending: boolean;
  lastSeen: string;
};

export default function ProfileDevicesPage() {
  const { token, user, logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);

  async function load() {
    setDevices(await api<Device[]>("/auth/devices", { token }));
  }

  useEffect(() => {
    load();
  }, [token]);

  async function decide(id: string, approve: boolean) {
    await api(`/auth/devices/${id}/decide`, {
      method: "POST",
      token,
      body: JSON.stringify({ approve }),
    });
    load();
  }

  return (
    <>
      <AppHeader
        left={<div className="font-extrabold text-navy">More</div>}
        right={
          <button type="button" onClick={logout} className="text-crimson text-[13px] font-bold">
            Sign out
          </button>
        }
      />
      <Content>
        <HeroTitle className="!text-[26px]">{user?.fullName}</HeroTitle>
        <Sub>Trusted devices, pending approvals, and MFA methods (FR-02 / FR-03).</Sub>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link to="/app/notifications" className="p-3 rounded-[14px] bg-surface border border-line text-xs font-bold">
            Notifications
          </Link>
          <Link to="/app/security" className="p-3 rounded-[14px] bg-surface border border-line text-xs font-bold">
            Freeze & dispute
          </Link>
          <Link to="/ops" className="p-3 rounded-[14px] bg-surface border border-line text-xs font-bold">
            Ops console
          </Link>
          <Link to="/ussd" className="p-3 rounded-[14px] bg-surface border border-line text-xs font-bold">
            USSD / Agent
          </Link>
        </div>

        <SectionLabel>MFA methods</SectionLabel>
        <Card>
          <div className="text-sm font-bold text-navy">Authenticator app · Primary</div>
          <div className="text-xs text-muted mt-1">SMS OTP · Backup ·••{user?.phoneLast4 || "78"}</div>
        </Card>

        <SectionLabel>Devices</SectionLabel>
        {devices.map((d) => (
          <Card key={d.id}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-bold text-navy text-sm">{d.name}</div>
                <div className="text-xs text-muted">
                  {d.platform} · {d.location}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  Last seen {new Date(d.lastSeen).toLocaleString()}
                </div>
              </div>
              {d.pending ? (
                <Badge tone="warn">Pending</Badge>
              ) : d.trusted ? (
                <Badge>Trusted</Badge>
              ) : (
                <Badge tone="danger">Denied</Badge>
              )}
            </div>
            {d.pending && (
              <div className="flex gap-2 mt-3">
                <Button className="!py-2" onClick={() => decide(d.id, true)}>
                  Approve
                </Button>
                <Button variant="secondary" className="!py-2" onClick={() => decide(d.id, false)}>
                  Deny
                </Button>
              </div>
            )}
          </Card>
        ))}
      </Content>
    </>
  );
}
