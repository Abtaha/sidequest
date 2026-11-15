"use client";
import type { Person, IconName, HeadingProps, ActionProps, ChildrenProps } from "./types";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
export function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/75 px-2 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#849080]">{label}</p>
      <p className="mt-1 text-xs font-semibold text-[#344538]">{value}</p>
    </div>
  );
}
export function Logo({
  compact = false,
}: {
  compact?: boolean;
} = {}) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div
        className={`grid place-items-center rounded-xl bg-[#244a36] text-[#dff4c7] ${compact ? "h-8 w-8" : "h-9 w-9"}`}
      >
        <Icon name="spark" className="h-4 w-4" />
      </div>
      <span className={`${compact ? "text-base" : "text-xl"} font-bold tracking-[-0.04em]`}>
        {"SideQuest"}
      </span>
    </div>
  );
}
export function PageHeading({ eyebrow, title, copy }: HeadingProps) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6b866f]">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.045em] md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-6 text-[#6c776f]">{copy}</p>
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="mb-5 mt-10 flex items-end justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#7f8b82]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      <Button
        design
        onClick={onAction}
        className="hidden items-center gap-2 text-sm font-semibold text-[#244a36] sm:flex"
        type="button"
      >
        {action}
        <Icon name="arrow" className="h-4 w-4" />
      </Button>
    </div>
  );
}
export function DetailRow({
  icon,
  children,
}: ChildrenProps & {
  icon: IconName;
}) {
  return (
    <p className="flex items-start gap-2 text-[#5f6a63]">
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-[#5d7a61]" />
      {children}
    </p>
  );
}
export function PersonAvatar({ person, small = false }: { person: Person; small?: boolean }) {
  return (
    <div
      title={person.name}
      className={`grid shrink-0 place-items-center rounded-full border-2 border-white font-bold text-[#435048] ${person.color} ${small ? "h-9 w-9 text-[10px]" : "h-12 w-12 text-xs"}`}
    >
      {person.initials}
    </div>
  );
}
export function NotificationItem({ title, copy }: { title: string; copy: string }) {
  return (
    <Button
      design
      className="mt-1 w-full rounded-xl p-3 text-left hover:bg-[#f0f2ec]"
      type="button"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#737d76]">{copy}</p>
    </Button>
  );
}
export function EmptyState({ title, copy, action, onAction }: ActionProps) {
  return (
    <div className="mt-6 rounded-[24px] border border-dashed border-[#c9d0c8] bg-white p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e3ebd9] text-[#244a36]">
        <Icon name="spark" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#737d76]">{copy}</p>
      <Button
        design
        onClick={onAction}
        className="mt-5 rounded-xl bg-[#244a36] px-5 py-2.5 text-sm font-semibold text-white"
        type="button"
      >
        {action}
      </Button>
    </div>
  );
}
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#17211b] px-4 py-3 text-sm text-white shadow-2xl lg:bottom-6">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#c9ed93] text-[#244a36]">
        <Icon name="check" className="h-4 w-4" />
      </span>
      <p className="flex-1">{message}</p>
      <Button design onClick={onClose} aria-label="Dismiss" type="button">
        <Icon name="close" className="h-4 w-4 text-white/60" />
      </Button>
    </div>
  );
}
