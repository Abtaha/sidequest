"use client";
import * as React from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { localDateValue, statusLabel } from "@/lib/sidequest-data";
export function NegotiationPanel({
  id,
  userId,
  onClose,
  onRun,
  running,
}: {
  id: string;
  userId: string;
  onClose: () => void;
  onRun: (id: string) => void;
  running: boolean;
}) {
  const utils = api.useUtils();
  const detail = api.sidequest.getNegotiation.useQuery(
    { id },
    {
      refetchInterval: (query) =>
        query.state.data?.status === "CANCELLED"
          ? false
          : ["DISCOVERING", "NEGOTIATING"].includes(
                query.state.data?.status ?? "",
              )
            ? 2000
            : 5000,
    },
  );
  const messages = api.sidequest.getMessages.useQuery(
    { id, afterTurn: -1 },
    {
      refetchInterval:
        detail.data &&
        ["DISCOVERING", "NEGOTIATING"].includes(detail.data.status)
          ? 2000
          : false,
    },
  );
  const approve = api.sidequest.approveProposal.useMutation(),
    reject = api.sidequest.rejectProposal.useMutation(),
    revise = api.sidequest.requestRevision.useMutation();
  const [error, setError] = React.useState("");
  const [instruction, setInstruction] = React.useState(""),
    [start, setStart] = React.useState(""),
    [end, setEnd] = React.useState("");
  const revisionRequest = React.useRef<{
    signature: string;
    requestId: string;
  } | null>(null);
  const n = detail.data,
    proposal = n?.proposals.find((p) => p.id === n.activeProposalId);
  const names = new Map(
    n?.participantNames.map((person) => [person.id, person.name]) ?? [],
  );
  const mine = n?.approvals.some(
    (approval) => approval.userId === userId && approval.approved,
  );
  const busy = approve.isPending || reject.isPending || revise.isPending;
  async function decide(approved: boolean) {
    if (!proposal) return;
    setError("");
    try {
      const input = {
        negotiationId: id,
        proposalId: proposal.id,
        hash: proposal.hash,
      };
      if (approved) await approve.mutateAsync(input);
      else await reject.mutateAsync(input);
      await utils.sidequest.invalidate();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your decision.",
      );
    }
  }
  async function requestRevision(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (
      (start && !end) ||
      (!start && end) ||
      (start && new Date(end) <= new Date(start))
    ) {
      setError("Choose a valid start and end for the new availability window.");
      return;
    }
    const constraints =
      start && end
        ? {
            windows: [
              {
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString(),
              },
            ],
          }
        : {};
    const signature = JSON.stringify({ instruction, constraints });
    if (revisionRequest.current?.signature !== signature)
      revisionRequest.current = { signature, requestId: crypto.randomUUID() };
    try {
      await revise.mutateAsync({
        negotiationId: id,
        instruction,
        constraints,
        requestId: revisionRequest.current.requestId,
      });
      revisionRequest.current = null;
      setInstruction("");
      await utils.sidequest.invalidate();
      onRun(id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not request a revision.",
      );
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        design
        className="inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-y-auto bg-[#fbfcf8] p-6 sm:p-8"
      >
        <SheetTitle className="text-2xl font-semibold">
          Your Scouts are coordinating
        </SheetTitle>
        {detail.isLoading && <p role="status">Loading negotiation…</p>}
        {(error.length > 0 || detail.isError || messages.isError) && (
          <p
            role="alert"
            className="my-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {error || (detail.error?.message ?? messages.error?.message)}
          </p>
        )}
        {n && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span
                role="status"
                className="rounded-full bg-[#e3ebd9] px-4 py-2 text-sm capitalize"
              >
                {statusLabel(n.status)}
              </span>
              <span className="text-xs text-[#627067]">
                {n.participants.length} people · version {n.round || "—"}
              </span>
            </div>
            {n.failure && (
              <p className="mt-3 text-sm text-red-800">
                This negotiation stopped:{" "}
                {n.failure.replaceAll("_", " ").toLowerCase()}. You can update
                the request below if its limits allow another attempt.
              </p>
            )}
            {proposal && (
              <section className="mt-6 rounded-2xl border bg-white p-5">
                <p className="text-xs font-semibold text-[#627067] uppercase">
                  Proposal v{proposal.version}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  {proposal.activitySnapshot.title}
                </h2>
                <p className="mt-3 text-sm">
                  {new Date(proposal.plan.start).toLocaleString()} –{" "}
                  {new Date(proposal.plan.end).toLocaleTimeString()}
                </p>
                <p className="mt-2 text-sm">
                  {proposal.activitySnapshot.location} · ₩
                  {proposal.activitySnapshot.cost.toLocaleString()}/person
                </p>
                <p className="mt-2 text-sm">
                  With{" "}
                  {proposal.plan.participantIds
                    .map((person) => names.get(person) ?? "Participant")
                    .join(", ")}
                </p>
                <p className="mt-4 text-sm text-[#627067]">
                  {n.approvals.filter((a) => a.approved).length} of{" "}
                  {n.participants.length} humans have approved this version.
                  Agent agreement alone never confirms your participation.
                </p>
                {n.status === "AWAITING_APPROVAL" && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      design
                      disabled={busy || mine}
                      onClick={() => void decide(true)}
                      className="rounded-xl bg-[#244a36] px-4 py-3 text-sm font-semibold text-white"
                    >
                      {mine
                        ? "You approved this version"
                        : `Approve proposal v${proposal.version}`}
                    </Button>
                    <Button
                      design
                      disabled={busy}
                      onClick={() => void decide(false)}
                      className="rounded-xl border px-4 py-3 text-sm"
                    >
                      Decline proposal
                    </Button>
                  </div>
                )}
                {n.status === "CONFIRMED" && (
                  <p className="mt-4 font-semibold text-[#315c3e]">
                    Confirmed by every participant.
                  </p>
                )}
                <details className="mt-4 text-xs text-[#627067]">
                  <summary>Exact approval reference</summary>
                  <p className="mt-2 break-all">{proposal.hash}</p>
                </details>
              </section>
            )}
            {n.events
              .filter((event) => event.type === "HUMAN_INPUT_REQUESTED")
              .slice(0, 1)
              .map((event) => (
                <p
                  key={event.id}
                  className="mt-4 rounded-xl bg-[#e3ebd9] p-4 text-sm"
                >
                  Scout asks:{" "}
                  {typeof event.detail.question === "string"
                    ? event.detail.question
                    : "Please add more detail below."}
                </p>
              ))}
            {["DISCOVERING", "NEGOTIATING"].includes(n.status) && (
              <Button
                design
                disabled={running}
                onClick={() => onRun(id)}
                className="mt-4 rounded-xl bg-[#244a36] px-4 py-3 text-sm text-white"
              >
                {running ? "Scouts are talking…" : "Run / resume Scouts"}
              </Button>
            )}
            {n.status !== "CANCELLED" && (
              <form
                onSubmit={(event) => void requestRevision(event)}
                className="mt-6 rounded-2xl border bg-white p-5"
              >
                <h2 className="font-semibold">
                  Change the plan or answer Scout
                </h2>
                <label className="mt-3 block text-sm">
                  Your instruction
                  <textarea
                    required
                    maxLength={1000}
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Let’s go to a movie instead."
                    className="mt-2 w-full rounded-xl border p-3"
                  />
                </label>
                <p className="mt-2 text-xs text-[#627067]">
                  For a time change, select the exact dated window below. A
                  revision invalidates prior approvals and everyone approves the
                  new version again.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    New window start
                    <input
                      type="datetime-local"
                      value={start}
                      min={localDateValue(new Date())}
                      onChange={(event) => setStart(event.target.value)}
                      className="mt-2 w-full rounded-lg border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    New window end
                    <input
                      type="datetime-local"
                      value={end}
                      onChange={(event) => setEnd(event.target.value)}
                      className="mt-2 w-full rounded-lg border p-2"
                    />
                  </label>
                </div>
                <Button
                  design
                  disabled={busy || running}
                  type="submit"
                  className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold"
                >
                  Send revision to Scouts
                </Button>
              </form>
            )}
            <section className="mt-6 pb-8">
              <h2 className="font-semibold">Inter-agent transcript</h2>
              <p className="mt-1 text-xs text-[#627067]">
                Actual addressed messages from your Scouts, updated while they
                negotiate.
              </p>
              <div role="log" aria-live="polite" className="mt-4 space-y-3">
                {messages.data?.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-xl bg-[#eef2e8] p-4"
                  >
                    <p className="text-xs font-semibold">
                      {names.get(message.senderId) ?? "Scout"} →{" "}
                      {names.get(message.recipientId) ?? "Scout"} ·{" "}
                      {message.type}
                    </p>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </article>
                ))}
                {messages.data?.length === 0 && (
                  <p className="text-sm text-[#627067]">No messages yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
