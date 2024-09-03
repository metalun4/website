export function Section({sectionTitle, children}) {
  return (
      <div className="flex-row m-2 m-lg-5">
        <h4 className="border-bottom">{sectionTitle}</h4>
        {children}
      </div>
  );
}