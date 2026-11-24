"use client";
import * as React from "react";
import { api, type RouterOutputs } from "@/trpc/react";
import { activityImage, categoryNames } from "@/lib/sidequest-data";
import type { Activity, Person, View } from "./types";
import { Sidebar, Header, MobileNav } from "./shell";
import { HomeView } from "./home-view";
import { DiscoverView } from "./discover-view";
import { PlansView } from "./plans-view";
import { PeopleView } from "./people-view";
import { ScoutView } from "./scout-view";
import { ActivityDetails } from "./activity-details";
import { SettingsDialog } from "./settings-dialog";
import { NegotiationPanel } from "./negotiation-panel";
import { Icon } from "./icons";
function catalogActivity(
  row: RouterOutputs["activity"]["list"][number],
): Activity {
  const category = categoryNames[row.category] ?? row.category;
  return {
    id: row.id,
    title: row.title,
    image: activityImage(category),
    match: 0,
    people: [],
    date: row.start.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    time: `${row.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${row.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    location: row.location,
    price: `₩${row.cost.toLocaleString()}`,
    category,
    description: row.description,
    reason: row.synthetic
      ? "Demo activity with sample times and prices."
      : "Ask your Scouts to check this option for your group.",
  };
}
export default function SideQuestApp({
  userName,
  userId,
}: {
  userName: string;
  userId: string;
}) {
  const utils = api.useUtils();
  const catalog = api.activity.list.useQuery(),
    peopleQuery = api.people.list.useQuery();
  const quests = api.sidequest.list.useQuery(undefined, {
    refetchInterval: (query) =>
      query.state.data?.some(
        (row) =>
          row.negotiation &&
          ["DISCOVERING", "NEGOTIATING"].includes(row.negotiation.status),
      )
        ? 2000
        : 5000,
  });
  const create = api.sidequest.create.useMutation(),
    start = api.sidequest.startNegotiation.useMutation();
  const [error, setError] = React.useState("");
  const resume = api.sidequest.resumeNegotiation.useMutation({
    onSuccess: () => {
      void utils.sidequest.invalidate();
    },
    onError: (error) => {
      setError(error.message);
      void utils.sidequest.invalidate();
    },
  });
  const [activeView, setActiveView] = React.useState<View>("Home"),
    [request, setRequest] = React.useState(""),
    [searchTerm, setSearchTerm] = React.useState(""),
    [category, setCategory] = React.useState("All"),
    [selected, setSelected] = React.useState<Activity | null>(null),
    [selectedNegotiation, setSelectedNegotiation] = React.useState<
      string | null
    >(null),
    [showNotifications, setShowNotifications] = React.useState(false),
    [showSettings, setShowSettings] = React.useState(false),
    [newNotification, setNewNotification] = React.useState<{
      id: string;
      title: string;
      status: string;
    } | null>(null);
  const retry = React.useRef<{ signature: string; requestId: string } | null>(
    null,
  );
  const notificationToastTimer = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const seenNotifications = React.useRef<{
    userId: string;
    ids: Set<string>;
  } | null>(null);
  const activities = (catalog.data ?? []).map(catalogActivity);
  const people: (Person & { id: string })[] = (peopleQuery.data ?? []).map(
    (person) => ({
      ...person,
      initials: person.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2),
      color: "bg-[#c5d6c1]",
      status: "Open to agent planning",
      interests: [],
      overlap: "Available for matching",
    }),
  );
  const pending = create.isPending || start.isPending;
  const notifications = (quests.data ?? []).flatMap((row) =>
    row.negotiation?.status === "AWAITING_APPROVAL"
      ? [
          {
            id: row.negotiation.id,
            key: `${row.negotiation.id}:${row.negotiation.round}`,
            title: row.proposal?.activitySnapshot.title ?? row.sidequest.intent,
            status: row.negotiation.status,
          },
        ]
      : [],
  );
  React.useEffect(() => {
    if (!quests.isSuccess) return;

    const storageKey = `sidequest:seen-notifications:${userId}`;
    const currentIds = notifications.map((notification) => notification.key);
    if (seenNotifications.current?.userId !== userId) {
      let initialIds = currentIds;
      try {
        const stored = window.localStorage.getItem(storageKey);
        const parsed: unknown = stored === null ? null : JSON.parse(stored);
        if (Array.isArray(parsed)) {
          initialIds = parsed.filter(
            (id): id is string => typeof id === "string",
          );
          for (const notification of notifications)
            if (initialIds.includes(notification.id))
              initialIds.push(notification.key);
          initialIds = initialIds.filter((id) => id.includes(":"));
        }
      } catch {
        // Keep tracking notifications for this session if storage is unavailable.
      }
      seenNotifications.current = { userId, ids: new Set(initialIds) };
    }

    const seen = seenNotifications.current.ids;
    const notification = notifications
      .filter((item) => !seen.has(item.key))
      .at(-1);
    for (const id of currentIds) seen.add(id);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...seen]));
    } catch {
      // Session tracking is still active.
    }

    if (!notification) return;
    setNewNotification(notification);
    if (notificationToastTimer.current)
      clearTimeout(notificationToastTimer.current);
    notificationToastTimer.current = setTimeout(() => {
      setNewNotification(null);
      notificationToastTimer.current = null;
    }, 5000);
  }, [notifications, quests.isSuccess, userId]);

  React.useEffect(
    () => () => {
      if (notificationToastTimer.current) {
        clearTimeout(notificationToastTimer.current);
      }
    },
    [],
  );

  const confirmed = (quests.data ?? []).flatMap((row) => {
    if (row.negotiation?.status !== "CONFIRMED" || !row.proposal) return [];
    const p = row.proposal;
    return [
      {
        id: row.negotiation.id,
        title: p.activitySnapshot.title,
        image: activityImage("Games"),
        match: 0,
        startAt: new Date(p.plan.start).getTime(),
        people: p.plan.participantIds
          .filter((id) => id !== userId)
          .map(() => "Participant"),
        date: new Date(p.plan.start).toLocaleDateString(),
        time: `${new Date(p.plan.start).toLocaleTimeString()} – ${new Date(p.plan.end).toLocaleTimeString()}`,
        location: p.activitySnapshot.location,
        price: `₩${p.activitySnapshot.cost.toLocaleString()}`,
        category: "Confirmed plan",
        description: "All required humans approved this proposal.",
        reason: "",
      },
    ];
  });
  function navigate(view: View) {
    setActiveView(view);
    setSelected(null);
    setShowNotifications(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openNotification(id: string) {
    setSelectedNegotiation(id);
    setShowNotifications(false);
  }
  function run(id: string) {
    setError("");
    resume.mutate({ id });
  }
  async function startPlanning(
    sidequestId: string,
    candidateIds?: string[],
    showDetails = true,
  ) {
    setError("");
    const n = await start.mutateAsync({ sidequestId, candidateIds });
    setSelected(null);
    if (showDetails) setSelectedNegotiation(n.id);
    void utils.sidequest.invalidate();
    if (n.status === "DISCOVERING" || n.status === "NEGOTIATING") run(n.id);
    return n.id;
  }
  async function coordinate(intent: string, candidateIds?: string[]) {
    if (pending || !intent.trim()) return;
    setError("");
    const signature = JSON.stringify({ intent, candidateIds });
    if (retry.current?.signature !== signature)
      retry.current = { signature, requestId: crypto.randomUUID() };
    try {
      const quest = await create.mutateAsync({
        intent,
        requestId: retry.current.requestId,
        constraints: {},
      });
      await startPlanning(quest.id, candidateIds);
      retry.current = null;
      setRequest("");
      setActiveView("Plans");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not start planning.",
      );
    }
  }
  const queryError = catalog.error ?? peopleQuery.error ?? quests.error;
  return (
    <div className="min-h-screen bg-[#f5f6f1] text-[#17211b]">
      <Sidebar
        active={activeView}
        onNavigate={navigate}
        onSettings={() => setShowSettings(true)}
      />
      <main className="min-h-screen pb-24 lg:ml-[232px] lg:pb-0">
        <Header
          userName={userName}
          onNotifications={() => setShowNotifications(!showNotifications)}
          showNotifications={showNotifications}
          onSettings={() => setShowSettings(true)}
          notifications={notifications}
          onNotification={openNotification}
        />
        {(error || queryError) && (
          <div
            role="alert"
            className="mx-5 mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error || queryError?.message}
            <button
              onClick={() => {
                setError("");
                void Promise.all([
                  catalog.refetch(),
                  peopleQuery.refetch(),
                  quests.refetch(),
                ]);
              }}
              className="ml-3 underline"
            >
              Retry
            </button>
          </div>
        )}
        {(catalog.isLoading || quests.isLoading) && (
          <p role="status" className="px-9 pt-5 text-sm text-[#627067]">
            Loading your SideQuest workspace…
          </p>
        )}
        {activeView === "Home" && (
          <HomeView
            userName={userName}
            request={request}
            setRequest={setRequest}
            onSubmit={() => void coordinate(request)}
            onNavigate={navigate}
            onSelect={setSelected}
            plans={confirmed}
            activities={activities}
            people={people}
            busy={pending}
          />
        )}
        {activeView === "Scout" && (
          <ScoutView
            userId={userId}
            userName={userName}
            plans={quests.data ?? []}
            onNavigate={navigate}
            onStartPlanning={(id) => startPlanning(id, undefined, false)}
            onOpenPlan={setSelectedNegotiation}
            onRevision={(id) => {
              void utils.sidequest.invalidate();
              run(id);
            }}
          />
        )}
        {activeView === "Discover" && (
          <DiscoverView
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            category={category}
            setCategory={setCategory}
            activities={activities.filter(
              (activity) =>
                (category === "All" || category === activity.category) &&
                `${activity.title} ${activity.category} ${activity.description}`
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()),
            )}
            plannedIds={[]}
            onSelect={setSelected}
          />
        )}
        {activeView === "Plans" && (
          <PlansView
            plans={confirmed}
            negotiations={(quests.data ?? []).flatMap(
              ({ negotiation, proposal, sidequest }) => {
                if (!negotiation || negotiation.status === "CONFIRMED")
                  return [];
                return [
                  {
                    id: negotiation.id,
                    title: proposal?.activitySnapshot.title ?? sidequest.intent,
                    status: negotiation.status,
                    failure: negotiation.failure,
                    hasProposal: proposal !== null,
                  },
                ];
              },
            )}
            onNegotiation={setSelectedNegotiation}
            onDiscover={() => navigate("Discover")}
          />
        )}
        {activeView === "People" && (
          <PeopleView
            people={people}
            busy={pending}
            invited={[]}
            onInvite={(id) => {
              const person = people.find((p) => p.id === id);
              void coordinate(
                `Find a relaxed activity with ${person?.name ?? "this person"} that fits our preferences and availability.`,
                [id],
              );
            }}
          />
        )}
      </main>
      <MobileNav active={activeView} onNavigate={navigate} />
      {newNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-20 z-[60] mx-auto w-[min(24rem,calc(100vw-2rem))] lg:bottom-6"
        >
          <button
            type="button"
            aria-label={`Open new notification: ${newNotification.title}`}
            onClick={() => openNotification(newNotification.id)}
            className="w-full rounded-2xl border border-[#dfe2da] bg-white px-4 py-4 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:shadow-black/25"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e7eddf] text-[#244a36]">
                <Icon name="bell" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold tracking-[0.12em] text-[#7f8b82] uppercase">
                  New notification
                </span>
                <span className="mt-1 block text-sm font-semibold text-[#202a24]">
                  {newNotification.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#737d76]">
                  {newNotification.status.toLowerCase().replaceAll("_", " ")}
                  {" · Click to review"}
                </span>
              </span>
            </div>
          </button>
        </div>
      )}
      {selected && (
        <ActivityDetails
          activity={selected}
          busy={pending}
          onClose={() => setSelected(null)}
          onCoordinate={() =>
            void coordinate(
              `Explore ${selected.title} or a compatible alternative with people who might enjoy it.`,
            )
          }
        />
      )}
      {selectedNegotiation && (
        <NegotiationPanel
          key={selectedNegotiation}
          id={selectedNegotiation}
          userId={userId}
          onClose={() => setSelectedNegotiation(null)}
          onRun={run}
          running={
            resume.isPending && resume.variables?.id === selectedNegotiation
          }
        />
      )}
      {showSettings && (
        <SettingsDialog
          onClose={() => {
            setShowSettings(false);
            void Promise.all([
              utils.profile.invalidate(),
              utils.people.invalidate(),
            ]);
          }}
        />
      )}
    </div>
  );
}
