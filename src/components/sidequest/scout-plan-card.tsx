"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export function ScoutPlanCard({
  id,
  userId,
  onOpen,
  onSuggest,
}: {
  id: string;
  userId: string;
  onOpen: () => void;
  onSuggest: () => void;
}) {
  const utils = api.useUtils();
  const detail = api.sidequest.getNegotiation.useQuery(
    { id },
    {
      refetchInterval: (query) =>
        ["DISCOVERING", "NEGOTIATING"].includes(query.state.data?.status ?? "")
          ? 2000
          : 5000,
    },
  );
  const approve = api.sidequest.approveProposal.useMutation();
  const decline = api.sidequest.rejectProposal.useMutation();
  const [error, setError] = useState("");
  const plan = detail.data;
  if (!plan)
    return (
      <p role="status">
        {detail.isError ? "The plan is unavailable." : "Loading your plan…"}
      </p>
    );

  const proposal = plan.proposals.find(
    (item) => item.id === plan.activeProposalId,
  );
  const approved = plan.approvals.some(
    (vote) => vote.approved && vote.userId === userId,
  );
  const question = plan.events.find(
    (event) => event.type === "HUMAN_INPUT_REQUESTED",
  )?.detail.question;
  async function decide(accept: boolean) {
    if (!proposal) return;
    setError("");
    try {
      const decision = {
        negotiationId: id,
        proposalId: proposal.id,
        hash: proposal.hash,
      };
      await (accept ? approve : decline).mutateAsync(decision);
      await utils.sidequest.invalidate();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your decision.",
      );
    }
  }

  return (
    <section
      aria-label="Plan in Scout chat"
      className="rounded-2xl border border-[#dfe2da] bg-[#f4f7ee] p-4"
    >
      <p role="status" className="text-sm font-medium text-[#465d4b]">
        {plan.status === "CONFIRMED"
          ? "Confirmed"
          : plan.status === "AWAITING_APPROVAL"
            ? approved
              ? "You’re in. Waiting for the others."
              : "Ready for your decision"
            : plan.status === "AWAITING_USER_INPUT"
              ? "Waiting for a reply"
              : plan.status === "FAILED"
                ? plan.failure === "PROPOSAL_EXPIRED"
                  ? "The proposal expired before everyone approved"
                  : "This plan needs a change"
                : plan.status === "CANCELLED"
                  ? "Plan cancelled"
                  : "Scout is checking what works for the group…"}
      </p>
      {proposal && (
        <>
          <h3 className="mt-1 text-lg font-semibold">
            {proposal.activitySnapshot.title}
          </h3>
          <p className="mt-1 text-sm">
            {proposal.plan.start &&
              new Date(proposal.plan.start).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            {" · "}
            {proposal.activitySnapshot.location}
            {" · ₩"}
            {proposal.activitySnapshot.cost.toLocaleString()}/person
          </p>
        </>
      )}
      <p className="mt-2 text-sm">
        {plan.participantNames
          .map((person) => (person.id === userId ? "You" : person.name))
          .join(", ")}
      </p>
      {plan.status === "AWAITING_USER_INPUT" &&
        typeof question === "string" && (
          <p className="mt-2 text-sm">{question}</p>
        )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {proposal && plan.status === "AWAITING_APPROVAL" && !approved && (
          <>
            <Button
              design
              type="button"
              disabled={approve.isPending || decline.isPending}
              onClick={() => void decide(true)}
              className="rounded-lg bg-[#244a36] px-3 py-2 text-sm font-semibold text-white"
            >
              I’m in
            </Button>
            <Button
              design
              type="button"
              disabled={approve.isPending || decline.isPending}
              onClick={() => void decide(false)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Pass
            </Button>
          </>
        )}
        {[
          "AWAITING_APPROVAL",
          "AWAITING_USER_INPUT",
          "CONFIRMED",
          "FAILED",
        ].includes(plan.status) && (
          <Button
            design
            type="button"
            onClick={onSuggest}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            {plan.status === "AWAITING_USER_INPUT" &&
            typeof question === "string"
              ? "Reply to Scout"
              : "Suggest a change"}
          </Button>
        )}
        <Button
          design
          type="button"
          onClick={onOpen}
          className="rounded-lg px-3 py-2 text-sm underline"
        >
          Plan details
        </Button>
      </div>
    </section>
  );
}
