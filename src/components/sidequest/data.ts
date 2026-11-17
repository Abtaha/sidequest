import type { Activity, Person, Memory, View, IconName } from "./types";

// Demo content and original asset references from the supplied Figma prototype.
export const initialMemories: Memory[] = [
  { id: "social-style", label: "Social style", value: "Small groups, low pressure" },
  { id: "budget", label: "Budget", value: "Usually under ₩25,000" },
  { id: "boundaries", label: "Boundaries", value: "Alcohol-free preferred" },
];

export const activities: Activity[] = [
  {
    id: "trail-tacos",
    title: "Sunset trail & tacos",
    image: "/images/photo-1682373440063-43e7260256be.jpg",
    match: 96,
    people: ["Maya", "Theo", "Jules"],
    date: "Saturday, May 25",
    time: "5:30 PM – 8:30 PM",
    location: "Hawk Hill · meet at campus gate",
    price: "About ₩18,000",
    category: "Outdoors",
    description: "An easy golden-hour walk followed by tacos nearby. No gear or planning needed.",
    reason: "Your outdoor interests, budget, and Saturday evening availability all line up.",
  },
  {
    id: "pottery",
    title: "Beginner pottery night",
    image: "/images/photo-1422246358533-95dcd3d48961.jpg",
    match: 92,
    people: ["Nina", "Owen"],
    date: "Thursday, May 30",
    time: "7:00 PM – 9:00 PM",
    location: "Clay Room · 12 min by bus",
    price: "₩22,000, materials included",
    category: "Arts & culture",
    description:
      "A relaxed two-hour hand-building class with tea and plenty of help for beginners.",
    reason: "Everyone wants a low-pressure weeknight plan and is curious about making something.",
  },
  {
    id: "bouldering",
    title: "After-work bouldering",
    image: "/images/photo-1564769662533-4f00a87b4056.jpg",
    match: 89,
    people: ["Ari", "Sam", "Lena"],
    date: "Tuesday, May 28",
    time: "6:30 PM – 8:00 PM",
    location: "Mission Cliffs · Studio B",
    price: "₩16,000 with shoe rental",
    category: "Sports",
    description: "A beginner-friendly climbing session. Ari can show everyone the basics.",
    reason: "The group is active, beginner-friendly, and free at the same time after class.",
  },
  {
    id: "night-market",
    title: "Night market snack crawl",
    image: "/images/photo-1558296144-c2425bc3aa41.jpg",
    match: 87,
    people: ["Elena", "Min"],
    date: "Friday, May 31",
    time: "7:30 PM – 10:00 PM",
    location: "Mangwon Market · Exit 2",
    price: "Around ₩20,000",
    category: "Food",
    description: "Pick a few stalls, share everything, and vote on the best snack of the night.",
    reason: "All three of you saved food adventures and prefer flexible Friday plans.",
  },
  {
    id: "board-games",
    title: "Cozy board game café",
    image: "/images/photo-1737562815369-78d3ee4d58aa.jpg",
    match: 84,
    people: ["Dani", "Owen", "Mika"],
    date: "Sunday, June 2",
    time: "3:00 PM – 5:30 PM",
    location: "Dice & Bean · Hongdae",
    price: "₩12,000",
    category: "Games",
    description: "Easy-to-learn games, coffee, and a table booked away from the busiest area.",
    reason: "A calm indoor option with the small-group energy you selected during onboarding.",
  },
  {
    id: "picnic",
    title: "Riverside picnic & sketching",
    image: "/images/photo-1669901530023-60aa57f74c6a.jpg",
    match: 81,
    people: ["Maya", "Nina"],
    date: "Saturday, June 8",
    time: "2:00 PM – 5:00 PM",
    location: "Yeouido Hangang Park",
    price: "Free · bring one snack",
    category: "Outdoors",
    description: "A slow afternoon outside with shared snacks. Drawing is completely optional.",
    reason: "This is free, social without being intense, and matches your arts and outdoors mix.",
  },
];

export const hikingActivity = {
  id: "scout-hiking",
  title: "Saturday morning hike",
  image: "/images/photo-1593132517397-ceb31d77194a.jpg",
  match: 95,
  people: ["Maya", "Theo"],
  date: "Saturday, May 25",
  time: "9:00 AM – 11:00 AM",
  location: "Pine Ridge Loop · 12 min away",
  price: "Free",
  category: "Outdoors",
  description:
    "A short, relaxed morning trail close to you, with enough time to grab coffee afterward.",
  reason:
    "Your Scout found a nearby option that fits everyone’s morning availability and preference for a shorter plan.",
};

export const people: Person[] = [
  {
    name: "Maya Chen",
    initials: "MC",
    color: "bg-[#d8c4b6]",
    status: "Free Saturday afternoon",
    interests: ["Hiking", "Food", "Photography"],
    overlap: "4 shared interests",
  },
  {
    name: "Elena Park",
    initials: "EP",
    color: "bg-[#c5d6c1]",
    status: "Free Sunday morning",
    interests: ["Coffee", "Museums", "Study sessions"],
    overlap: "3 shared interests",
  },
  {
    name: "Theo Martin",
    initials: "TM",
    color: "bg-[#c4cee0]",
    status: "Free Friday after 6",
    interests: ["Outdoors", "Live music", "Tacos"],
    overlap: "3 shared interests",
  },
  {
    name: "Nina Shah",
    initials: "NS",
    color: "bg-[#e5c6cf]",
    status: "Free Thursday evening",
    interests: ["Ceramics", "Markets", "Tea"],
    overlap: "2 shared interests",
  },
  {
    name: "Owen Lee",
    initials: "OL",
    color: "bg-[#e0d5b8]",
    status: "Flexible this weekend",
    interests: ["Games", "Climbing", "Coffee"],
    overlap: "2 shared interests",
  },
  {
    name: "Ari Williams",
    initials: "AW",
    color: "bg-[#bdd7d1]",
    status: "Free Tuesday evening",
    interests: ["Bouldering", "Running", "Ramen"],
    overlap: "2 shared interests",
  },
];

export const initialPlans = [activities[0]!, activities[3]!];

export const navigation: [View, IconName][] = [
  ["Home", "home"],
  ["Scout", "spark"],
  ["Discover", "search"],
  ["Plans", "calendar"],
  ["People", "users"],
];
