"use client";

import { useActionState, useState } from "react";
import { createPin, deleteExam, login, revokePin, type ActionState } from "./actions";

const inputClass = "mt-1 block min-w-0 w-full max-w-full rounded-lg border border-border bg-background px-3 py-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-accent";
const buttonClass = "rounded-lg border border-border bg-surface-emphasis min-h-11 px-4 py-2.5 font-medium hover:bg-surface-muted disabled:opacity-50";
function Feedback({ state }: { state: ActionState }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="my-3 text-red-600 dark:text-red-400">{state.error}</p>}{state.success && <p className="my-3">{state.success}</p>}</div>;
}

export function LoginForm() {
  const [mode, setMode] = useState("viewer");
  const [state, action, pending] = useActionState(login, {});
  return <><div className="mb-6 flex gap-1 rounded-xl border border-border bg-background p-1">{[{ id: "viewer", name: "İzleyici PIN’i" }, { id: "admin", name: "Yönetici" }].map(item => <button type="button" key={item.id} onClick={() => setMode(item.id)} aria-pressed={mode === item.id} className={`flex-1 rounded-lg px-4 py-2.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${mode === item.id ? "bg-foreground text-background shadow-sm" : "text-muted hover:bg-surface-muted hover:text-foreground"}`}>{item.name}</button>)}</div>
    <form action={action} className="yks-login-form space-y-4"><input type="hidden" name="mode" value={mode} />
      {mode === "admin" ? <><label className="block">E-posta<input name="email" type="email" spellCheck={false} autoComplete="username" required maxLength={254} className={inputClass} /></label><label className="block">Şifre<input name="password" type="password" autoComplete="current-password" required maxLength={1024} className={inputClass} /></label></> : <label className="block">PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} aria-describedby="pin-hint" autoComplete="off" required className={inputClass} /><span id="pin-hint" className="mt-2 block text-xs leading-6 text-muted">Yöneticinin paylaştığı 10 haneli PIN’i gir. Erişimin yalnızca görüntüleme içindir.</span></label>}
      <Feedback state={state} /><button disabled={pending} className={buttonClass}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button>
    </form></>;
}

export function PinForm() {
  const [state, action, pending] = useActionState(createPin, {});
  return <form action={action} className="space-y-4"><label className="block">Kişi / açıklama<input name="label" required maxLength={100} className={inputClass} /></label><label className="block">Geçerlilik (gün)<input name="days" type="number" min={1} max={365} defaultValue={30} required className={inputClass} /></label><Feedback state={state} />{state.pin && <output aria-live="polite" className="block select-all rounded-lg border border-border p-4 font-mono text-2xl tracking-widest">{state.pin}</output>}<button disabled={pending} className={buttonClass}>{pending ? "Oluşturuluyor…" : "PIN oluştur"}</button></form>;
}

export function RemoveButton({ id, kind }: { id: string; kind: "exam" | "pin" }) {
  const [state, action, pending] = useActionState(kind === "exam" ? deleteExam : revokePin, {});
  return <form action={action} onSubmit={event => { if (!window.confirm(kind === "exam" ? "Bu kayıt kalıcı olarak silinsin mi?" : "Bu PIN’in erişimi iptal edilsin mi?")) event.preventDefault(); }}><input type="hidden" name="id" value={id} /><button className={buttonClass} disabled={pending}>{pending ? "İşleniyor…" : kind === "exam" ? "Sil" : "İptal et"}</button><Feedback state={state} /></form>;
}
