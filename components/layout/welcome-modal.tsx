"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = { user: { name: string; role: string; email: string } };

const ROLE_CONFIG: Record<string, { label: string; subtitle: string; accent: string }> = {
  super_admin: { label: "Super Admin", subtitle: "Full access to all modules", accent: "bg-primary" },
  manager: { label: "Manager", subtitle: "Oversee operations & reports", accent: "bg-primary" },
  coordinator: { label: "Coordinator", subtitle: "Manage service calls & assignments", accent: "bg-primary" },
  engineer: { label: "Engineer", subtitle: "Your field visits & service calls await", accent: "bg-primary" },
  accounts: { label: "Accounts", subtitle: "Finance, invoices & expenses", accent: "bg-primary" },
};

export function WelcomeModal({ user }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show when login just happened (welcome_pending flag) or first visit in tab
    const pending = sessionStorage.getItem("welcome_pending");
    const key = `welcome_shown:${user.email}:${user.role}`;
    const shown = sessionStorage.getItem(key);
    const shouldShow = pending === "1" || !shown;
    if (shouldShow) {
      const t = setTimeout(() => setOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [user.email, user.role]);

  function handleClose() {
    const key = `welcome_shown:${user.email}:${user.role}`;
    sessionStorage.setItem(key, "1");
    sessionStorage.removeItem("welcome_pending");
    setOpen(false);
  }

  const cfg = ROLE_CONFIG[user.role] || { label: user.role.replace("_", " "), subtitle: "Welcome back", accent: "bg-primary" };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : setOpen(v))}>
      <DialogContent className="sm:max-w-[420px] text-center sm:text-center p-0 overflow-hidden border-0">
        <div className={`h-2 w-full ${cfg.accent}`} />
        <div className="p-6 pt-6 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
            {user.name?.charAt(0)?.toUpperCase() || "W"}
          </div>
          <DialogHeader className="items-center text-center sm:text-center">
            <DialogTitle className="text-xl">Welcome, {user.name}!</DialogTitle>
            <DialogDescription className="text-center">
              You are signed in as <span className="font-medium text-foreground">{cfg.label}</span>
              <br />
              <span className="text-xs">{cfg.subtitle}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/40 border text-xs text-muted-foreground px-3 py-2">
            {user.email} • {cfg.label}
          </div>
          <DialogFooter className="sm:justify-center justify-center">
            <Button onClick={handleClose} className="w-full sm:w-auto min-w-[120px]">
              Continue to Dashboard
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
