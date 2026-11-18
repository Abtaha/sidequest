"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/server/better-auth/client";
import type { NavigationProps, HeaderProps } from "./types";
import { navigation } from "./data";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import { Logo } from "./shared";
export function Sidebar({
  active,
  onNavigate,
  onSettings,
}: NavigationProps & {
  onSettings: () => void;
}) {
  const router = useRouter(),
    queryClient = useQueryClient();
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
          {
            "Your Scout learns from the preferences you share. Review or remove its memories anytime."
          }
        </p>
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
        <Button
          design
          onClick={async () => {
            const result = await authClient.signOut();
            if (!result.error) {
              queryClient.clear();
              router.replace("/login");
              router.refresh();
            } else onSettings();
          }}
          className="text-xs font-semibold hover:text-[#244a36]"
        >
          Log out
        </Button>
      </div>
    </aside>
  );
}
export function Header({
  userName,
  onNotifications,
  showNotifications,
  notifications,
  onNotification,
  onSettings,
}: HeaderProps) {
  return (
    <header className="relative z-20 flex items-center justify-between border-b border-[#dfe2da] bg-[#fbfcf8] px-5 py-5 md:px-9">
      <Logo compact />
      <div className="relative flex items-center gap-3">
        <Button
          design
          onClick={onNotifications}
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full border bg-white"
        >
          <Icon name="bell" />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#ef785d]" />
          )}
        </Button>
        <Button
          design
          onClick={onSettings}
          aria-label="Open profile settings"
          title={userName}
          className="grid h-9 w-9 place-items-center rounded-full bg-[#d9c2b3] text-xs font-bold"
        >
          {userName.slice(0, 1).toUpperCase()}
        </Button>
        {showNotifications && (
          <div className="absolute right-0 top-12 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-[22px] border border-[#dfe2da] bg-white p-4 shadow-2xl shadow-black/10">
            <h2 className="px-1 pb-4 text-sm font-bold uppercase tracking-[0.12em] text-[#7f8b82]">
              Notifications
            </h2>
            <div className="border-t border-[#e5e8e2] pt-4">
              <p className="px-1 pb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#8a938d]">
                While you were away
              </p>
              <div className="space-y-1">
                <div className="rounded-xl px-3 py-3">
                  <p className="text-base font-semibold text-[#202a24]">
                    Maya is free Saturday
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#737d76]">
                    Your overlap just opened a 3-hour window.
                  </p>
                </div>
                <div className="rounded-xl px-3 py-3">
                  <p className="text-base font-semibold text-[#202a24]">
                    Coffee with Elena
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#737d76]">
                    Scout found a time that works for both of you.
                  </p>
                </div>
              </div>
            </div>
            {notifications.length > 0 && (
              <div className="mt-3 border-t border-[#e5e8e2] pt-4">
                <p className="px-1 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#8a938d]">
                  Ready for your review
                </p>
                <div className="space-y-1">
                  {notifications.map((item) => (
                    <Button
                      design
                      key={item.id}
                      onClick={() => onNotification(item.id)}
                      className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-[#f0f2ec]"
                      type="button"
                    >
                      <p className="text-sm font-semibold text-[#202a24]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-[#737d76]">
                        {item.status.toLowerCase().replaceAll("_", " ")}
                      </p>
                    </Button>
                  ))}
                </div>
              </div>
            )}
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
