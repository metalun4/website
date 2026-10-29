export type Query = Record<string, string | string[] | undefined>;
export const queryValue = (value: Query[string]) => typeof value === "string" ? value : "";

// Only existing workspace destinations are accepted, including when posted by a client.
export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/yks27";
  try {
    const url = new URL(value, "https://yks.invalid");
    if (!/^\/yks27(?:\/(?:ayt|admin(?:\/topics)?|tyt(?:\/(?:dashboard|topics|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?))?$/i.test(url.pathname)) return "/yks27";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/yks27"; }
}

export function loginHref(returnTo: string) {
  const target = safeReturnTo(returnTo);
  return target === "/yks27" ? "/yks27/login" : `/yks27/login?returnTo=${encodeURIComponent(target)}`;
}
