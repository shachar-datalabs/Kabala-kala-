"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { businessInputSchema } from "@/lib/business-schema";

type Form = { businessName: string; ownerName: string; businessNumber: string; email: string; phone: string; address: string; taxYear: string; exemptDealerCeiling: string };
const empty: Form = { businessName: "", ownerName: "", businessNumber: "", email: "", phone: "", address: "", taxYear: String(new Date().getFullYear()), exemptDealerCeiling: "" };

export function SettingsView() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/business", { cache: "no-store" });
        const result = (await response.json()) as { business?: Record<string, string | number | null> };
        if (response.ok && result.business) setForm({ businessName: String(result.business.businessName ?? ""), ownerName: String(result.business.ownerName ?? ""), businessNumber: String(result.business.businessNumber ?? ""), email: String(result.business.email ?? ""), phone: String(result.business.phone ?? ""), address: String(result.business.address ?? ""), taxYear: String(result.business.taxYear ?? new Date().getFullYear()), exemptDealerCeiling: String(result.business.exemptDealerCeiling ?? "") });
      } catch { setError("לא הצלחנו לטעון את הגדרות העסק"); } finally { setLoading(false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaved(false);
    const payload = { ...form, taxYear: form.taxYear ? Number(form.taxYear) : null, exemptDealerCeiling: form.exemptDealerCeiling ? Number(form.exemptDealerCeiling) : null };
    const parsed = businessInputSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "ההגדרות אינן תקינות"); return; }
    setSaving(true); setError("");
    try { const response = await fetch("/api/business", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) }); const result = (await response.json()) as { error?: string }; if (!response.ok) throw new Error(result.error); setSaved(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "לא הצלחנו לשמור את הגדרות העסק"); } finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  return <section className="rounded-[28px] border bg-card p-4 shadow-sm sm:p-6"><div className="mb-5"><h2 className="flex items-center gap-2 text-xl font-bold"><Settings className="size-5 text-primary" />הגדרות העסק</h2><p className="mt-1 text-sm text-muted-foreground">הנתונים זמינים רק למשתמש המחובר.</p></div><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">{([['businessName','שם העסק'],['ownerName','שם בעל העסק'],['businessNumber','מספר עוסק'],['phone','טלפון'],['email','מייל'],['address','כתובת'],['taxYear','שנת מס'],['exemptDealerCeiling','תקרת עוסק פטור לשנה']] as const).map(([key,label]) => <label key={key} className="space-y-2"><span className="text-sm font-semibold">{label}</span><Input type={key === 'email' ? 'email' : key === 'taxYear' || key === 'exemptDealerCeiling' ? 'number' : 'text'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="h-11 rounded-xl" /></label>)}<div className="sm:col-span-2">{error && <Alert variant="destructive" className="mb-3"><AlertDescription>{error}</AlertDescription></Alert>}{saved && <Alert className="mb-3 border-emerald-200 bg-emerald-50"><CheckCircle2 /><AlertDescription>ההגדרות נשמרו</AlertDescription></Alert>}<Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}שמירת הגדרות</Button></div></form></section>;
}
