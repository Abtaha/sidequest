"use client";
import { ActivityCard } from "./activity-card";
import type { HomeProps } from "./types";
import { activities, people } from "./data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "./icons";
import { SectionHeading, DetailRow, PersonAvatar } from "./shared";
export function HomeView({
  userName,
  request,
  setRequest,
  onSubmit,
  onNavigate,
  onSelect,
  plans,
}: HomeProps) {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-9 md:py-10">
      <section className="grid gap-5 xl:grid-cols-[1fr_370px]">
        <div className="rounded-[28px] bg-[#244a36] p-7 text-white md:p-9">
          <div className="mb-10 flex items-center gap-2 text-sm text-[#c9ed93]">
            <Icon name="spark" className="h-4 w-4" />
            {"Scout is ready"}
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-[52px]">
            {"What are you up for, "}
            {userName.split(" ")[0]}
            {"?"}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 text-white/65">
            {
              "Give Scout a vibe, a budget, or a time. You’ll get concrete ideas with compatible people—not an endless search page."
            }
          </p>
          <div className="mt-8 flex items-center rounded-2xl bg-white p-2 pl-4 text-[#17211b] shadow-xl shadow-black/10">
            <Input
              design
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => "Enter" === e.key && onSubmit()}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8d948f]"
              placeholder="Try “something outdoors this weekend under ₩20,000”"
            />
            <Button
              design
              onClick={onSubmit}
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#c9ed93] text-[#244a36] transition hover:bg-[#b9df80]"
              aria-label="Find plans"
              type="button"
            >
              <Icon name="send" className="h-[18px] w-[18px]" />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Free this weekend", "Low-key tonight", "Try something new"].map((e) => (
              <Button
                design
                key={e}
                onClick={() => setRequest(e)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10 hover:text-white"
                type="button"
              >
                {e}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-[#dfe2da] bg-[#fbfcf8] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#839087]">
                {"Ready for review"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                {"Coffee with Elena"}
              </h2>
            </div>
            <span className="rounded-full bg-[#dff4c7] px-3 py-1.5 text-xs font-semibold text-[#315c3e]">
              {"94% fit"}
            </span>
          </div>
          <div className="my-6 rounded-2xl bg-[#f0f2ec] p-4 text-sm leading-5 text-[#4e5851]">
            <b className="text-[#253129]">{"Why this works"}</b>
            <br />
            {
              "You both want a quiet catch-up near campus. Sunday at 11 fits both calendars and budgets."
            }
          </div>
          <div className="space-y-3 text-sm">
            <DetailRow icon="calendar">{"Sunday, May 26 · 11:00 AM"}</DetailRow>
            <DetailRow icon="pin">{"Felt Coffee · 8 min walk"}</DetailRow>
          </div>
          <Button
            design
            onClick={() =>
              onSelect({
                ...activities[3]!,
                title: "Coffee with Elena",
                date: "Sunday, May 26",
                time: "11:00 AM – 12:30 PM",
                location: "Felt Coffee · 8 min walk",
                price: "Around ₩8,000",
                description: "A quiet catch-up at a light-filled coffee shop near campus.",
                people: ["Elena"],
              })
            }
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#244a36] px-4 py-3 text-sm font-semibold text-white"
            type="button"
          >
            {"Review plan "}
            <Icon name="arrow" className="h-4 w-4" />
          </Button>
        </div>
      </section>
      <SectionHeading
        eyebrow="Compatible now"
        title="Potential SideQuests"
        action="Discover more"
        onAction={() => onNavigate("Discover")}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {activities.slice(0, 3).map((e) => (
          <ActivityCard key={e.id} activity={e} onSelect={() => onSelect(e)} />
        ))}
      </div>
      <section className="mt-10 grid gap-5 pb-8 md:grid-cols-3">
        <div className="rounded-[24px] border border-[#dfe2da] bg-[#fbfcf8] p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#7f8b82]">
                {"Your week"}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {plans.length}
                {" plans are coming together"}
              </h2>
            </div>
            <Icon name="calendar" className="h-5 w-5 text-[#244a36]" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {plans.slice(0, 2).map((e) => (
              <Button
                design
                key={e.id}
                onClick={() => onSelect(e)}
                className="rounded-2xl bg-[#eef2e8] p-4 text-left transition hover:bg-[#e3ebd9]"
                type="button"
              >
                <p className="text-xs text-[#7b867e]">
                  {e.date}
                  {" · "}
                  {e.time.split(" – ")[0]}
                </p>
                <p className="mt-1 font-semibold">{e.title}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-[#69756c]">
                  <Icon name="pin" className="h-3.5 w-3.5" />
                  {e.location.split(" · ")[0]}
                  {" · "}
                  {e.people.length + 1}
                  {" people"}
                </p>
              </Button>
            ))}
          </div>
          <Button
            design
            onClick={() => onNavigate("Plans")}
            className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#244a36]"
            type="button"
          >
            {"Manage all plans "}
            <Icon name="arrow" className="h-4 w-4" />
          </Button>
        </div>
        <div className="rounded-[24px] bg-[#e3ebd9] p-6">
          <div className="flex h-full flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#667661]">
              {"Circle pulse"}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{"12"}</p>
            <p className="mt-1 text-sm text-[#536351]">{"friends are open to plans this week"}</p>
            <div className="mt-5 flex -space-x-2">
              {people.slice(0, 4).map((e) => (
                <PersonAvatar key={e.name} person={e} small={true} />
              ))}
            </div>
            <Button
              design
              onClick={() => onNavigate("People")}
              className="mt-auto flex items-center gap-2 pt-8 text-sm font-semibold text-[#244a36]"
              type="button"
            >
              {"See who’s free "}
              <Icon name="arrow" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
