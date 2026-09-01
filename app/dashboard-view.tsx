"use client";

import { FileText, ReceiptText, Users } from "lucide-react";
import type { Client } from "@/app/clients-view";

type DashboardDocument = { id: string; documentType: string; status: string; customerName: string; amount: number; documentDate: string; createdAt: string };

function money(value: number) { return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(value); }

export function DashboardView({ documents, clients }: { documents: DashboardDocument[]; clients: Client[] }) {
  const now = new Date();
  const issuedReceipts = documents.filter((item) => item.status === "issued" && item.documentType === "receipt");
  const year = issuedReceipts.filter((item) => new Date(item.documentDate).getFullYear() === now.getFullYear());
  const month = year.filter((item) => new Date(item.documentDate).getMonth() === now.getMonth());
  const cards = [{ label: "הכנסות החודש", value: money(month.reduce((sum, item) => sum + item.amount, 0)) }, { label: "הכנסות השנה", value: money(year.reduce((sum, item) => sum + item.amount, 0)) }, { label: "קבלות החודש", value: String(month.length) }, { label: "קבלות השנה", value: String(year.length) }];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map((card) => <article key={card.label} className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">{card.label}</p><p className="mt-2 text-2xl font-black">{card.value}</p></article>)}</div><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[28px] border bg-card p-5"><h2 className="flex items-center gap-2 font-bold"><Users className="size-5 text-primary" />לקוחות אחרונים</h2><div className="mt-4 space-y-2">{clients.slice(0,5).map((client) => <div key={client.id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm font-semibold">{client.name}</div>)}{clients.length === 0 && <p className="text-sm text-muted-foreground">עדיין אין לקוחות</p>}</div></section><section className="rounded-[28px] border bg-card p-5"><h2 className="flex items-center gap-2 font-bold"><FileText className="size-5 text-primary" />מסמכים אחרונים</h2><div className="mt-4 space-y-2">{documents.slice(0,5).map((document) => <div key={document.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><ReceiptText className="size-4" />{document.customerName}</span><strong>{money(document.amount)}</strong></div>)}{documents.length === 0 && <p className="text-sm text-muted-foreground">עדיין אין מסמכים</p>}</div></section></div><section className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">התקדמות מול תקרת עוסק פטור תוצג לאחר הגדרת התקרה במסך ההגדרות. לא הוגדר בקוד סכום תקרה קשיח.</section></div>;
}
