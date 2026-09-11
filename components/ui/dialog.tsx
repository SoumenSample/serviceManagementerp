"use client";
import * as React from "react";
import { cn } from "cn";

type DialogProps = { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode };
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] overflow-auto">{children}</div>
    </div>
  );
}
export function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-content" className={cn("bg-background rounded-lg border shadow-lg p-6 m-4", className)} {...props}>{children}</div>;
}
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 text-center sm:text-left mb-4", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 mt-4", className)} {...props} />;
}
