import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { loadTopicCatalog } from "@/lib/topic-analysis";
import { normalizeTopic } from "@/lib/exam-import/normalize";
import { combineTopics, metricsOf } from "@/lib/topic-stats";
import { topicSubjectAllowed, type TopicCatalog } from "@/lib/topic-view";
import { queryValue, type Query } from "@/lib/yks-navigation";
import { number } from "../../tyt/data";
import { AccountBar } from "../../tyt/account-bar";
import { assignTopic, clearTopicGroup, deleteTopicAlias, saveTopicAlias } from "../topic-actions";

export const metadata: Metadata = { title: "Konu Yönetimi | YKS 2027", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  saved: "Konu grubu güncellendi. Bu konunun geçmiş soruları yeni grupta sayılır.",
  cleared: "Konu gruptan çıkarıldı. Geçmiş sorular artık o grupta sayılmaz.",
  confirm: "Değişikliği kaydetmek için onay kutusunu işaretle.",
  alias: "Takma ad kaydedildi. Aynı etikete sahip grupsuz bir konu varsa o da bağlandı.",
  "alias-removed": "Takma ad silindi. Var olan konu eşlemesi duruyor.",
  invalid: "Kayıt doğrulanamadı. Ders ile grubun aynı olduğunu ve takma adın bir grup adıyla çakışmadığını kontrol et.",
};

function affected(topic: TopicCatalog["topics"][number]) {
  return topic.counts.valid + topic.counts.cancelled;
}

