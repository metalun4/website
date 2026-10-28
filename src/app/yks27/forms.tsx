"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPin, deleteExam, login, revokePin, type ActionState } from "./actions";

const inputClass = "yks-input mt-1";
const buttonClass = "yks-button";
function Feedback({ state }: { state: ActionState }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="my-3 text-red-600 dark:text-red-400">{state.error}</p>}{state.success && <p className="my-3">{state.success}</p>}</div>;
}

export function LoginForm({ returnTo = "/yks27" }: { returnTo?: string }) {
  const [mode, setMode] = useState("viewer");
  return <>
    <div className="mb-6 flex gap-1 rounded-xl border border-border bg-background p-1" role="group" aria-label="Giriş yöntemi">
      {[{ id: "viewer", name: "İzleyici PIN’i" }, { id: "admin", name: "Yönetici" }].map(item => <button type="button" key={item.id} onClick={() => setMode(item.id)} aria-pressed={mode === item.id} className={`flex-1 rounded-lg px-3 py-2.5 font-medium ${mode === item.id ? "bg-foreground text-background" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}>{item.name}</button>)}
    </div>
    <LoginFields key={mode} mode={mode} returnTo={returnTo} />
  </>;
}

function LoginFields({ mode, returnTo }: { mode: string; returnTo: string }) {
  const [state, action, pending] = useActionState(login, {});
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const isPin = mode === "viewer";
  const name = isPin ? "pin" : "password";
  useEffect(() => {
    if (state.field) (formRef.current?.elements.namedItem(state.field) as HTMLInputElement | null)?.focus();
  }, [state]);
  return <form ref={formRef} action={action} className="yks-login-form space-y-4" aria-busy={pending}>
    <input type="hidden" name="mode" value={mode} /><input type="hidden" name="returnTo" value={returnTo} />
    {!isPin && <label className="block" htmlFor="login-email">E-posta<input id="login-email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} spellCheck={false} autoComplete="username" required maxLength={254} className={inputClass} /></label>}
    <div>
      <label htmlFor="login-secret">{isPin ? "10 haneli PIN" : "Şifre"}</label>
      <div className="mt-1 flex min-w-0 gap-2">
        <input id="login-secret" name={name} type={show ? "text" : "password"} inputMode={isPin ? "numeric" : undefined} pattern={isPin ? "[0-9]{10}" : undefined} minLength={isPin ? 10 : undefined} maxLength={isPin ? 10 : 1024} spellCheck={false} autoComplete={isPin ? "off" : "current-password"} required aria-invalid={state.field === name || undefined} aria-describedby={state.field === name ? "login-field-error" : isPin ? "pin-hint" : undefined} className="yks-input" />
        <button type="button" aria-controls="login-secret" aria-pressed={show} aria-label={`${isPin ? "PIN’i" : "Şifreyi"} ${show ? "gizle" : "göster"}`} onClick={() => setShow(v => !v)} className={buttonClass}>{show ? "Gizle" : "Göster"}</button>
      </div>
      {isPin && <p id="pin-hint" className="mt-2 text-xs leading-6 text-muted">Yöneticinin paylaştığı PIN’i gir veya yapıştır. Erişimin yalnızca görüntüleme içindir. PIN’in süresi dolduysa yöneticiden yenisini iste.</p>}
      {state.field && <p id="login-field-error" role="alert" className="mt-2 text-red-700 dark:text-red-400">{state.error}</p>}
    </div>
    <Feedback state={state.field ? {} : state} /><button disabled={pending} className={buttonClass}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button>
  </form>;
}

function CopyPin({ pin }: { pin: string }) {
  const [message, setMessage] = useState("");
  return <div className="mt-3 flex flex-wrap items-center gap-3">
    <button type="button" className={buttonClass} onClick={async () => {
      try { await navigator.clipboard.writeText(pin); setMessage("PIN kopyalandı."); }
      catch { setMessage("Kopyalanamadı. PIN’i seçip elle kopyalayabilirsin."); }
    }}>PIN’i kopyala</button>
    <p role="status" className="text-muted">{message}</p>
  </div>;
}

export function PinForm() {
  const [state, action, pending] = useActionState(createPin, {});
  return <form action={action} className="space-y-4" aria-busy={pending}>
    <label className="block">Kişi / açıklama<input name="label" autoComplete="off" required maxLength={100} className={inputClass} /></label>
    <label className="block">Geçerlilik (gün)<input name="days" type="number" inputMode="numeric" autoComplete="off" min={1} max={365} defaultValue={30} required className={inputClass} /></label>
    <Feedback state={state} />
    {state.pin && <div className="rounded-lg border border-accent bg-accent-soft p-4">
      <output aria-label="Yeni izleyici PIN’i" aria-live="polite" className="block select-all break-all font-mono text-2xl tracking-widest">{state.pin}</output>
      {state.expiresAt && <p className="mt-2 text-muted">Son tarih: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date(state.expiresAt))}</p>}
      <CopyPin key={state.pin} pin={state.pin} />
    </div>}
    <button disabled={pending} className={buttonClass}>{pending ? "Oluşturuluyor…" : "PIN oluştur"}</button>
  </form>;
}

export function RemoveButton({ id, kind, label }: { id: string; kind: "exam" | "pin"; label?: string }) {
  const [state, action, pending] = useActionState(kind === "exam" ? deleteExam : revokePin, {});
  return <form action={action} onSubmit={event => { if (!window.confirm(kind === "exam" ? `${label ?? "Bu kayıt"} kalıcı olarak silinsin mi?` : `${label ?? "Bu PIN"} için erişim iptal edilsin mi?`)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><button className={buttonClass} aria-label={label ? `${label}: ${kind === "exam" ? "Denemeyi sil" : "Erişimi iptal et"}` : undefined} disabled={pending}>{pending ? "İşleniyor…" : kind === "exam" ? "Sil" : "İptal et"}</button><Feedback state={state} /></form>;
}
