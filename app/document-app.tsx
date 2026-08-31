"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FileClock,
  FileText,
  History,
  Loader2,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  documentTypeLabel,
  paymentMethodLabel,
  paymentMethods,
  receiptInputSchema,
} from "@/lib/receipt-schema";

type FormState = {
  documentType: "receipt" | "proforma";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCrn: string;
  amount: string;
  documentDate: string;
  dueDate: string;
  paymentType: string;
  description: string;
  paymentReference: string;
  webVendor: string;
  checkBankName: string;
  checkNumber: string;
  checkBranch: string;
  checkAccount: string;
  cardType: string;
  cardLastFour: string;
  otherPaymentName: string;
  sendEmail: boolean;
};

type SavedDocument = {
  id: string;
  documentType: "receipt" | "proforma";
  documentTypeLabel: string;
  customerName: string;
  customerEmail: string | null;
  amount: number;
  documentDate: string;
  dueDate: string | null;
  paymentType: number | null;
  paymentTypeLabel: string | null;
  description: string;
  status: "pending" | "issued" | "failed";
  docNumber: string | null;
  docUuid: string | null;
  pdfLink: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function israelDate(addDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + addDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function initialForm(): FormState {
  return {
    documentType: "receipt",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerCrn: "",
    amount: "",
    documentDate: israelDate(),
    dueDate: israelDate(14),
    paymentType: "4",
    description: "",
    paymentReference: "",
    webVendor: "Bit",
    checkBankName: "",
    checkNumber: "",
    checkBranch: "",
    checkAccount: "",
    cardType: "visa",
    cardLastFour: "",
    otherPaymentName: "",
    sendEmail: true,
  };
}

function requestKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function money(value: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function displayDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return [day, month, year].join(".");
}

export function DocumentApp() {
  const [view, setView] = useState<"new" | "history">("new");
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [idempotencyKey, setIdempotencyKey] = useState(() => requestKey());
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<SavedDocument | null>(null);
  const [search, setSearch] = useState("");

  const loadDocuments = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const result = (await response.json()) as {
        documents?: SavedDocument[];
      };
      if (response.ok) setDocuments(result.documents ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { connected?: boolean }) =>
        setConnected(Boolean(result.connected)),
      )
      .catch(() => setConnected(false));
    void loadDocuments();
  }, [loadDocuments]);

  const update = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setSubmitError("");
    setSuccess(null);
    if (submittedOnce) {
      setIdempotencyKey(requestKey());
      setSubmittedOnce(false);
    }
  };

  const payload = useMemo(
    () => ({
      ...form,
      idempotencyKey,
      amount: Number(form.amount),
      paymentType: Number(form.paymentType),
    }),
    [form, idempotencyKey],
  );

  const review = (event: FormEvent) => {
    event.preventDefault();
    const parsed = receiptInputSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "חסרים פרטים במסמך");
      return;
    }
    setFormError("");
    setReviewOpen(true);
  };

  const issue = async () => {
    if (!connected) {
      setSubmitError("צריך לחבר את EasyCount לפני הפקת מסמך אמיתי.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    setSubmittedOnce(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        document?: SavedDocument;
        error?: string;
      };
      if (!response.ok || !result.document) {
        throw new Error(result.error || "המסמך לא הופק");
      }
      setSuccess(result.document);
      setReviewOpen(false);
      await loadDocuments();
      setForm(initialForm());
      setIdempotencyKey(requestKey());
      setSubmittedOnce(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "המסמך לא הופק",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("he");
    if (!query) return documents;
    return documents.filter((document) =>
      [
        document.customerName,
        document.customerEmail ?? "",
        document.docNumber ?? "",
        document.description,
      ]
        .join(" ")
        .toLocaleLowerCase("he")
        .includes(query),
    );
  }, [documents, search]);

  const PreviewIcon =
    form.documentType === "receipt" ? ReceiptText : FileText;
  const amount = Number(form.amount) || 0;

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="soft-grid min-h-screen">
        <Header connected={connected} />
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <Navigation view={view} setView={setView} />

          {view === "new" ? (
            <>
              {connected === false && <ConnectionNotice />}
              {success && <SuccessNotice document={success} />}

              <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
                <form
                  onSubmit={review}
                  className="rounded-[28px] border bg-card p-4 shadow-[0_20px_55px_-35px_rgba(18,50,47,.35)] sm:p-6"
                >
                  <DocumentTypePicker form={form} update={update} />

                  <SectionTitle number="1" title="פרטי הלקוח" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="שם הלקוח" required>
                      <Input
                        value={form.customerName}
                        onChange={(event) =>
                          update("customerName", event.target.value)
                        }
                        placeholder="לדוגמה: יעל כהן"
                        autoComplete="name"
                        className="h-11 rounded-xl bg-background"
                      />
                    </Field>
                    <Field
                      label="אימייל"
                      hint={form.sendEmail ? "המסמך יישלח לכאן" : "לא חובה"}
                    >
                      <Input
                        type="email"
                        dir="ltr"
                        value={form.customerEmail}
                        onChange={(event) =>
                          update("customerEmail", event.target.value)
                        }
                        placeholder="name@example.com"
                        autoComplete="email"
                        className="h-11 rounded-xl bg-background text-left"
                      />
                    </Field>
                    <Field label="טלפון" hint="לא חובה">
                      <Input
                        type="tel"
                        dir="ltr"
                        value={form.customerPhone}
                        onChange={(event) =>
                          update("customerPhone", event.target.value)
                        }
                        placeholder="050-0000000"
                        className="h-11 rounded-xl bg-background text-left"
                      />
                    </Field>
                    <Field label="ת״ז או ח״פ" hint="לא חובה">
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        value={form.customerCrn}
                        onChange={(event) =>
                          update(
                            "customerCrn",
                            event.target.value.replace(/\D/g, ""),
                          )
                        }
                        placeholder="000000000"
                        className="h-11 rounded-xl bg-background text-left"
                      />
                    </Field>
                  </div>

                  <Divider />
                  <SectionTitle number="2" title="פרטי המסמך" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="סכום" required>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          dir="ltr"
                          value={form.amount}
                          onChange={(event) =>
                            update("amount", event.target.value)
                          }
                          placeholder="0.00"
                          className="h-12 rounded-xl bg-background pl-12 text-left text-lg font-bold"
                        />
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                          ₪
                        </span>
                      </div>
                    </Field>
                    <Field label="תאריך המסמך" required>
                      <Input
                        type="date"
                        dir="ltr"
                        value={form.documentDate}
                        onChange={(event) =>
                          update("documentDate", event.target.value)
                        }
                        className="h-12 rounded-xl bg-background text-left"
                      />
                    </Field>
                    {form.documentType === "proforma" && (
                      <Field label="לתשלום עד" hint="לא חובה">
                        <Input
                          type="date"
                          dir="ltr"
                          value={form.dueDate}
                          onChange={(event) =>
                            update("dueDate", event.target.value)
                          }
                          className="h-11 rounded-xl bg-background text-left"
                        />
                      </Field>
                    )}
                    <div
                      className={
                        form.documentType === "receipt"
                          ? "sm:col-span-2"
                          : ""
                      }
                    >
                      <Field
                        label="תיאור העבודה"
                        required={form.documentType === "proforma"}
                      >
                        <Textarea
                          value={form.description}
                          onChange={(event) =>
                            update("description", event.target.value)
                          }
                          placeholder="לדוגמה: ייעוץ וליווי מקצועי"
                          className="min-h-24 resize-none rounded-xl bg-background"
                        />
                      </Field>
                    </div>
                  </div>

                  {form.documentType === "receipt" && (
                    <>
                      <Divider />
                      <SectionTitle number="3" title="איך התקבל התשלום?" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="אמצעי תשלום" required>
                          <NativeSelect
                            value={form.paymentType}
                            onChange={(event) =>
                              update("paymentType", event.target.value)
                            }
                            className="h-11 w-full rounded-xl bg-background"
                          >
                            {paymentMethods.map((method) => (
                              <NativeSelectOption
                                key={method.value}
                                value={String(method.value)}
                              >
                                {method.label}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </Field>
                        <PaymentFields form={form} update={update} />
                      </div>
                    </>
                  )}

                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border bg-muted/40 p-4">
                    <input
                      type="checkbox"
                      checked={form.sendEmail}
                      onChange={(event) =>
                        update("sendEmail", event.target.checked)
                      }
                      className="mt-0.5 size-5 accent-primary"
                    />
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        <Mail className="size-4 text-primary" />
                        לשלוח את המסמך באימייל
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        EasyCount ישלח ללקוח את המסמך החתום לאחר ההפקה.
                      </span>
                    </span>
                  </label>

                  {formError && (
                    <p className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                      <AlertCircle className="size-4" />
                      {formError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="mt-6 h-13 w-full rounded-2xl text-base font-bold shadow-[0_14px_35px_-18px_rgba(15,118,110,.9)]"
                  >
                    <ShieldCheck className="size-5" />
                    בדיקה לפני הפקה
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    שום מסמך לא יופק לפני אישור נוסף
                  </p>
                </form>

                <aside className="lg:sticky lg:top-6">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-sm font-bold">
                      <Sparkles className="size-4 text-primary" />
                      תצוגה מקדימה
                    </h2>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                      טיוטה בלבד
                    </span>
                  </div>
                  <DocumentPreview
                    form={form}
                    amount={amount}
                    icon={PreviewIcon}
                  />
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border bg-card p-4 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      המסמך הסופי יקבל מספר רץ וחתימה דיגיטלית של EasyCount.
                      פרטי החיבור נשמרים בצד המאובטח בלבד.
                    </span>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <HistoryView
              documents={filteredDocuments}
              loading={historyLoading}
              search={search}
              setSearch={setSearch}
              startNew={() => setView("new")}
            />
          )}
        </div>
      </div>

      <ReviewDialog
        open={reviewOpen}
        setOpen={setReviewOpen}
        form={form}
        amount={amount}
        connected={connected}
        submitting={submitting}
        submitError={submitError}
        issue={issue}
      />
    </main>
  );
}

function Header({ connected }: { connected: boolean | null }) {
  return (
    <header className="border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_rgba(15,118,110,.8)]">
            <ReceiptText className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">
              קבלה קלה
            </h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              מסמכים פשוטים לעוסק פטור
            </p>
          </div>
        </div>
        <div
          className={
            "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold " +
            (connected
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : connected === false
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-border bg-card text-muted-foreground")
          }
        >
          <span
            className={
              "size-2 rounded-full " +
              (connected
                ? "bg-emerald-500"
                : connected === false
                  ? "bg-amber-500"
                  : "animate-pulse bg-muted-foreground")
            }
          />
          {connected
            ? "EasyCount מחובר"
            : connected === false
              ? "ממתין לחיבור"
              : "בודק חיבור"}
        </div>
      </div>
    </header>
  );
}

function Navigation({
  view,
  setView,
}: {
  view: "new" | "history";
  setView: (view: "new" | "history") => void;
}) {
  return (
    <nav
      className="mb-5 grid max-w-md grid-cols-2 rounded-2xl border bg-card p-1.5 shadow-sm"
      aria-label="ניווט ראשי"
    >
      <NavButton active={view === "new"} onClick={() => setView("new")}>
        <Plus className="size-4" />
        מסמך חדש
      </NavButton>
      <NavButton active={view === "history"} onClick={() => setView("history")}>
        <History className="size-4" />
        מסמכים שהופקו
      </NavButton>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition " +
        (active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted")
      }
    >
      {children}
    </button>
  );
}

function ConnectionNotice() {
  return (
    <Alert className="mb-5 border-amber-200 bg-amber-50 text-amber-950">
      <AlertCircle />
      <AlertTitle>המערכת מוכנה לחיבור</AlertTitle>
      <AlertDescription className="text-amber-800">
        אפשר למלא ולבדוק מסמך. הפקה אמיתית תיפתח לאחר חיבור מפתח ה-API של
        EasyCount.
      </AlertDescription>
    </Alert>
  );
}

function SuccessNotice({ document }: { document: SavedDocument }) {
  return (
    <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-950">
      <CheckCircle2 />
      <AlertTitle>{document.documentTypeLabel} הופקה בהצלחה</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3 text-emerald-800">
        <span>
          מספר {document.docNumber} עבור {document.customerName}
        </span>
        {document.pdfLink && (
          <a
            href={document.pdfLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold underline underline-offset-4"
          >
            <Download className="size-4" />
            פתיחת המסמך
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}

function DocumentTypePicker({
  form,
  update,
}: {
  form: FormState;
  update: <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => void;
}) {
  const options = [
    {
      value: "receipt" as const,
      title: "קבלה",
      note: "התשלום כבר התקבל",
      icon: ReceiptText,
    },
    {
      value: "proforma" as const,
      title: "חשבונית עסקה",
      note: "בקשת תשלום לפני קבלה",
      icon: FileClock,
    },
  ];

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-bold tracking-wide text-primary">
        סוג המסמך
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = form.documentType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => update("documentType", option.value)}
              className={
                "flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-right transition " +
                (selected
                  ? "border-primary bg-primary/7 ring-2 ring-primary/15"
                  : "border-border bg-background hover:border-primary/40")
              }
            >
              <span
                className={
                  "grid size-10 shrink-0 place-items-center rounded-xl " +
                  (selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-bold">{option.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.note}
                </span>
              </span>
              {selected && <Check className="mr-auto size-5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-black text-secondary-foreground">
        {number}
      </span>
      <h2 className="font-bold">{title}</h2>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold">
        <span>
          {label}
          {required && <span className="mr-1 text-primary">*</span>}
        </span>
        {hint && (
          <span className="text-[11px] font-normal text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-border" />;
}

function PaymentFields({
  form,
  update,
}: {
  form: FormState;
  update: <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => void;
}) {
  const type = Number(form.paymentType);
  if (type === 91) {
    return (
      <>
        <Field label="אפליקציה" required>
          <NativeSelect
            value={form.webVendor}
            onChange={(event) => update("webVendor", event.target.value)}
            className="h-11 w-full rounded-xl bg-background"
          >
            {["Bit", "PayBox", "PayPal", "אחר"].map((vendor) => (
              <NativeSelectOption key={vendor} value={vendor}>
                {vendor}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <ReferenceField form={form} update={update} />
      </>
    );
  }
  if (type === 2) {
    return (
      <>
        <Field label="שם הבנק" required>
          <Input
            value={form.checkBankName}
            onChange={(event) => update("checkBankName", event.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </Field>
        <Field label="מספר המחאה" required>
          <Input
            value={form.checkNumber}
            onChange={(event) => update("checkNumber", event.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </Field>
        <Field label="סניף" hint="לא חובה">
          <Input
            value={form.checkBranch}
            onChange={(event) => update("checkBranch", event.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </Field>
        <Field label="חשבון" hint="לא חובה">
          <Input
            value={form.checkAccount}
            onChange={(event) => update("checkAccount", event.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </Field>
      </>
    );
  }
  if (type === 3) {
    return (
      <>
        <Field label="סוג הכרטיס" required>
          <NativeSelect
            value={form.cardType}
            onChange={(event) => update("cardType", event.target.value)}
            className="h-11 w-full rounded-xl bg-background"
          >
            <NativeSelectOption value="visa">Visa</NativeSelectOption>
            <NativeSelectOption value="mastercard">
              Mastercard
            </NativeSelectOption>
            <NativeSelectOption value="isracard">ישראכרט</NativeSelectOption>
            <NativeSelectOption value="max">MAX</NativeSelectOption>
            <NativeSelectOption value="amex">
              American Express
            </NativeSelectOption>
            <NativeSelectOption value="diners">Diners</NativeSelectOption>
            <NativeSelectOption value="other">אחר</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="4 ספרות אחרונות" required>
          <Input
            dir="ltr"
            inputMode="numeric"
            maxLength={4}
            value={form.cardLastFour}
            onChange={(event) =>
              update(
                "cardLastFour",
                event.target.value.replace(/\D/g, "").slice(0, 4),
              )
            }
            placeholder="1234"
            className="h-11 rounded-xl bg-background text-left"
          />
        </Field>
      </>
    );
  }
  if (type === 9) {
    return (
      <Field label="אמצעי התשלום" required>
        <Input
          value={form.otherPaymentName}
          onChange={(event) => update("otherPaymentName", event.target.value)}
          placeholder="לדוגמה: שובר"
          className="h-11 rounded-xl bg-background"
        />
      </Field>
    );
  }
  return <ReferenceField form={form} update={update} />;
}

function ReferenceField({
  form,
  update,
}: {
  form: FormState;
  update: <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => void;
}) {
  return (
    <Field label="אסמכתה או הערה" hint="לא חובה">
      <Input
        value={form.paymentReference}
        onChange={(event) => update("paymentReference", event.target.value)}
        placeholder={
          Number(form.paymentType) === 4 ? "מספר אסמכתה להעברה" : ""
        }
        className="h-11 rounded-xl bg-background"
      />
    </Field>
  );
}

function DocumentPreview({
  form,
  amount,
  icon: Icon,
}: {
  form: FormState;
  amount: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="receipt-paper overflow-hidden rounded-[28px] border bg-card shadow-[0_24px_55px_-32px_rgba(18,50,47,.5)]">
      <div className="border-b border-dashed bg-primary px-6 py-6 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary-foreground/75">
              מסמך לעוסק פטור
            </p>
            <h3 className="mt-1 text-2xl font-black">
              {documentTypeLabel(form.documentType)}
            </h3>
          </div>
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
            <Icon className="size-5" />
          </span>
        </div>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">סכום</p>
          <p className="mt-1 text-4xl font-black tracking-tight text-primary">
            {money(amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">ללא מע״מ</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-y border-dashed py-4 text-sm">
          <PreviewValue label="עבור" value={form.customerName || "שם הלקוח"} />
          <PreviewValue
            label="תאריך"
            value={displayDate(form.documentDate)}
          />
          {form.documentType === "receipt" ? (
            <PreviewValue
              label="אמצעי תשלום"
              value={paymentMethodLabel(Number(form.paymentType))}
            />
          ) : (
            <PreviewValue
              label="לתשלום עד"
              value={displayDate(form.dueDate) || "ללא תאריך יעד"}
            />
          )}
          <PreviewValue
            label="שליחה"
            value={
              form.sendEmail ? form.customerEmail || "במייל" : "ללא שליחה"
            }
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">פירוט</p>
          <p className="mt-1 min-h-10 text-sm font-medium leading-6">
            {form.description || "תיאור העבודה יופיע כאן"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/70 px-4 py-3 text-xs">
          <span className="font-bold">טיוטה לתצוגה</span>
          <span className="text-muted-foreground">EasyCount</span>
        </div>
      </div>
    </div>
  );
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}

function ReviewDialog({
  open,
  setOpen,
  form,
  amount,
  connected,
  submitting,
  submitError,
  issue,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  form: FormState;
  amount: number;
  connected: boolean | null;
  submitting: boolean;
  submitError: string;
  issue: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="max-w-lg rounded-3xl p-0">
        <div className="border-b bg-muted/45 px-6 py-5">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="size-5 text-primary" />
              אישור לפני הפקה
            </DialogTitle>
            <DialogDescription className="text-right leading-6">
              לאחר האישור המסמך יקבל מספר ולא ניתן יהיה למחוק אותו כטיוטה.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm">
          <ReviewRow label="מסמך" value={documentTypeLabel(form.documentType)} />
          <ReviewRow label="לקוח" value={form.customerName || "לא הוזן"} />
          <ReviewRow label="סכום" value={money(amount)} strong />
          <ReviewRow label="תאריך" value={displayDate(form.documentDate)} />
          {form.documentType === "receipt" && (
            <ReviewRow
              label="תשלום"
              value={paymentMethodLabel(Number(form.paymentType))}
            />
          )}
          <ReviewRow
            label="שליחה"
            value={
              form.sendEmail
                ? form.customerEmail || "חסר אימייל"
                : "ללא שליחה אוטומטית"
            }
          />
          {connected === false && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertCircle />
              <AlertTitle>EasyCount עדיין לא מחובר</AlertTitle>
              <AlertDescription>
                ההפקה תיפתח מיד לאחר השלמת החיבור המאובטח.
              </AlertDescription>
            </Alert>
          )}
          {submitError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle />
              <AlertTitle>המסמך לא הופק</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter className="border-t px-6 py-4 sm:justify-start">
          <Button
            type="button"
            size="lg"
            onClick={issue}
            disabled={!connected || submitting}
            className="h-11 rounded-xl px-6"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {submitting ? "מפיק את המסמך..." : "מאשר ומפיק"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setOpen(false)}
            disabled={submitting}
            className="h-11 rounded-xl"
          >
            חזרה לעריכה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-dashed pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-lg font-black text-primary" : "font-bold"}>
        {value}
      </span>
    </div>
  );
}

function HistoryView({
  documents,
  loading,
  search,
  setSearch,
  startNew,
}: {
  documents: SavedDocument[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  startNew: () => void;
}) {
  return (
    <section className="rounded-[28px] border bg-card p-4 shadow-[0_20px_55px_-35px_rgba(18,50,47,.35)] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-primary">היסטוריה</p>
          <h2 className="mt-1 text-2xl font-black">מסמכים שהופקו</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            עד 100 המסמכים האחרונים
          </p>
        </div>
        <Button onClick={startNew} className="h-11 rounded-xl">
          <Plus />
          מסמך חדש
        </Button>
      </div>
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש לפי לקוח, מספר או תיאור"
          className="h-11 rounded-xl bg-background pr-10"
        />
      </div>
      {loading ? (
        <div className="grid min-h-56 place-items-center text-muted-foreground">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" />
            טוען מסמכים...
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed bg-muted/25 p-8 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
              <FileText className="size-6" />
            </span>
            <h3 className="mt-4 font-bold">עדיין אין כאן מסמכים</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              המסמך הראשון יופיע כאן.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((document) => (
            <HistoryItem key={document.id} document={document} />
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryItem({ document }: { document: SavedDocument }) {
  const Icon = document.documentType === "receipt" ? ReceiptText : FileText;
  const status =
    document.status === "issued"
      ? { label: "הופק", color: "bg-emerald-100 text-emerald-800" }
      : document.status === "pending"
        ? { label: "בהפקה", color: "bg-amber-100 text-amber-800" }
        : { label: "נכשל", color: "bg-red-100 text-red-800" };

  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-background p-4 transition hover:border-primary/35 sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-bold">{document.customerName}</h3>
          <span
            className={
              "rounded-full px-2 py-1 text-[10px] font-black " + status.color
            }
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {document.documentTypeLabel}
          {document.docNumber ? " מספר " + document.docNumber : ""} •{" "}
          {displayDate(document.documentDate)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="text-lg font-black text-primary">
          {money(document.amount)}
        </span>
        {document.pdfLink && (
          <Button variant="outline" size="sm" asChild>
            <a href={document.pdfLink} target="_blank" rel="noreferrer">
              <Download />
              PDF
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
