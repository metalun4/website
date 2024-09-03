export function Social({ socialUrl, styleClass, children}) {
  return (
      <a className={styleClass} href={socialUrl} target="_blank">{children}</a>
  );
}