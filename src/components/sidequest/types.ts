import type { ReactNode } from "react";

export type View = "Home" | "Scout" | "Discover" | "Plans" | "People";
export type IconName =
  | "spark"
  | "home"
  | "search"
  | "calendar"
  | "users"
  | "settings"
  | "bell"
  | "arrow"
  | "chevron"
  | "pin"
  | "clock"
  | "check"
  | "send"
  | "close"
  | "filter"
  | "edit"
  | "message"
  | "plus";
export interface Activity {
  id: string;
  title: string;
  image: string;
  match: number;
  people: string[];
  date: string;
  time: string;
  location: string;
  price: string;
  category: string;
  description: string;
  reason: string;
}
export interface Person {
  name: string;
  initials: string;
  color: string;
  status: string;
  interests: string[];
  overlap: string;
}
export interface Memory {
  id: string;
  label: string;
  value: string;
}
export interface NavigationProps {
  active: View;
  onNavigate: (view: View) => void;
}
export interface HeaderProps {
  userName: string;
  onNotifications: () => void;
  showNotifications: boolean;
  notifications: { id: string; title: string; status: string }[];
  onNotification: (id: string) => void;
  onSettings: () => void;
}
export interface HomeProps {
  userName: string;
  request: string;
  setRequest: (value: string) => void;
  onSubmit: () => void;
  onNavigate: (view: View) => void;
  onSelect: (activity: Activity) => void;
  plans: Activity[];
  activities: Activity[];
  people: Person[];
  busy: boolean;
}
export interface DiscoverProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  activities: Activity[];
  plannedIds: string[];
  onSelect: (activity: Activity) => void;
}
export interface PlansProps {
  plans: Activity[];
  negotiations: { id: string; title: string; status: string }[];
  onNegotiation: (id: string) => void;
  onSelect: (activity: Activity) => void;
  onDiscover: () => void;
}
export interface PeopleProps {
  people: (Person & { id: string })[];
  busy: boolean;
  invited: string[];
  onInvite: (name: string) => void;
}
export interface ScoutProps {
  userName: string;
  onNavigate: (view: View) => void;
  onActivityFound: () => void;
  memories: Memory[];
  onMemoriesChange: (memories: Memory[]) => void;
}
export interface MemoryProps {
  memory: Memory;
  editing: boolean;
  onChange: (memory: Memory) => void;
  onRemove: () => void;
}
export interface ActivityDetailsProps {
  activity: Activity;
  isPlanned: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onChanged: (message: string) => void;
  onHikingReschedule: () => void;
}
export interface HeadingProps {
  eyebrow: string;
  title: string;
  copy: string;
}
export interface ActionProps {
  title: string;
  copy: string;
  action: string;
  onAction: () => void;
}
export interface ChildrenProps {
  children: ReactNode;
}
