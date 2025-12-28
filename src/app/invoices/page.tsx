'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-ext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type {
  AuctionInvoice,
  AuctionPayment,
  AuctionSale,
  AuctionBidder,
  Org,
  Profile,
} from "@/types/database";
import type { User } from "@supabase/supabase-js";

type InvoiceFormState = {
  sale_id: string;
  buyer_id: string;
  total_amount: string;
  currency: string;
  status: AuctionInvoice["status"];
};

type PaymentFormState = {
  invoice_id: string;
  amount: string;
  method: AuctionPayment["method"];
  status: AuctionPayment["status"];
  provider: string;
  provider_reference: string;
};

const defaultInvoiceForm: InvoiceFormState = {
  sale_id: "",
  buyer_id: "",
  total_amount: "",
  currency: "USD",
  status: "draft",
};

const defaultPaymentForm: PaymentFormState = {
  invoice_id: "",
  amount: "",
  method: "wire",
  status: "pending",
  provider: "",
  provider_reference: "",
};

export default function InvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<AuctionInvoice[]>([]);
  const [payments, setPayments] = useState<AuctionPayment[]>([]);
  const [sales, setSales] = useState<AuctionSale[]>([]);
  const [bidders, setBidders] = useState<AuctionBidder[]>([]);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(defaultInvoiceForm);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(defaultPaymentForm);
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push("/auth");
      return null;
    }
    return data.session.user;
  }

  async function loadData() {
    setLoading(true);
    const current = await requireSession();
    if (!current) return;
    setUser(current);

    const { data: prof } = await supabase
      .from("profiles")
      .select("*, orgs(*)")
      .eq("user_id", current.id)
      .single();

    if (!prof?.org_id) {
      router.push("/setup");
      return;
    }

    setProfile(prof);
    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    const [invoiceRes, paymentRes, salesRes, bidderRes] = await Promise.all([
      supabase.from("auction_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("auction_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("auction_sales").select("*").order("sale_date", { ascending: false }),
      supabase.from("auction_bidders").select("*").order("created_at", { ascending: false }),
    ]);

    setInvoices((invoiceRes.data || []) as AuctionInvoice[]);
    setPayments((paymentRes.data || []) as AuctionPayment[]);
    setSales((salesRes.data || []) as AuctionSale[]);
    setBidders((bidderRes.data || []) as AuctionBidder[]);
    setLoading(false);
  }

  async function createInvoice() {
    if (!org || !user) return;
    if (!invoiceForm.buyer_id || !invoiceForm.total_amount) {
      toast.error("Buyer and total amount are required.");
      return;
    }

    const { error: invoiceErr } = await supabase
      .from("auction_invoices")
      .insert({
        org_id: org.id,
        sale_id: invoiceForm.sale_id || null,
        buyer_id: invoiceForm.buyer_id || null,
        total_amount: Number(invoiceForm.total_amount),
        currency: invoiceForm.currency.trim() || "USD",
        status: invoiceForm.status,
        issued_at: invoiceForm.status === "issued" ? new Date().toISOString() : null,
      });

    if (invoiceErr) {
      toast.error("Unable to create invoice", { description: invoiceErr.message });
      return;
    }

    toast.success("Invoice created");
    setInvoiceForm(defaultInvoiceForm);
    await loadData();
  }

  async function createPayment() {
    if (!org || !user) return;
    if (!paymentForm.invoice_id || !paymentForm.amount) {
      toast.error("Invoice and amount are required.");
      return;
    }

    const { error: paymentErr } = await supabase
      .from("auction_payments")
      .insert({
        org_id: org.id,
        invoice_id: paymentForm.invoice_id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        status: paymentForm.status,
        provider: paymentForm.provider.trim() || null,
        provider_reference: paymentForm.provider_reference.trim() || null,
      });

    if (paymentErr) {
      toast.error("Unable to record payment", { description: paymentErr.message });
      return;
    }

    toast.success("Payment recorded");
    setPaymentForm(defaultPaymentForm);
    await loadData();
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <TableSkeleton rows={6} />
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org}>
      <div className="space-y-6">
        <PageHeader
          title="Invoices & Payments"
          subtitle="Track buyer settlements, invoicing, and payment status."
          breadcrumbs={[{ label: "Invoices" }]}
        />

        {!isAdmin ? (
          <EmptyState
            title="Admins only"
            description="Invoice and payment management is limited to admins."
          />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Create invoice</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buyer</label>
                    <Select
                      value={invoiceForm.buyer_id}
                      onValueChange={(value) => setInvoiceForm({ ...invoiceForm, buyer_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bidder" />
                      </SelectTrigger>
                      <SelectContent>
                        {bidders.map((bidder) => (
                          <SelectItem key={bidder.id} value={bidder.id}>
                            {bidder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sale</label>
                    <Select
                      value={invoiceForm.sale_id}
                      onValueChange={(value) => setInvoiceForm({ ...invoiceForm, sale_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sale" />
                      </SelectTrigger>
                      <SelectContent>
                        {sales.map((sale) => (
                          <SelectItem key={sale.id} value={sale.id}>
                            {sale.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Total</label>
                      <Input
                        type="number"
                        value={invoiceForm.total_amount}
                        onChange={(event) => setInvoiceForm({ ...invoiceForm, total_amount: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Currency</label>
                      <Input
                        value={invoiceForm.currency}
                        onChange={(event) => setInvoiceForm({ ...invoiceForm, currency: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={invoiceForm.status}
                        onValueChange={(value) => setInvoiceForm({ ...invoiceForm, status: value as AuctionInvoice["status"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="issued">Issued</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="void">Void</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={createInvoice}>Create invoice</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Record payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Invoice</label>
                    <Select
                      value={paymentForm.invoice_id}
                      onValueChange={(value) => setPaymentForm({ ...paymentForm, invoice_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.id.slice(0, 8)} - {invoice.total_amount} {invoice.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount</label>
                      <Input
                        type="number"
                        value={paymentForm.amount}
                        onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Method</label>
                      <Select
                        value={paymentForm.method}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value as AuctionPayment["method"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wire">Wire</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="ach">ACH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={paymentForm.status}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, status: value as AuctionPayment["status"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="succeeded">Succeeded</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="refunded">Refunded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Provider</label>
                      <Input
                        value={paymentForm.provider}
                        onChange={(event) => setPaymentForm({ ...paymentForm, provider: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Provider reference</label>
                    <Input
                      value={paymentForm.provider_reference}
                      onChange={(event) => setPaymentForm({ ...paymentForm, provider_reference: event.target.value })}
                    />
                  </div>
                  <Button onClick={createPayment}>Record payment</Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {invoices.length === 0 ? (
                    <EmptyState title="No invoices yet" description="Create an invoice to start settlement." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-semibold">{invoice.id.slice(0, 8)}</TableCell>
                            <TableCell className="capitalize text-sm text-muted-foreground">{invoice.status}</TableCell>
                            <TableCell>{invoice.total_amount} {invoice.currency}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <EmptyState title="No payments yet" description="Record payments as they arrive." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-semibold">{payment.invoice_id.slice(0, 8)}</TableCell>
                            <TableCell className="capitalize text-sm text-muted-foreground">{payment.status}</TableCell>
                            <TableCell>{payment.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
