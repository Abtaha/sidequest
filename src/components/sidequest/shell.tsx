"use client";
import type { NavigationProps, HeaderProps } from "./types";
import { navigation } from "./data";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { Logo, NotificationItem } from "./shared";
export function Sidebar({
  active,
  onNavigate,
  onSettings,
}: NavigationProps & {
  onSettings: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#dfe2da] bg-[#fbfcf8] px-4 py-6 lg:flex">
      <Logo />
      <nav className="mt-10 space-y-1">
        {navigation.map(([a, l]) => (
          <Button
            design
            key={a}
            onClick={() => onNavigate(a)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === a ? "bg-[#e7eddf] text-[#244a36]" : "text-[#657069] hover:bg-[#f0f2ec]"}`}
            type="button"
          >
            <Icon name={l} className="h-[19px] w-[19px]" />
            {a}
          </Button>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl bg-[#244a36] p-4 text-white">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#dff4c7] text-[#244a36]">
            <Icon name="spark" className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{"Scout"}</p>
            <p className="text-[11px] text-white/60">{"Your personal agent"}</p>
          </div>
        </div>
        <p className="text-xs leading-5 text-white/70">
          {"Your taste map is 72% complete. Every choice makes suggestions more useful."}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[72%] rounded-full bg-[#c9ed93]" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between px-3 py-2 text-sm text-[#657069]">
        <Button
          design
          onClick={onSettings}
          className="flex items-center gap-3 hover:text-[#244a36]"
          type="button"
        >
          <Icon name="settings" className="h-[18px] w-[18px]" />
          {"Settings"}
        </Button>
        <a href="/login" className="text-xs font-semibold hover:text-[#244a36]">
          {"Log out"}
        </a>
      </div>
    </aside>
  );
}
export function Header({
  userName,
  onNotifications,
  showNotifications,
  hikingFound,
  hikingRescheduled,
  onHikingClick,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-[74px] items-center justify-between border-b border-[#dfe2da] bg-[#fbfcf8]/90 px-5 backdrop-blur md:px-9">
      <div className="lg:hidden">
        <Logo compact={true} />
      </div>
      <div className="hidden md:block">
        <p className="text-sm text-[#778079]">{"Friday, May 24"}</p>
      </div>
      <div className="relative flex items-center gap-3">
        <Button
          design
          onClick={onNotifications}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-[#dfe2da] bg-white text-[#465049]"
          aria-label="Notifications"
          type="button"
        >
          <Icon name="bell" className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#ef785d]" />
        </Button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9c2b3] text-xs font-bold text-[#4c4039]">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        {showNotifications && (
          <div className="absolute right-0 top-12 w-80 rounded-2xl border border-[#dfe2da] bg-white p-3 shadow-2xl shadow-black/10">
            <p className="px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#7f8b82]">
              {"Notifications"}
            </p>
            {hikingRescheduled && (
              <Button
                design
                onClick={onHikingClick}
                className="mt-2 w-full rounded-xl bg-[#dff4c7] p-3 text-left transition hover:bg-[#d3edb5]"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#244a36] text-[#c9ed93]">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#315c3e]">
                    {"Agents negotiated successfully"}
                  </p>
                </div>
                <p className="mt-2 text-sm font-semibold">{"9:30 AM works for everyone"}</p>
                <p className="mt-1 text-xs leading-5 text-[#637068]">
                  {"The Saturday hike can move from 9:00 to 9:30 AM."}
                </p>
              </Button>
            )}
            {hikingFound && (
              <Button
                design
                onClick={onHikingClick}
                className="mt-2 w-full rounded-xl bg-[#e7f2dc] p-3 text-left transition hover:bg-[#dceccb]"
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#244a36] text-[#c9ed93]">
                    <Icon name="spark" className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#5d7a61]">
                    {"Activity found"}
                  </p>
                </div>
                <p className="mt-2 text-sm font-semibold">{"Saturday morning hike"}</p>
                <p className="mt-1 text-xs leading-5 text-[#637068]">
                  {"Scout found a nearby short trail and negotiated a time that works."}
                </p>
              </Button>
            )}
            <p className="mt-3 border-t border-[#e5e8e2] px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a938d]">
              {"While you were away"}
            </p>
            <NotificationItem
              title="Maya is free Saturday"
              copy="Your overlap just opened a 3-hour window."
            />
            <NotificationItem
              title="Coffee with Elena"
              copy="Scout found a time that works for both of you."
            />
          </div>
        )}
      </div>
    </header>
  );
}
export function MobileNav({ active, onNavigate }: NavigationProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#dfe2da] bg-[#fbfcf8]/95 px-2 py-2 backdrop-blur lg:hidden">
      {navigation.map(([a, l]) => (
        <Button
          design
          key={a}
          onClick={() => onNavigate(a)}
          className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold ${active === a ? "text-[#244a36]" : "text-[#89928c]"}`}
          type="button"
        >
          <Icon name={l} className="h-[18px] w-[18px]" />
          {a}
        </Button>
      ))}
    </nav>
  );
}