function TopicForms({ topic, groups, subject, q }: { topic: TopicCatalog["topics"][number]; groups: TopicCatalog["groups"]; q: string; subject: string }) {
  const questions = affected(topic);
  const metrics = metricsOf(topic);
  return <article id={`konu-${topic.id}`} className="scroll-mt-6 border-t border-border py-4">
    <p className="break-words font-medium">{topic.name}</p>
    <p className="mt-1 text-sm text-muted tabular-nums">{number(questions, 0)} soru etkilenir · {number(metrics.valid, 0)} geçerli · {number(metrics.cancelled, 0)} iptal{normalizeTopic(topic.name) === "iptal" ? " · İPTAL bir müfredat konusu değildir" : ""}</p>
    <form action={assignTopic} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="topicId" value={topic.id} />
      {subject ? <input type="hidden" name="subject" value={subject} /> : null}
      {q ? <input type="hidden" name="q" value={q} /> : null}
      <label className="block min-w-0 text-sm">Grup
        <select name="groupId" defaultValue={topic.groupId ?? ""} required={topic.groupId === null} className="yks-input mt-1" aria-label={`${topic.name} için grup`}>
          {topic.groupId === null ? <option value="">Grup seç</option> : null}
          {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Geçmiş sorular bu grupta sayılsın</label>
        <button className="yks-button" aria-label={`${topic.name}: Gruba bağla`}>Gruba bağla</button>
      </div>
    </form>
    {topic.groupId ? <form action={clearTopicGroup} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="topicId" value={topic.id} />
      {subject ? <input type="hidden" name="subject" value={subject} /> : null}
      {q ? <input type="hidden" name="q" value={q} /> : null}
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Geçmiş sorular grup toplamından çıksın</label>
      <button className="yks-button" aria-label={`${topic.name}: Gruptan çıkar`}>Gruptan çıkar</button>
    </form> : null}
  </article>;
}

export default async function TopicAdminPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireAdmin();
  const query = await searchParams;
  const subject = topicSubjectAllowed(queryValue(query.subject)) ? queryValue(query.subject) : "";
  const q = queryValue(query.q).trim().slice(0, 100);
  const notice = notices[queryValue(query.notice)] ?? "";
  const needle = normalizeTopic(q);
  const catalog = await loadTopicCatalog();
  const inSubject = (id: string) => !subject || id === subject;
  const matches = (...names: string[]) => !needle || names.some(name => normalizeTopic(name).includes(needle));
  const topics = catalog.topics.filter(topic => inSubject(topic.subjectId));
  const unassigned = topics.filter(topic => !topic.groupId && matches(topic.name));
  const subjectOptions = catalog.subjects.filter(item => catalog.groups.some(group => group.subjectId === item.id)).sort((a, b) => a.displayOrder - b.displayOrder);
  const visibleSubjects = subject ? subjectOptions.filter(item => item.id === subject) : subjectOptions;
  return <main className="yks-page"><div className="mx-auto max-w-5xl">
    <AccountBar admin />
    <header className="mb-6">
      <nav aria-label="İçerik yolu" className="mb-3"><ol className="flex flex-wrap items-center gap-2 text-xs text-muted"><li><Link href="/yks27/admin" className="inline-flex items-center hover:text-accent">Yönetim</Link></li><li aria-hidden="true">/</li><li aria-current="page">Konu yönetimi</li></ol></nav>
      <h1 id="yks-content" tabIndex={-1} className="text-3xl font-semibold tracking-tight">Konu Yönetimi</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">İçe aktarılan etiketleri müfredat gruplarına bağla. Soru kayıtları değişmez; istatistikler konu ile grup ilişkisi üzerinden hesaplanır.</p>
      <p className="mt-3"><Link href="/yks27/tyt/topics" className="text-accent hover:underline">Konu başarı analizine git</Link></p>
    </header>
    {notice ? <p role="status" className="mb-4 rounded-lg border border-border bg-surface-muted px-4 py-3">{notice}</p> : null}
    <form action="/yks27/admin/topics" className="yks-panel mb-6 grid gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-end">
      <label className="block min-w-0">Ders
        <select name="subject" defaultValue={subject} className="yks-input mt-1">
          <option value="">Tüm dersler</option>
          {subjectOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block min-w-0">Konu veya takma ad ara
        <input type="search" name="q" defaultValue={q} maxLength={100} autoComplete="off" placeholder="Örn. kök…" className="yks-input mt-1" />
      </label>
      <button className="yks-button">Filtrele</button>
    </form>
    <p className="mb-6 text-sm text-muted tabular-nums">{number(catalog.groups.filter(group => inSubject(group.subjectId)).length, 0)} grup · {number(topics.filter(topic => topic.groupId).length, 0)} bağlı konu · {number(topics.filter(topic => !topic.groupId).length, 0)} grupsuz konu · {number(catalog.aliases.filter(alias => inSubject(alias.subjectId)).length, 0)} takma ad</p>
    <section id="gruplanmamis" aria-labelledby="unassigned-heading" className="yks-panel mb-6 scroll-mt-6">
      <h2 id="unassigned-heading" className="text-xl font-semibold">Grupsuz konular ({number(unassigned.length, 0)})</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Otomatik eşleşme bunları bir gruba zorlamaz. Birden fazla müfredat başlığını kapsayan etiketleri ve İPTAL’i boş bırakabilirsin.</p>
      {unassigned.length === 0 ? <p className="mt-4 text-muted">Bu filtrede grupsuz konu yok.</p> : unassigned.map(topic => <TopicForms key={topic.id} topic={topic} groups={catalog.groups.filter(group => group.subjectId === topic.subjectId).sort((a, b) => a.displayOrder - b.displayOrder)} subject={subject} q={q} />)}
    </section>
    {visibleSubjects.map(subjectRow => {
      const groups = catalog.groups.filter(group => group.subjectId === subjectRow.id).sort((a, b) => a.displayOrder - b.displayOrder);
      const shown = groups.filter(group => {
        const names = topics.filter(topic => topic.groupId === group.id).map(topic => topic.name);
        const aliases = catalog.aliases.filter(alias => alias.groupId === group.id).map(alias => alias.alias);
        return matches(group.name, ...names, ...aliases);
      });
      if (needle && shown.length === 0) return null;
      return <section key={subjectRow.id} aria-labelledby={`subject-${subjectRow.id}`} className="mb-8">
        <h2 id={`subject-${subjectRow.id}`} className="text-xl font-semibold">{subjectRow.name}</h2>
        <div className="mt-3 space-y-3">{(needle ? shown : groups).map(group => {
          const members = topics.filter(topic => topic.groupId === group.id && (!needle || matches(group.name, topic.name)));
          const aliases = catalog.aliases.filter(alias => alias.groupId === group.id && (!needle || matches(group.name, alias.alias)));
          const totals = combineTopics(topics.filter(topic => topic.groupId === group.id));
          return <details key={group.id} id={`grup-${group.id}`} open={Boolean(needle)} className="yks-topic-card scroll-mt-6 rounded-xl border border-border bg-surface">
            <summary className="min-h-11 cursor-pointer px-4 py-4 hover:bg-surface-muted"><span className="block break-words font-semibold">{group.name}</span><span className="mt-1 block text-sm text-muted tabular-nums">{number(members.length, 0)} görünen konu · {number(totals.valid + totals.cancelled, 0)} soru</span></summary>
            <div className="border-t border-border px-4 pb-4">
              {members.length === 0 ? <p className="pt-4 text-sm text-muted">Bu grupta içe aktarılmış konu yok.</p> : members.map(topic => <TopicForms key={topic.id} topic={topic} groups={groups} subject={subject} q={q} />)}
              <h3 className="mt-5 font-semibold">Takma adlar</h3>
              <p className="mt-1 text-sm text-muted">Yeni bir denemede aynı etiket ilk kez görülürse bu gruba bağlanır. Silmek, daha önce bağlanmış konunun grubunu değiştirmez.</p>
              {aliases.length === 0 ? <p className="mt-3 text-sm text-muted">Takma ad yok.</p> : <ul className="mt-3 divide-y divide-border">{aliases.map(alias => <li key={alias.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 break-words">{alias.alias}</span>
                <form action={deleteTopicAlias} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="aliasId" value={alias.id} />
                  <input type="hidden" name="groupId" value={group.id} />
                  {subject ? <input type="hidden" name="subject" value={subject} /> : null}
                  {q ? <input type="hidden" name="q" value={q} /> : null}
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Silmeyi onayla</label>
                  <button className="yks-button" aria-label={`${alias.alias}: Takma adı sil`}>Takma adı sil</button>
                </form>
              </li>)}</ul>}
              <form action={saveTopicAlias} className="mt-4 grid gap-3">
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="subjectId" value={group.subjectId} />
                {subject ? <input type="hidden" name="subject" value={subject} /> : null}
                {q ? <input type="hidden" name="q" value={q} /> : null}
                <label className="block text-sm">Yeni takma ad
                  <input name="alias" required maxLength={300} autoComplete="off" placeholder="Yayınevinin kullandığı etiket…" className="yks-input mt-1" />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required /> Bu etiketi gruba bağla</label>
                  <button className="yks-button">Takma ad ekle</button>
                </div>
              </form>
            </div>
          </details>;
        })}</div>
      </section>;
    })}
  </div></main>;
}
