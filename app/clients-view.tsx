"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit3, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientInputSchema } from "@/lib/client-schema";

export type Client = {
  id: string;
  name: string;
  businessNumber: string | null;
  identityNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

const emptyClient = { name: "", businessNumber: "", identityNumber: "", email: "", phone: "", address: "", notes: "" };

export function ClientsView({ onChanged }: { onChanged?: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/clients", { cache: "no-store" });
      const result = (await response.json()) as { clients?: Client[]; error?: string };
      if (!response.ok) throw new Error(result.error);
      setClients(result.clients ?? []);
    } catch {
      setError("לא הצלחנו לטעון את הלקוחות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("he");
    return clients.filter((client) => !value || [client.name, client.email, client.phone, client.businessNumber, client.identityNumber].join(" ").toLocaleLowerCase("he").includes(value));
  }, [clients, query]);

  const startNew = () => { setEditing(null); setForm(emptyClient); setError(""); setOpen(true); };
  const startEdit = (client: Client) => {
    setEditing(client);
    setForm({ name: client.name, businessNumber: client.businessNumber ?? "", identityNumber: client.identityNumber ?? "", email: client.email ?? "", phone: client.phone ?? "", address: client.address ?? "", notes: client.notes ?? "" });
    setError(""); setOpen(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = clientInputSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "פרטי הלקוח אינם תקינים"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setOpen(false); await load(); onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא הצלחנו לשמור את הלקוח");
    } finally { setSaving(false); }
  };

  const remove = async (client: Client) => {
    if (!window.confirm(`להעביר את ${client.name} לארכיון? היסטוריית המסמכים תישמר.`)) return;
    const response = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    if (!response.ok) { setError("לא הצלחנו למחוק את הלקוח"); return; }
    await load(); onChanged?.();
  };

  return (
    <section className="rounded-[28px] border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-xl font-bold"><Users className="size-5 text-primary" />לקוחות</h2><p className="mt-1 text-sm text-muted-foreground">פרטי הלקוחות נשמרים לשימוש חוזר במסמכים.</p></div>
        <Button onClick={startNew} className="rounded-xl"><Plus />לקוח חדש</Button>
      </div>
      <div className="relative mb-4"><Search className="absolute right-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם, טלפון או מספר" className="h-11 rounded-xl pr-10" /></div>
      {error && !open && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
      {loading ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-primary" /></div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">לא נמצאו לקוחות</div> : <div className="grid gap-3 sm:grid-cols-2">{filtered.map((client) => <article key={client.id} className="rounded-2xl border bg-background p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{client.name}</h3><p className="mt-1 text-sm text-muted-foreground">{client.email || client.phone || "ללא פרטי קשר"}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="עריכת לקוח" onClick={() => startEdit(client)}><Edit3 /></Button><Button variant="ghost" size="icon" aria-label="מחיקת לקוח" onClick={() => void remove(client)}><Trash2 /></Button></div></div>{client.address && <p className="mt-3 text-sm">{client.address}</p>}{client.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{client.notes}</p>}</article>)}</div>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto rounded-3xl"><form onSubmit={save}><DialogHeader><DialogTitle>{editing ? "עריכת לקוח" : "לקוח חדש"}</DialogTitle></DialogHeader><div className="grid gap-3 py-5 sm:grid-cols-2"><ClientField label="שם" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><ClientField label="ח.פ./ע.מ." value={form.businessNumber} onChange={(value) => setForm({ ...form, businessNumber: value })} /><ClientField label="ת.ז." value={form.identityNumber} onChange={(value) => setForm({ ...form, identityNumber: value })} /><ClientField label="טלפון" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><ClientField label="מייל" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><ClientField label="כתובת" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /><label className="space-y-2 sm:col-span-2"><span className="text-sm font-semibold">הערות</span><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="rounded-xl" /></label></div>{error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}<DialogFooter className="sm:justify-start"><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}שמירה</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>ביטול</Button></DialogFooter></form></DialogContent></Dialog>
    </section>
  );
}

function ClientField({ label, value, onChange, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="space-y-2"><span className="text-sm font-semibold">{label}{required && " *"}</span><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="h-11 rounded-xl" /></label>;
}
