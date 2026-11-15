"use client";
import * as React from "react";
import type { Activity, View } from "./types";
import { activities, hikingActivity, initialMemories, initialPlans } from "./data";
import { Toast } from "./shared";
import { Sidebar, Header, MobileNav } from "./shell";
import { HomeView } from "./home-view";
import { DiscoverView } from "./discover-view";
import { PlansView } from "./plans-view";
import { PeopleView } from "./people-view";
import { ScoutView } from "./scout-view";
import { ActivityDetails } from "./activity-details";
import { SettingsDialog } from "./settings-dialog";
export default function SideQuestApp({ userName }: { userName: string }) {
  const [activeView, setActiveView] = React.useState<View>("Home"),
    [request, setRequest] = React.useState(""),
    [searchTerm, setSearchTerm] = React.useState(""),
    [selectedActivity, setSelectedActivity] = React.useState<Activity | null>(null),
    [plannedIds, setPlannedIds] = React.useState(initialPlans.map((e) => e.id)),
    [invitedPeople, setInvitedPeople] = React.useState<string[]>([]),
    [category, setCategory] = React.useState("All"),
    [showNotifications, setShowNotifications] = React.useState(false),
    [showSettings, setShowSettings] = React.useState(false),
    [hikingFound, setHikingFound] = React.useState(false),
    [hikingRescheduled, setHikingRescheduled] = React.useState(false),
    [memories, setMemories] = React.useState(initialMemories),
    [toast, setToast] = React.useState(""),
    currentHike = hikingRescheduled
      ? { ...hikingActivity, time: "9:30 AM – 11:30 AM" }
      : hikingActivity,
    plans = [...activities, currentHike].filter((e) => plannedIds.includes(e.id)),
    filteredActivities = React.useMemo(() => {
      const e = searchTerm.toLowerCase();
      return activities.filter((t) => {
        const s = "All" === category || t.category === category,
          a =
            !e ||
            `${t.title} ${t.category} ${t.description} ${t.people.join(" ")}`
              .toLowerCase()
              .includes(e);
        return s && a;
      });
    }, [category, searchTerm]);
  function navigate(e: View) {
    setActiveView(e);
    setSelectedActivity(null);
    setShowNotifications(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <div className="min-h-screen bg-[#f5f6f1] text-[#17211b]">
      <Sidebar active={activeView} onNavigate={navigate} onSettings={() => setShowSettings(true)} />
      <main className="min-h-screen pb-24 lg:ml-[232px] lg:pb-0">
        <Header
          userName={userName}
          onNotifications={() => setShowNotifications((e) => !e)}
          showNotifications={showNotifications}
          hikingFound={hikingFound}
          hikingRescheduled={hikingRescheduled}
          onHikingClick={() => {
            setSelectedActivity(currentHike);
            setShowNotifications(false);
          }}
        />
        {"Home" === activeView && (
          <HomeView
            userName={userName}
            request={request}
            setRequest={setRequest}
            onSubmit={function () {
              if (request.trim()) {
                setSearchTerm(request.trim());
                setRequest("");
                navigate("Discover");
              }
            }}
            onNavigate={navigate}
            onSelect={setSelectedActivity}
            plans={plans}
          />
        )}
        {"Scout" === activeView && (
          <ScoutView
            userName={userName}
            onNavigate={navigate}
            onActivityFound={() => {
              if (!hikingFound) {
                setHikingFound(true);
                setToast("Activity found: Saturday morning hike. Open notifications to review it.");
              }
            }}
            memories={memories}
            onMemoriesChange={setMemories}
          />
        )}
        {"Discover" === activeView && (
          <DiscoverView
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            category={category}
            setCategory={setCategory}
            activities={filteredActivities}
            plannedIds={plannedIds}
            onSelect={setSelectedActivity}
          />
        )}
        {"Plans" === activeView && (
          <PlansView
            plans={plans}
            onSelect={setSelectedActivity}
            onDiscover={() => navigate("Discover")}
          />
        )}
        {"People" === activeView && (
          <PeopleView
            invited={invitedPeople}
            onInvite={(e) => {
              setInvitedPeople((t) => (t.includes(e) ? t : [...t, e]));
              setToast(`Scout sent ${e} a low-pressure invite.`);
            }}
          />
        )}
      </main>
      <MobileNav active={activeView} onNavigate={navigate} />
      {selectedActivity && (
        <ActivityDetails
          activity={selectedActivity}
          isPlanned={plannedIds.includes(selectedActivity.id)}
          onClose={() => setSelectedActivity(null)}
          onAdd={() => {
            if (!plannedIds.includes(selectedActivity.id)) {
              setPlannedIds((e) => [...e, selectedActivity.id]);
            }
            setToast(`${selectedActivity.title} was added to your plans.`);
            setSelectedActivity(null);
          }}
          onRemove={() => {
            setPlannedIds((e) => e.filter((e) => e !== selectedActivity.id));
            setToast(`${selectedActivity.title} was removed from your plans.`);
            setSelectedActivity(null);
          }}
          onChanged={(e) => {
            setToast(e);
            setSelectedActivity(null);
          }}
          onHikingReschedule={() => {
            setToast(
              "Agents will negotiate to see if everyone can meet at 9:30 AM. You’ll be notified if the new time works for everyone.",
            );
            setHikingRescheduled(true);
            setSelectedActivity(null);
          }}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
