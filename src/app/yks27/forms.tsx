"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPin, deleteExam, login, revokePin, type ActionState } from "./actions";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const inputClass = " mt-1";
function Feedback({ state }: { state: ActionState }) {
  return <div aria-live="polite">{state.error && <Alert variant="destructive" className="my-3"><AlertDescription>{state.error}</AlertDescription></Alert>}{state.success && <p className="my-3">{state.success}</p>}</div>;
}

export function LoginForm({ returnTo = "/yks27" }: { returnTo?: string }) {
  const [mode, setMode] = useState("viewer");
  return <>
    <ToggleGroup type="single" value={mode} onValueChange={value => { if(value) setMode(value); }} className="mb-6 w-full" aria-label="Giriş yöntemi">
      {[{ id: "viewer", name: "İzleyici PIN’i" }, { id: "admin", name: "Yönetici" }].map(item => <ToggleGroupItem key={item.id} value={item.id} className="flex-1">{item.name}</ToggleGroupItem>)}
    </ToggleGroup>
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
  return <form ref={formRef} action={action} className="yks-login-form flex flex-col gap-4" aria-busy={pending}>
    <input type="hidden" name="mode" value={mode} /><input type="hidden" name="returnTo" value={returnTo} /><FieldGroup>
    {!isPin && <Field><FieldLabel htmlFor="login-email">E-posta</FieldLabel><Input id="login-email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} spellCheck={false} autoComplete="username" required maxLength={254} className={inputClass} /></Field>}
    <Field data-invalid={state.field === name || undefined}>
      <FieldLabel htmlFor="login-secret">{isPin ? "10 haneli PIN" : "Şifre"}</FieldLabel>
      <div className="mt-1 flex min-w-0 gap-2">
        <Input id="login-secret" name={name} type={show ? "text" : "password"} inputMode={isPin ? "numeric" : undefined} pattern={isPin ? "[0-9]{10}" : undefined} minLength={isPin ? 10 : undefined} maxLength={isPin ? 10 : 1024} spellCheck={false} autoComplete={isPin ? "off" : "current-password"} required aria-invalid={state.field === name || undefined} aria-describedby={state.field === name ? "login-field-error" : isPin ? "pin-hint" : undefined} className="" />
        <Button type="button" aria-controls="login-secret" aria-pressed={show} aria-label={`${isPin ? "PIN’i" : "Şifreyi"} ${show ? "gizle" : "göster"}`} onClick={() => setShow(v => !v)} variant="outline">{show ? "Gizle" : "Göster"}</Button>
      </div>
      {isPin && <p id="pin-hint" className="mt-2 text-xs leading-6 text-muted">Yöneticinin paylaştığı PIN’i gir veya yapıştır. Erişimin yalnızca görüntüleme içindir. PIN’in süresi dolduysa yöneticiden yenisini iste.</p>}
      {state.field && <p id="login-field-error" role="alert" className="mt-2 text-incorrect">{state.error}</p>}
    </Field></FieldGroup>
    <Feedback state={state.field ? {} : state} /><Button disabled={pending} variant="outline">{pending ? "Giriş yapılıyor…" : "Giriş yap"}</Button>
  </form>;
}

function CopyPin({ pin }: { pin: string }) {
  const [message, setMessage] = useState("");
  return <div className="mt-3 flex flex-wrap items-center gap-3">
    <Button type="button" variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(pin); setMessage("PIN kopyalandı."); }
      catch { setMessage("Kopyalanamadı. PIN’i seçip elle kopyalayabilirsin."); }
    }}>PIN’i kopyala</Button>
    <p role="status" className="text-muted">{message}</p>
  </div>;
}

export function PinForm() {
  const [state, action, pending] = useActionState(createPin, {});
  return <form action={action} aria-busy={pending}><FieldGroup>
    <Field><FieldLabel htmlFor="pin-label">Kişi / açıklama</FieldLabel><Input id="pin-label" name="label" autoComplete="off" required maxLength={100} className={inputClass} /></Field>
    <Field><FieldLabel htmlFor="pin-days">Geçerlilik (gün)</FieldLabel><Input id="pin-days" name="days" type="number" inputMode="numeric" autoComplete="off" min={1} max={365} defaultValue={30} required className={inputClass} /></Field>
    <Feedback state={state} />
    {state.pin && <div className="rounded-lg border border-accent bg-accent-soft p-4">
      <output aria-label="Yeni izleyici PIN’i" aria-live="polite" className="block select-all break-all font-mono text-2xl tracking-widest">{state.pin}</output>
      {state.expiresAt && <p className="mt-2 text-muted">Son tarih: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date(state.expiresAt))}</p>}
      <CopyPin key={state.pin} pin={state.pin} />
    </div>}
    <Button disabled={pending} variant="outline">{pending ? "Oluşturuluyor…" : "PIN oluştur"}</Button></FieldGroup>
  </form>;
}

export function RemoveButton({ id, kind, label }: { id: string; kind: "exam" | "pin"; label?: string }) {
  const [state, action, pending] = useActionState(kind === "exam" ? deleteExam : revokePin, {});
  return <form action={action} onSubmit={event => { if (!window.confirm(kind === "exam" ? `${label ?? "Bu kayıt"} kalıcı olarak silinsin mi?` : `${label ?? "Bu PIN"} için erişim iptal edilsin mi?`)) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><Button variant="outline" aria-label={label ? `${label}: ${kind === "exam" ? "Denemeyi sil" : "Erişimi iptal et"}` : undefined} disabled={pending}>{pending ? "İşleniyor…" : kind === "exam" ? "Sil" : "İptal et"}</Button><Feedback state={state} /></form>;
}
