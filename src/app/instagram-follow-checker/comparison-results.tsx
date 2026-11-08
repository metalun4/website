import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { instagramProfileUrl, type InstagramComparison } from "@/lib/instagram-follow-checker";

const pageSize = 50;

export function ComparisonResults({ comparison }: { comparison: InstagramComparison }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const { followers, following, followingBack, notFollowingBack } = comparison;
  const search = query.trim().replace(/^@/, "").toLowerCase();
  const matches = useMemo(() => search
    ? notFollowingBack.filter(username => username.toLowerCase().includes(search))
    : notFollowingBack, [search, notFollowingBack]);
  const start = page * pageSize;
  const end = Math.min(start + pageSize, matches.length);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section aria-labelledby="comparison-results" className="mt-8">
      <h2 id="comparison-results" ref={heading} tabIndex={-1} className="scroll-mt-6 text-xl font-semibold tracking-tight">
        Comparison results
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 sm:p-6">
        {[
          { label: "Followers", value: followers },
          { label: "Following", value: following },
          { label: "Following back", value: followingBack },
          { label: "Not following back", value: notFollowingBack.length },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString("en")}</dd>
          </div>
        ))}
      </dl>
      {notFollowingBack.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-muted">
          {following === 0 ? "Your export shows that you follow 0 accounts." : "Everyone you follow also follows you back in this export."}
        </p>
      ) : (
        <div className="mt-6">
          <h3 className="text-base font-semibold tracking-tight">Accounts not following back</h3>
          <p className="mt-1 text-sm leading-6 text-muted">Profile links open on Instagram in a new tab.</p>
          <label htmlFor="instagram-search" className="mt-4 block text-sm font-medium">Search usernames</label>
          <div className="relative mt-1 max-w-sm">
            <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <input
              id="instagram-search"
              type="search"
              value={query}
              onChange={event => { setQuery(event.currentTarget.value); setPage(0); }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter a username"
              className="min-h-12 w-full rounded-lg border border-subtle bg-surface py-2 ps-9 pe-3 text-base placeholder:text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p role="status" className="text-muted">
              {matches.length === 0
                ? "No usernames match your search. Try a different name."
                : `Showing ${(start + 1).toLocaleString("en")}–${end.toLocaleString("en")} of ${matches.length.toLocaleString("en")}`}
            </p>
            {matches.length > pageSize && (
              <div className="flex gap-2" role="group" aria-label="Result pages">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="portfolio-button portfolio-button-secondary enabled:cursor-pointer">Previous</button>
                <button type="button" disabled={end === matches.length} onClick={() => setPage(page + 1)} className="portfolio-button portfolio-button-secondary enabled:cursor-pointer">Next</button>
              </div>
            )}
          </div>
          {matches.length > 0 && (
            <ul aria-label="Accounts not following back" className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface">
              {matches.slice(start, end).map(username => {
                const profileUrl = instagramProfileUrl(username);
                return (
                  <li key={username} className="px-4 text-sm font-medium wrap-anywhere sm:px-6" translate="no">
                    {profileUrl ? (
                      <a href={profileUrl} target="_blank" rel="noopener noreferrer nofollow" className="portfolio-text-link flex min-h-11 items-center justify-between gap-3 py-2">
                        <span>@{username}</span>
                        <ArrowUpRight size={16} className="shrink-0 text-subtle" aria-hidden="true" />
                        <span className="sr-only" translate="yes"> on Instagram (opens in a new tab)</span>
                      </a>
                    ) : <span className="inline-flex min-h-11 items-center py-2">@{username}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
