import { WorkspaceEmpty } from "../../workspace-ui";

export default function ExamNotFound() {
  return <main className="yks-page"><div><h1 id="yks-content" tabIndex={-1} className="mb-6">TYT denemesi bulunamadı</h1><WorkspaceEmpty title="Bu bağlantıya ait TYT denemesi yok" href="/yks27/tyt" action="TYT denemelerine dön">Deneme kaldırılmış veya bağlantı yanlış olabilir. Kayıtlı denemelerinden birini aç.</WorkspaceEmpty></div></main>;
}
