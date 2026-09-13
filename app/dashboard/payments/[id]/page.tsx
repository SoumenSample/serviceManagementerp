"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";

type Detail = {
  _id: string;
  paymentId: string;
  invoice: { _id: string; invoiceId: string; totalAmount: number; paidAmount: number; paymentStatus: string; dueDate?: string; invoiceDate?: string; customer?: string } | string;
  customer: { _id: string; companyName: string; customerId?: string } | string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  remarks?: string;
  receivedBy?: { name: string; email: string } | string;
  createdAt: string;
  invoiceExtra?: { outstanding: number; overdue: boolean };
};

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/payments/${id}`).then(async (r) => {
      if (r.ok) setData(await r.json());
      else {
        const j = await r.json().catch(() => ({ error: "Not found" }));
        setError(j.error || "Failed to load");
      }
    });
  }, [id]);

  if (error) return <div className="p-6"><p className="text-sm text-destructive">{error}</p><Link href="/dashboard/payments"><Button variant="outline" size="sm" className="mt-4">Back to Payments</Button></Link></div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading payment...</div>;

  const inv = data.invoice as unknown as { invoiceId?: string; totalAmount?: number; paidAmount?: number; paymentStatus?: string; _id?: string } | null;
  const cust = data.customer as unknown as { companyName?: string; customerId?: string } | null;
  const recv = data.receivedBy as unknown as { name?: string; email?: string } | null;
  const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  const invIdForLink = typeof inv === "object" && inv && "_id" in (inv as object) ? (inv as { _id: string })._id : null;
  const invoiceTotal = inv?.totalAmount ?? 0;
  const invoicePaid = inv?.paidAmount ?? 0;
  const invoiceOutstanding = data.invoiceExtra?.outstanding ?? (invoiceTotal - invoicePaid);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={`Payment ${data.paymentId}`} description="Payment detail — money received from customer" action={<Link href="/dashboard/payments"><Button variant="outline" size="sm">Back</Button></Link>} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment ID</span><span className="font-mono font-medium">{data.paymentId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Date</span><span>{new Date(data.paymentDate).toLocaleDateString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold text-base">{inr(data.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><Badge variant="outline">{data.paymentMethod}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reference Number</span><span className="font-mono text-xs">{data.referenceNumber || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span className="max-w-[200px] truncate text-right">{data.remarks || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Received By</span><span>{recv?.name || "-"}{recv?.email ? ` • ${recv.email}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Created At</span><span>{new Date(data.createdAt).toLocaleString()}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Related Invoice</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice ID</span><span className="font-mono font-medium">{inv?.invoiceId || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{cust?.companyName || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span>{inr(invoiceTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Paid</span><span>{inr(invoicePaid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Outstanding</span><span className={invoiceOutstanding === 0 ? "text-green-600" : "text-destructive"}>{inr(invoiceOutstanding)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice Status</span><Badge variant={inv?.paymentStatus === "PAID" ? "default" : inv?.paymentStatus === "PARTIAL" ? "secondary" : "outline"}>{inv?.paymentStatus || "-"}</Badge></div>
            {invIdForLink && <Link href={`/dashboard/invoices`} className="block pt-2"><Button variant="outline" size="sm" className="w-full">View Invoices</Button></Link>}
          </CardContent>
        </Card>
      </div>

  
    </div>
  );
}
