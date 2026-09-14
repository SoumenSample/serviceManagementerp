"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppAlert } from "@/components/common/alert-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/page-header";

export default function SettingsPage() {
  const { showAlert } = useAppAlert();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings");
    if (res.ok) setSettings((await res.json()).settings);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false);
    if (res.ok) { await showAlert("Settings saved", "Notice"); load(); } else await showAlert("Failed: " + JSON.stringify(await res.json()), "Error");
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="System Settings" description="Configure your system settings" />
      <Card>
        <CardHeader><CardTitle>Company Information</CardTitle><CardDescription>Used in Email templates as OM EPC SOLUTION footer. Non-secret only.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Company Name</Label><Input value={settings.companyName || ""} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer Care Number 1</Label><Input value={settings.customerCare1 || ""} onChange={(e) => setSettings({ ...settings, customerCare1: e.target.value })} /></div>
            <div><Label>Customer Care Number 2</Label><Input value={settings.customerCare2 || ""} onChange={(e) => setSettings({ ...settings, customerCare2: e.target.value })} /></div>
          </div>
          <div><Label>Company Email</Label><Input value={settings.companyEmail || ""} onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })} /></div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
