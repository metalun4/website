import { WorkspaceEmpty } from "./workspace-ui";
export default function NotFound() {
  return <main className="yks-page"><div><h1 id="yks-content" tabIndex={-1} className="mb-6">Sayfa bulunamadı</h1><WorkspaceEmpty title="Aradığın sayfa burada değil" href="/yks27" action="Genel bakışa dön">Çalışma alanındaki sayfalara menüden ulaşabilirsin.</WorkspaceEmpty></div></main>;
}
