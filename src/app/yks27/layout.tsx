export default function YksLayout({ children }: { children: React.ReactNode }) {
  return <div className="yks" lang="tr">
    <a href="#yks-content" className="skip-link">İçeriğe geç</a>
    {children}
  </div>;
}
