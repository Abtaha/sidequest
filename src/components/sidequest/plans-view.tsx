"use client";
import { useState } from "react";
import type { PlansProps } from "./types";

import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { PageHeading } from "./shared";

const failureReasons: Record<string, string> = {
  HUMAN_REJECTED: "A participant declined the proposal.",
  GROUP_NEEDS_ANOTHER_OPTION: "The group needed another option.",
  AGENT_ENDED_NEGOTIATION:
    "The Scouts ended the negotiation without an agreement.",
  CONTACT_PERMISSION_CHANGED: "Participant contact permissions changed.",
  RESOURCE_BUDGET_EXHAUSTED: "The Scouts reached their negotiation limit.",
  MODEL_OR_CONTEXT_FAILURE: "The Scouts could not complete the negotiation.",
  ACTION_OR_DATABASE_FAILURE: "The plan could not be saved.",
};

const pendingStatuses: Record<string, string> = {
  AWAITING_APPROVAL: "Awaiting approvals",
  AWAITING_USER_INPUT: "Waiting for a response",
  NEGOTIATING: "Scouts are discussing",
  DISCOVERING: "Scouts are finding options",
};

export function PlansView({
  plans,
  negotiations,
  onNegotiation,
  onDiscover,
}: PlansProps) {
  const [showHistory, setShowHistory] = useState(false);
  const now = Date.now();
  const upcoming = plans
    .filter((plan) => plan.startAt > now)
    .sort((a, b) => a.startAt - b.startAt);
  const unsuccessful = negotiations.filter(
    ({ status }) => status === "FAILED" || status === "CANCELLED",
  );
  const awaitingApproval = negotiations.filter(
    ({ status, hasProposal }) => hasProposal && status in pendingStatuses,
  );

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Your plans"
        title={
          showHistory
            ? "Failed & Declined Plans"
            : "Good things on the calendar"
        }
        copy={
          showHistory
            ? "Review plans that didn’t work out."
            : "Review proposals, follow your Scouts’ conversations and request changes. Plans are confirmed only after every human approves."
        }
      />
      <Button
        design
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        className="mt-5 rounded-xl border border-[#dfe2da] bg-white px-4 py-2.5 text-sm font-semibold text-[#244a36] hover:bg-[#eef2e8]"
      >
        {showHistory ? "Back to Plans" : "View Failed & Declined Plans"}
      </Button>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_290px]">
        {showHistory ? (
          <div className="space-y-3">
            {unsuccessful.map((item) => (
              <Button
                design
                type="button"
                key={item.id}
                onClick={() => onNegotiation(item.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#dfe2da] bg-white p-5 text-left hover:bg-[#f7f8f4]"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block font-semibold">{item.title}</span>
                  {item.failure && (
                    <span className="mt-1 block text-sm text-[#627067]">
                      {failureReasons[item.failure] ??
                        (item.failure.startsWith("INVALID_ACTION:")
                          ? item.failure.slice("INVALID_ACTION:".length)
                          : item.failure.toLowerCase().replaceAll("_", " "))}
                    </span>
                  )}
                </span>
                <span className="rounded-full bg-[#f0f2ec] px-2.5 py-1 text-xs font-semibold text-[#627067]">
                  {item.failure === "HUMAN_REJECTED"
                    ? "Declined"
                    : item.status === "CANCELLED"
                      ? "Cancelled"
                      : "Failed"}
                </span>
              </Button>
            ))}
            {!unsuccessful.length && (
              <p className="rounded-2xl border border-[#dfe2da] bg-white p-5 text-sm text-[#627067]">
                No failed or declined plans.
              </p>
            )}
          </div>
        ) : (
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="upcoming-plans" className="space-y-4">
              <h2
                id="upcoming-plans"
                className="text-xl font-semibold tracking-[-0.03em]"
              >
                Upcoming Plans
              </h2>
              {upcoming.map((e) => (
                <Button
                  design
                  key={e.id}
                  onClick={() => onNegotiation(e.id)}
                  className="group flex w-full flex-col overflow-hidden rounded-[24px] border border-[#dfe2da] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#27372d]/10 sm:flex-row"
                  type="button"
                >
                  <div className="relative h-36 w-full shrink-0 sm:h-auto sm:w-40 xl:w-52">
                    <img
                      src={e.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 p-5">
                    <div className="min-w-0 break-words">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-[#dff4c7] px-2.5 py-1 text-[11px] font-bold text-[#315c3e]">
                          {"Confirmed by everyone"}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em]">
                        {e.title}
                      </h3>
                      <p className="mt-2 text-sm text-[#667169]">
                        {e.date}
                        {" · "}
                        {e.time}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-[#667169]">
                        <Icon name="pin" className="h-4 w-4" />
                        {e.location}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#667169]">
                        <div className="flex -space-x-2">
                          {e.participantNames.slice(0, 3).map((e, s) => (
                            <span
                              key={`${e}-${s}`}
                              className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[9px] font-bold ${["bg-[#d8c4b6]", "bg-[#c5d6c1]", "bg-[#c4cee0]"][s]}`}
                            >
                              {e[0]}
                            </span>
                          ))}
                        </div>
                        <span>{e.participantNames.join(", ")}</span>
                      </div>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0f2ec] text-[#244a36] transition group-hover:bg-[#244a36] group-hover:text-white">
                      <Icon name="chevron" className="h-4 w-4" />
                    </span>
                  </div>
                </Button>
              ))}
              {!upcoming.length && (
                <p className="rounded-2xl border border-[#dfe2da] bg-white p-5 text-sm text-[#627067]">
                  No upcoming plans yet.
                </p>
              )}
            </section>

            <section aria-labelledby="awaiting-approval" className="space-y-4">
              <h2
                id="awaiting-approval"
                className="text-xl font-semibold tracking-[-0.03em]"
              >
                Awaiting Approval
              </h2>
              {awaitingApproval.map((item) => (
                <Button
                  design
                  type="button"
                  key={item.id}
                  onClick={() => onNegotiation(item.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe2da] bg-white p-5 text-left hover:bg-[#f7f8f4]"
                >
                  <span className="min-w-0 font-semibold break-words">
                    {item.title}
                  </span>
                  <span className="rounded-full bg-[#eef2e8] px-2.5 py-1 text-xs font-semibold text-[#315c3e]">
                    {pendingStatuses[item.status]}
                  </span>
                </Button>
              ))}
              {!awaitingApproval.length && (
                <p className="rounded-2xl border border-[#dfe2da] bg-white p-5 text-sm text-[#627067]">
                  No proposals awaiting approval.
                </p>
              )}
            </section>
          </div>
        )}
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
