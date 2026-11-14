"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { topicGroupIds } from "@/lib/topic-stats";

const GroupState = createContext<{ group: string; toggle: (id: string, open: boolean) => void } | null>(null);
export const useGroupState = () => useContext(GroupState);

export function GroupStateProvider({ searchGroups, children }: { searchGroups: string[]; children: ReactNode }) {
  const search = useSearchParams();
  // An explicit empty selection keeps search results closed across reloads.
  const group = search.has("group") ? topicGroupIds(search.getAll("group")).join(",") || "none" : searchGroups.join(",");
  function toggle(id: string, open: boolean) {
    const next = new URLSearchParams(window.location.search);
    const ids = new Set(topicGroupIds(next.has("group") ? next.getAll("group") : group));
    if (open) ids.add(id); else ids.delete(id);
    next.set("group", [...ids].join(",") || "none");
    window.history.pushState(null, "", `${window.location.pathname}?${next}${window.location.hash}`);
  }
  return <GroupState value={{ group, toggle }}>{children}</GroupState>;
}

export function GroupStateInput() {
  const state = useGroupState();
  return state?.group ? <input type="hidden" name="group" value={state.group} /> : null;
}

export function TopicFilterForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const search = useSearchParams();
  return <form action="/yks27/tyt/topics" className="yks-filter-form" onSubmit={event => {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") next.append(key, value);
    }
    // A new search reveals its matches; other filter changes retain selection.
    if ((next.get("q") ?? "").trim() !== (search.get("q") ?? "").trim()) next.delete("group");
    router.push(`/yks27/tyt/topics?${next}`, { scroll: false });
  }}>{children}</form>;
}
