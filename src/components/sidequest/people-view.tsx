"use client";
import * as React from "react";
import type { PeopleProps } from "./types";

import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { PageHeading, PersonAvatar } from "./shared";
export function PeopleView({ invited, onInvite, people, busy }: PeopleProps) {
  const [filter, setFilter] = React.useState("Free now");
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Discover people"
        title="People open to a SideQuest"
        copy="Availability is shared at a high level. Scout never reveals private calendar details or personal notes."
      />
      <div className="mt-7 flex flex-wrap gap-2">
        {["Open to planning"].map((e) => (
          <Button
            design
            key={e}
            onClick={() => setFilter(e)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === e ? "bg-[#244a36] text-white" : "border border-[#d8ddd5] bg-white text-[#667169]"}`}
            type="button"
          >
            {e}
          </Button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {!people.length && (
          <p className="text-sm text-[#627067]">
            No permitted people are discoverable yet. Check your discovery and
            sharing settings; both people must opt in.
          </p>
        )}
        {people.map((s) => (
          <article
            key={s.id}
            className="rounded-[22px] border border-[#dfe2da] bg-white p-5"
          >
            <div className="flex items-start gap-4">
              <PersonAvatar person={s} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{s.name}</h2>
                    <p className="mt-0.5 text-xs font-medium text-[#5d7a61]">
                      {s.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[#627067]">
                    {s.overlap}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.interests.map((e) => (
                    <span
                      key={e}
                      className="rounded-lg bg-[#f4f5f1] px-2.5 py-1.5 text-xs text-[#69746c]"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                design
                onClick={() => onInvite(s.id)}
                disabled={busy}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${invited.includes(s.id) ? "bg-[#dff4c7] text-[#244a36]" : "bg-[#244a36] text-white"}`}
                type="button"
              >
                <Icon
                  name={invited.includes(s.id) ? "check" : "spark"}
                  className="h-4 w-4"
                />
                {invited.includes(s.id) ? "Negotiation started" : "Ask Scout"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
