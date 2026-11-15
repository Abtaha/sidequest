"use client";
import * as React from "react";
import type { ScoutProps, MemoryProps } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "./icons";
import { PageHeading } from "./shared";
export function ScoutView({
  userName,
  onNavigate,
  onActivityFound,
  memories,
  onMemoriesChange,
}: ScoutProps) {
  const [draft, setDraft] = React.useState(""),
    [editingMemories, setEditingMemories] = React.useState(false),
    [messages, setMessages] = React.useState([
      {
        from: "scout",
        text: `Hey ${userName.split(" ")[0]}. I’m here whenever you want to add context, rethink a plan, or tell me what kind of social energy you have today.`,
      },
    ]);
  function sendMessage(e = draft, t = true) {
    const s = e.trim();
    if (!s) return;
    const a = s.toLowerCase();
    let n =
        "Got it. I’ll use that as private context when I compare future plans and people for you.";
    if (a.includes("plan") || a.includes("change")) {
      n =
        "I can help with that. I’ve noted what you want changed—open Plans if you want to apply it to a specific SideQuest.";
    } else {
      if (a.includes("free") || a.includes("available")) {
        n =
          "Thanks. I’ve updated the availability I’ll use for suggestions. I’ll still ask before confirming anything.";
      } else {
        if (a.includes("don’t") || a.includes("avoid") || a.includes("never")) {
          n =
            "Understood. I’ll treat that as a boundary and avoid suggesting plans that conflict with it.";
        }
      }
    }
    setMessages((e) => [...e, { from: "user", text: s }, { from: "scout", text: n }]);
    setDraft("");
    if (t) {
      onActivityFound();
    }
  }
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Your personal agent"
        title="Talk it through with Scout"
        copy="Add context, change your preferences, or ask Scout to help with a plan. This conversation stays private unless you approve an action."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex min-h-[580px] flex-col overflow-hidden rounded-[26px] border border-[#dfe2da] bg-white">
          <div className="flex items-center gap-3 border-b border-[#e3e6df] px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#244a36] text-[#c9ed93]">
              <Icon name="spark" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{"Scout"}</h2>
              <p className="text-xs text-[#718077]">{"Ready to listen and help"}</p>
            </div>
            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-[#5d7a61]">
              <span className="h-2 w-2 rounded-full bg-[#76a85d]" />
              {"Private"}
            </span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
            {messages.map((e, s) => (
              <div
                key={`${e.from}-${s}`}
                className={`flex ${"user" === e.from ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${"user" === e.from ? "rounded-br-md bg-[#244a36] text-white" : "rounded-bl-md bg-[#eef2e8] text-[#3f4b43]"}`}
                >
                  {e.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#e3e6df] p-4">
            <div className="mb-3 flex gap-2 overflow-x-auto">
              {[
                "I want to add more context",
                "My availability changed",
                "Help me change a plan",
              ].map((e) => (
                <Button
                  design
                  key={e}
                  onClick={() => sendMessage(e, false)}
                  className="whitespace-nowrap rounded-full bg-[#f0f2ec] px-3 py-2 text-xs font-semibold text-[#536351]"
                  type="button"
                >
                  {e}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-[#d8ddd5] bg-[#fbfcf8] p-2 pl-4 focus-within:border-[#71956f]">
              <Textarea
                design
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (!("Enter" !== e.key || e.shiftKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                placeholder="Tell Scout anything or ask for help..."
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2 text-sm leading-5 outline-none"
              />
              <Button
                design
                onClick={() => sendMessage()}
                disabled={!draft.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#244a36] text-white transition disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Send message to Scout"
                type="button"
              >
                <Icon name="send" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-[22px] bg-[#e3ebd9] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#667661]">
                {"Scout remembers"}
              </p>
              <Button
                design
                onClick={() => setEditingMemories((e) => !e)}
                className="flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-[#244a36]"
                type="button"
              >
                <Icon name={editingMemories ? "check" : "edit"} className="h-3.5 w-3.5" />
                {editingMemories ? "Done" : "Edit"}
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {memories.map((e) => (
                <MemoryCard
                  key={e.id}
                  memory={e}
                  editing={editingMemories}
                  onChange={(t) => onMemoriesChange(memories.map((s) => (s.id === e.id ? t : s)))}
                  onRemove={() => onMemoriesChange(memories.filter((t) => t.id !== e.id))}
                />
              ))}
              {!memories.length && (
                <p className="rounded-xl border border-dashed border-[#adbea5] p-4 text-center text-xs leading-5 text-[#667661]">
                  {"Scout is not remembering any profile context yet."}
                </p>
              )}
              {editingMemories && (
                <Button
                  design
                  onClick={() =>
                    onMemoriesChange([
                      ...memories,
                      { id: `memory-${Date.now()}`, label: "New context", value: "" },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#91a788] px-3 py-3 text-xs font-bold text-[#315c3e]"
                  type="button"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  {"Add something Scout should remember"}
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#61705f]">
              {"These notes are private and stay updated while you use this prototype."}
            </p>
          </div>
          <Button
            design
            onClick={() => onNavigate("Plans")}
            className="flex w-full items-center justify-between rounded-[20px] border border-[#dfe2da] bg-white p-5 text-left"
            type="button"
          >
            <div>
              <p className="text-sm font-semibold">{"Need to change a plan?"}</p>
              <p className="mt-1 text-xs text-[#737d76]">{"Open your upcoming SideQuests"}</p>
            </div>
            <Icon name="arrow" className="h-4 w-4 text-[#244a36]" />
          </Button>
        </aside>
      </div>
    </div>
  );
}
export function MemoryCard({ memory, editing, onChange, onRemove }: MemoryProps) {
  return editing ? (
    <div className="rounded-xl bg-white/75 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            design
            value={memory.label}
            onChange={(t) => onChange({ ...memory, label: t.target.value })}
            placeholder="What kind of context?"
            className="w-full bg-transparent text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a8678] outline-none"
          />
          <Textarea
            design
            value={memory.value}
            onChange={(t) => onChange({ ...memory, value: t.target.value })}
            placeholder="Write anything Scout should remember"
            rows={2}
            className="w-full resize-none rounded-lg border border-[#d8e1d2] bg-white px-2.5 py-2 text-sm leading-5 text-[#344538] outline-none focus:border-[#71956f]"
          />
        </div>
        <Button
          design
          onClick={onRemove}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#7f8b82] hover:bg-white hover:text-[#a04f43]"
          aria-label={`Remove ${memory.label || "memory"}`}
          type="button"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  ) : (
    <div className="rounded-xl bg-white/65 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#7a8678]">
        {memory.label || "Personal context"}
      </p>
      <p className="mt-1 text-sm font-medium text-[#344538]">
        {memory.value || "Nothing added yet"}
      </p>
    </div>
  );
}
