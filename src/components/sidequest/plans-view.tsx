"use client";
import type { PlansProps } from "./types";

import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { PageHeading, EmptyState } from "./shared";
export function PlansView({
  plans,
  negotiations,
  onNegotiation,
  onSelect,
  onDiscover,
}: PlansProps) {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Your plans"
        title="Good things on the calendar"
        copy="Review proposals, follow your Scouts’ conversations and request changes. Plans are confirmed only after every human approves."
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_290px]">
        <div className="space-y-4">
          {negotiations.map((item) => (
            <Button
              design
              key={item.id}
              onClick={() => onNegotiation(item.id)}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border bg-white p-5 text-left"
            >
              <span className="font-semibold">{item.title}</span>
              <span className="text-xs text-[#627067] capitalize">
                {item.status.toLowerCase().replaceAll("_", " ")}
              </span>
            </Button>
          ))}
          {plans.map((e) => (
            <Button
              design
              key={e.id}
              onClick={() => onSelect(e)}
              className="group flex w-full flex-col overflow-hidden rounded-[24px] border border-[#dfe2da] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#27372d]/10 sm:flex-row"
              type="button"
            >
              <img
                src={e.image}
                alt=""
                className="h-44 w-full object-cover sm:h-auto sm:w-52"
              />
              <div className="flex flex-1 items-center justify-between gap-4 p-5">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#dff4c7] px-2.5 py-1 text-[11px] font-bold text-[#315c3e]">
                      {"Confirmed by everyone"}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">
                    {e.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#667169]">
                    {e.date}
                    {" · "}
                    {e.time}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[#667169]">
                    <Icon name="pin" className="h-4 w-4" />
                    {e.location}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-[#667169]">
                    <div className="flex -space-x-2">
                      {e.people.slice(0, 3).map((e, s) => (
                        <span
                          key={e}
                          className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[9px] font-bold ${["bg-[#d8c4b6]", "bg-[#c5d6c1]", "bg-[#c4cee0]"][s]}`}
                        >
                          {e[0]}
                        </span>
                      ))}
                    </div>
                    {"with "}
                    {e.people.join(", ")}
                  </div>
                </div>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0f2ec] text-[#244a36] transition group-hover:bg-[#244a36] group-hover:text-white">
                  <Icon name="chevron" className="h-4 w-4" />
                </span>
              </div>
            </Button>
          ))}
          {!plans.length && !negotiations.length && (
            <EmptyState
              title="Your calendar is wide open"
              copy="When you accept a SideQuest, it will appear here with everything you need."
              action="Discover plans"
              onAction={onDiscover}
            />
          )}
        </div>
        <aside className="h-fit rounded-[24px] bg-[#244a36] p-6 text-white">
          <Icon name="spark" className="h-5 w-5 text-[#c9ed93]" />
          <h3 className="mt-5 text-xl font-semibold">
            {"Let Scout coordinate"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {
              "Scout can handle the awkward parts: finding overlap, checking budgets, and suggesting a fair meeting point."
            }
          </p>
          <Button
            design
            onClick={onDiscover}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9ed93] px-4 py-3 text-sm font-bold text-[#244a36]"
            type="button"
          >
            <Icon name="plus" className="h-4 w-4" />
            {"Find another plan"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
