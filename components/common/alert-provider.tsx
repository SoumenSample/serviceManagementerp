"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AlertOptions = { title?: string; message: string };
type ConfirmOptions = { title?: string; message: string; confirmText?: string; cancelText?: string };

type AlertContextType = {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, opts?: { title?: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
};

const AlertContext = React.createContext<AlertContextType | null>(null);

export function useAppAlert() {
  const ctx = React.useContext(AlertContext);
  if (!ctx) throw new Error("useAppAlert must be used within AlertProvider");
  return ctx;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = React.useState<(AlertOptions & { open: boolean; resolve: () => void }) | null>(null);
  const [confirmState, setConfirmState] = React.useState<(ConfirmOptions & { open: boolean; resolve: (v: boolean) => void }) | null>(null);

  const showAlert = React.useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setAlertState({ title: title || "Notice", message, open: true, resolve });
    });
  }, []);

  const showConfirm = React.useCallback((message: string, opts?: { title?: string; confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        title: opts?.title || "Please confirm",
        message,
        confirmText: opts?.confirmText || "Confirm",
        cancelText: opts?.cancelText || "Cancel",
        open: true,
        resolve,
      });
    });
  }, []);

  // Patch window.alert / window.confirm globally (for any remaining direct calls)
  React.useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    // @ts-ignore
    window.alert = (msg: string) => {
      showAlert(String(msg));
    };
    // Note: window.confirm is normally sync, but we make it return false and show modal;
    // callers that still use sync confirm will need to be updated to await showConfirm.
    // We keep original for fallback, but patch to show modal as well.
    // @ts-ignore
    window.confirm = (msg: string) => {
      // For legacy sync callers, fallback to original if not in React context
      // Show modal but return false to prevent accidental destructive action
      showConfirm(String(msg));
      return false;
    };
    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [showAlert, showConfirm]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Alert Modal */}
      {alertState && (
        <Dialog open={alertState.open} onOpenChange={(o) => { if (!o) { alertState.resolve(); setAlertState(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{alertState.title}</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap break-words text-left">{alertState.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => { alertState.resolve(); setAlertState(null); }}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Modal */}
      {confirmState && (
        <Dialog open={confirmState.open} onOpenChange={(o) => { if (!o) { confirmState.resolve(false); setConfirmState(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmState.title}</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap break-words text-left">{confirmState.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>
                {confirmState.cancelText}
              </Button>
              <Button onClick={() => { confirmState.resolve(true); setConfirmState(null); }}>
                {confirmState.confirmText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AlertContext.Provider>
  );
}
