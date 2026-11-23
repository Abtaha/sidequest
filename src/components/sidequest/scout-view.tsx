"use client";
import * as React from "react";
import { api, type RouterOutputs, type RouterInputs } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "./icons";
import { constraintsSchema } from "@/lib/sidequest-constraints";
import { localDateValue } from "@/lib/sidequest-data";
import { PageHeading } from "./shared";
import type { View } from "./types";
import { ScoutPlanCard } from "./scout-plan-card";
type MemoryRecord = RouterOutputs["memory"]["list"][number];
export function ScoutView({
  userId,
  userName,
  plans,
  onNavigate,
  onStartPlanning,
  onRevision,
  onOpenPlan,
}: {
  userId: string;
  userName: string;
  plans: RouterOutputs["sidequest"]["list"];
  onNavigate: (view: View) => void;
  onStartPlanning: (questId: string) => Promise<string>;
  onRevision: (negotiationId: string) => void;
  onOpenPlan: (negotiationId: string) => void;
}) {
  const utils = api.useUtils();
  const conversations = api.scout.listConversations.useQuery();
  const [selection, setSelection] = React.useState<string>();
  const conversationId =
    selection === "new"
      ? undefined
      : (selection ?? conversations.data?.[0]?.id);
  const conversation = api.scout.getConversation.useQuery(
    { id: conversationId ?? "" },
    { enabled: !!conversationId },
  );
  const [afterId, setAfterId] = React.useState<string>();
  const memories = api.memory.list.useQuery({ limit: 30, afterId });
  const [draft, setDraft] = React.useState(""),
    [editing, setEditing] = React.useState(false),
    [error, setError] = React.useState("");
  const retry = React.useRef<{
    content: string;
    conversationId?: string;
    revisionNegotiationId?: string;
    requestId: string;
  } | null>(null);
  const send = api.scout.sendMessage.useMutation();
  const composer = React.useRef<HTMLTextAreaElement>(null);
  const [editingPlan, setEditingPlan] = React.useState<string>();
  const [focusedPlans, setFocusedPlans] = React.useState<
    Record<string, string>
  >({});
  const planId = conversationId
    ? (focusedPlans[conversationId] ??
      plans.find(
        (plan) =>
          plan.negotiation &&
          plan.negotiation.status !== "CANCELLED" &&
          conversation.data?.messages.some(
            (message) => message.id === plan.sidequest.requestId,
          ),
      )?.negotiation?.id)
    : undefined;
  const [planning, setPlanning] = React.useState(false);
  const revisionNegotiationId =
    editingPlan === planId ? editingPlan : undefined;
  const [retryQuestId, setRetryQuestId] = React.useState<string>();
  async function startPlan(questId: string, chatId = conversationId) {
    setPlanning(true);
    setError("");
    try {
      const id = await onStartPlanning(questId);
      if (chatId)
        setFocusedPlans((previous) => ({ ...previous, [chatId]: id }));
      setRetryQuestId(undefined);
    } catch (error) {
      setRetryQuestId(questId);
      setError(
        error instanceof Error
          ? error.message
          : "Scout could not start planning.",
      );
    } finally {
      setPlanning(false);
    }
  }
  const update = api.memory.update.useMutation(),
    remove = api.memory.delete.useMutation();
  async function sendMessage(content = draft) {
    if (!content.trim() || send.isPending || planning) return;
    if (
      retry.current?.content !== content ||
      retry.current.conversationId !== conversationId ||
      retry.current.revisionNegotiationId !== revisionNegotiationId
    )
      retry.current = {
        content,
        conversationId,
        revisionNegotiationId,
        requestId: crypto.randomUUID(),
      };
    setError("");
    try {
      const result = await send.mutateAsync(retry.current);
      setSelection(result.conversationId);
      setDraft("");
      setEditingPlan(undefined);
      retry.current = null;
      void Promise.all([utils.scout.invalidate(), utils.memory.invalidate()]);
      if (result.revisedNegotiationId) {
        const id = result.revisedNegotiationId;
        setFocusedPlans((previous) => ({
          ...previous,
          [result.conversationId]: id,
        }));
        onRevision(id);
      } else if (result.planningQuestId) {
        await startPlan(result.planningQuestId, result.conversationId);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Scout could not reply. Retry your message.",
      );
    }
  }
  async function changeMemory(
    memory: MemoryRecord,
    content: string,
    constraints?: NonNullable<RouterInputs["memory"]["update"]["constraints"]>,
  ) {
    setError("");
    try {
      await update.mutateAsync({ id: memory.id, content, constraints });
      await utils.memory.invalidate();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update memory.",
      );
    }
  }
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Your personal agent"
        title="Talk it through with Scout"
        copy="Share context, update a preference, or think through a plan. Your private memory persists across conversations."
      />
      {(error.length > 0 ||
        conversations.isError ||
        conversation.isError ||
        memories.isError) && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error ||
            (conversations.error?.message ??
              conversation.error?.message ??
              memories.error?.message)}
        </p>
      )}
      {planning && (
        <p role="status" className="mt-4 text-sm">
          Scout is finding people to plan with…
        </p>
      )}
      {retryQuestId && (
        <Button
          design
          type="button"
          disabled={planning}
          onClick={() => void startPlan(retryQuestId)}
          className="mt-3 rounded-lg border px-3 py-2 text-sm"
        >
          Retry planning
        </Button>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex min-h-[580px] flex-col overflow-hidden rounded-[26px] border border-[#dfe2da] bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e3e6df] px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#244a36] text-[#c9ed93]">
              <Icon name="spark" />
            </div>
            <h2 className="text-sm font-semibold">Scout</h2>
            <label className="ml-auto text-xs">
              Conversation{" "}
              <select
                aria-label="Scout conversation"
                value={conversationId ?? "new"}
                disabled={send.isPending}
                onChange={(event) => {
                  setSelection(event.target.value);
                  setError("");
                }}
                className="ml-2 max-w-44 rounded-lg border p-2"
              >
                <option value="new">New conversation</option>
                {conversations.data?.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {item.createdAt.toLocaleDateString()} · {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <Button
              design
              disabled={send.isPending}
              onClick={() => setSelection("new")}
              className="rounded-lg bg-[#eef2e8] px-3 py-2 text-xs"
            >
              New
            </Button>
          </div>
          <div
            className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto p-5 md:p-6"
            role="log"
            aria-label="Scout conversation messages"
            aria-live="polite"
          >
            {conversation.isLoading && (
              <p className="text-sm text-[#627067]">Loading conversation…</p>
            )}
            {!conversationId && (
              <p className="rounded-2xl bg-[#eef2e8] p-4 text-sm">
                Hey {userName.split(" ")[0]}. Tell me what makes a plan feel
                right for you.
              </p>
            )}
            {conversation.data?.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${message.role === "user" ? "bg-[#244a36] text-white" : "bg-[#eef2e8] text-[#3f4b43]"}`}
                >
                  {message.content}
                  {message.status === "FAILED" && (
                    <p className="mt-2 text-xs">
                      Reply failed. Retry with the same message.
                    </p>
                  )}
                </div>
              </div>
            ))}
            {send.isPending && (
              <p role="status" className="text-sm text-[#627067]">
                Scout is thinking and updating your memory…
              </p>
            )}
          </div>
          {planId && (
            <div className="px-4 pb-3 sm:px-5">
              <ScoutPlanCard
                key={planId}
                id={planId}
                userId={userId}
                onOpen={() => onOpenPlan(planId)}
                onSuggest={() => {
                  setEditingPlan(planId);
                  composer.current?.focus();
                }}
              />
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
            className="border-t border-[#e3e6df] p-4"
          >
            {revisionNegotiationId && (
              <div className="mb-2 flex items-center gap-3 text-sm text-[#465d4b]">
                <span>Changing this plan</span>
                <Button
                  design
                  type="button"
                  className="text-xs underline"
                  onClick={() => setEditingPlan(undefined)}
                >
                  Cancel change
                </Button>
              </div>
            )}
            {!planId && (
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  "I want to add more context",
                  "My availability changed",
                  "Help me change a plan",
                ].map((text) => (
                  <Button
                    key={text}
                    design
                    type="button"
                    onClick={() => setDraft(text)}
                    className="rounded-full bg-[#f0f2ec] px-3 py-2 text-xs"
                  >
                    {text}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-[#d8ddd5] bg-[#fbfcf8] p-2 pl-4">
              <Textarea
                ref={composer}
                design
                aria-label="Message Scout"
                value={draft}
                disabled={send.isPending}
                maxLength={revisionNegotiationId ? 1000 : 6000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder={
                  planId
                    ? "Ask to move the time or suggest another activity…"
                    : "Tell Scout anything or ask for help…"
                }
                className="flex-1 resize-none bg-transparent py-2 text-sm"
              />
              <Button
                design
                type="submit"
                disabled={send.isPending || planning || !draft.trim()}
                aria-label="Send message to Scout"
                className="grid h-11 w-11 place-items-center rounded-xl bg-[#244a36] text-white disabled:opacity-35"
              >
                <Icon name="send" />
              </Button>
            </div>
          </form>
        </section>
        <aside className="space-y-4">
          <div className="rounded-[22px] bg-[#e3ebd9] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider uppercase">
                Scout remembers
              </h2>
              <Button
                design
                onClick={() => setEditing(!editing)}
                className="rounded-lg bg-white/70 px-3 py-2 text-xs"
              >
                {editing ? "Done" : "Edit"}
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {memories.data?.map((memory) => (
                <MemoryCard
                  key={`${memory.id}:${editing}`}
                  memory={memory}
                  editing={editing}
                  busy={update.isPending || remove.isPending}
                  onSave={(content, constraints) =>
                    void changeMemory(memory, content, constraints)
                  }
                  onDelete={async (deleteSource) => {
                    setError("");
                    try {
                      await remove.mutateAsync({ id: memory.id, deleteSource });
                      if (deleteSource) setSelection("new");
                      await Promise.all([
                        utils.memory.invalidate(),
                        utils.scout.invalidate(),
                      ]);
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Could not delete memory.",
                      );
                    }
                  }}
                />
              ))}
              {memories.data?.length === 0 && (
                <p className="text-sm text-[#627067]">
                  No memories yet. Tell Scout what you enjoy.
                </p>
              )}
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              {afterId && (
                <button onClick={() => setAfterId(undefined)}>
                  First page
                </button>
              )}
              {memories.data?.length === 30 && (
                <button onClick={() => setAfterId(memories.data?.at(-1)?.id)}>
                  More memories
                </button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#61705f]">
              Stored privately across sessions. To add a memory, tell Scout in
              the conversation.
            </p>
          </div>
          <Button
            design
            onClick={() => onNavigate("Plans")}
            className="w-full rounded-[20px] border bg-white p-5 text-left text-sm"
          >
            Need to change a plan? Open Plans →
          </Button>
        </aside>
      </div>
    </div>
  );
}
function MemoryCard({
  memory,
  editing,
  busy,
  onSave,
  onDelete,
}: {
  memory: MemoryRecord;
  editing: boolean;
  busy: boolean;
  onSave: (
    content: string,
    constraints?: NonNullable<RouterInputs["memory"]["update"]["constraints"]>,
  ) => void;
  onDelete: (deleteSource: boolean) => Promise<void>;
}) {
  const parsed = constraintsSchema.safeParse(memory.value);
  const original = parsed.success ? parsed.data : {};
  const [content, setContent] = React.useState(memory.content),
    [maxCost, setMaxCost] = React.useState(original.maxCost?.toString() ?? ""),
    [minGroup, setMinGroup] = React.useState(
      original.minGroup?.toString() ?? "",
    ),
    [maxGroup, setMaxGroup] = React.useState(
      original.maxGroup?.toString() ?? "",
    ),
    [windows, setWindows] = React.useState(
      (original.windows ?? []).map((window) => ({
        start: localDateValue(new Date(window.start)),
        end: localDateValue(new Date(window.end)),
      })),
    ),
    [deleteSource, setDeleteSource] = React.useState(false),
    [error, setError] = React.useState("");
  const hard =
    memory.category === "CONSTRAINT" || memory.category === "AVAILABILITY";
  return (
    <div className="rounded-xl bg-white/75 p-3">
      <p className="text-[10px] font-bold tracking-wide text-[#7a8678] uppercase">
        {memory.category.replaceAll("_", " ")}
      </p>
      {editing ? (
        <>
          <Textarea
            design
            aria-label={`Edit ${memory.category} memory`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500}
            rows={3}
            className="mt-2 w-full rounded-lg border bg-white p-2 text-sm"
          />
          {hard && (
            <div className="mt-3 space-y-2 text-xs">
              <label className="block">
                Budget ceiling (₩)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={maxCost}
                  onChange={(event) => setMaxCost(event.target.value)}
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  Minimum people
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={minGroup}
                    onChange={(event) => setMinGroup(event.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
                <label>
                  Maximum people
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={maxGroup}
                    onChange={(event) => setMaxGroup(event.target.value)}
                    className="mt-1 w-full rounded border p-2"
                  />
                </label>
              </div>
              {windows.map((window, index) => (
                <div key={index} className="rounded border p-2">
                  <label>
                    Available from
                    <input
                      type="datetime-local"
                      value={window.start}
                      onChange={(event) =>
                        setWindows(
                          windows.map((w, i) =>
                            i === index
                              ? { ...w, start: event.target.value }
                              : w,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded border p-1"
                    />
                  </label>
                  <label>
                    Until
                    <input
                      type="datetime-local"
                      value={window.end}
                      onChange={(event) =>
                        setWindows(
                          windows.map((w, i) =>
                            i === index ? { ...w, end: event.target.value } : w,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded border p-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setWindows(windows.filter((_, i) => i !== index))
                    }
                    className="mt-2 text-red-700"
                  >
                    Remove time window
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={windows.length >= 30}
                onClick={() => setWindows([...windows, { start: "", end: "" }])}
                className="text-[#315c3e] underline"
              >
                Add a time window
              </button>
              {original.excludedUsers?.length ||
              original.excludedTags?.length ? (
                <p>
                  Other exclusions in this memory stay in place. Delete the
                  memory to remove its restrictions.
                </p>
              ) : null}
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <Button
            design
            disabled={busy || !content.trim()}
            onClick={() => {
              try {
                setError("");
                const parsedWindows = windows.map((window) => ({
                  start: new Date(window.start),
                  end: new Date(window.end),
                }));
                if (
                  parsedWindows.some(
                    (window) =>
                      !Number.isFinite(+window.start) ||
                      !Number.isFinite(+window.end) ||
                      window.end <= window.start,
                  )
                ) {
                  setError(
                    "Choose a valid start and end for each time window.",
                  );
                  return;
                }
                const value = hard
                  ? {
                      ...original,
                      maxCost: maxCost === "" ? undefined : Number(maxCost),
                      minGroup: minGroup === "" ? undefined : Number(minGroup),
                      maxGroup: maxGroup === "" ? undefined : Number(maxGroup),
                      windows: parsedWindows.length
                        ? parsedWindows.map((window) => ({
                            start: window.start.toISOString(),
                            end: window.end.toISOString(),
                          }))
                        : undefined,
                    }
                  : undefined;
                onSave(content, value);
              } catch {
                setError("Check the restriction values and time windows.");
              }
            }}
            className="mt-2 rounded bg-[#244a36] px-3 py-2 text-xs text-white"
          >
            Save memory
          </Button>
          <label className="mt-3 flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={deleteSource}
              onChange={(event) => setDeleteSource(event.target.checked)}
            />{" "}
            Also erase its source conversation
          </label>
          <Button
            design
            disabled={busy}
            onClick={() => void onDelete(deleteSource)}
            className="mt-2 text-xs text-red-700"
          >
            Delete memory
          </Button>
        </>
      ) : (
        <p className="mt-1 text-sm whitespace-pre-wrap">{memory.content}</p>
      )}
      {memory.expiresAt && (
        <p className="mt-2 text-xs text-[#627067]">
          Expires {memory.expiresAt.toLocaleString()}
        </p>
      )}
    </div>
  );
}
