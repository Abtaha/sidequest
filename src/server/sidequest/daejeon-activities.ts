export const createDaejeonActivities = (at: (hours: number) => Date) => [
  {
    id: "00000000-0000-4000-8000-000000000007",
    title: "Saturday board games near KAIST",
    category: "GAMES",
    location: "Eoeun-dong, Yuseong-gu, Daejeon",
    description:
      "An indoor board-game meetup for a small group. Beginners welcome.",
    cost: 8000,
    capacity: 5,
    tags: ["indoor", "games", "small-group", "low-effort"],
    start: at(6), // Saturday, 15:00 KST
    end: at(9), // Saturday, 18:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    title: "Hanbat Arboretum walk",
    category: "OUTDOOR",
    location: "Dunsan-daero, Seo-gu, Daejeon",
    description: "Explore the gardens and take photos on a relaxed group walk.",
    cost: 0,
    capacity: 8,
    tags: ["outdoor", "nature", "walking", "photography", "low-effort"],
    start: at(1), // Saturday, 10:00 KST
    end: at(8), // Saturday, 17:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    title: "National Science Museum visit",
    category: "ART",
    location: "Daedeok-daero, Yuseong-gu, Daejeon",
    description: "Explore science and technology exhibitions together.",
    cost: 0,
    capacity: 6,
    tags: ["indoor", "science", "museum", "educational"],
    start: at(0), // Saturday, 09:00 KST
    end: at(8), // Saturday, 17:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    title: "Daejeon Museum of Art visit",
    category: "ART",
    location: "Dunsan-daero, Seo-gu, Daejeon",
    description: "Browse art exhibitions and discuss favorite artworks.",
    cost: 5000,
    capacity: 6,
    tags: ["indoor", "art", "museum", "low-effort"],
    start: at(1), // Saturday, 10:00 KST
    end: at(9), // Saturday, 18:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    title: "Gyejoksan hiking trip",
    category: "SPORT",
    location: "Jang-dong, Daedeok-gu, Daejeon",
    description: "Follow forest trails with a group at a moderate hiking pace.",
    cost: 0,
    capacity: 8,
    tags: ["outdoor", "hiking", "nature", "high-effort"],
    start: at(0), // Saturday, 09:00 KST
    end: at(6), // Saturday, 15:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    title: "Yuseong hot spring foot bath",
    category: "OUTDOOR",
    location: "Bongmyeong-dong, Yuseong-gu, Daejeon",
    description: "Relax at the public outdoor foot bath and chat with friends.",
    cost: 0,
    capacity: 4,
    tags: ["outdoor", "relaxation", "low-effort", "small-group"],
    start: at(5), // Saturday, 14:00 KST
    end: at(12), // Saturday, 21:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    title: "Sungsimdang bakery meetup",
    category: "Food",
    location: "Eunhaeng-dong, Jung-gu, Daejeon",
    description: "Try local baked goods and share snacks in central Daejeon.",
    cost: 10000,
    capacity: 4,
    tags: ["food", "bakery", "social", "low-effort"],
    start: at(0), // Saturday, 09:00 KST
    end: at(11), // Saturday, 20:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    title: "Daejeon O-World day trip",
    category: "OUTDOOR",
    location: "Sajeong-dong, Jung-gu, Daejeon",
    description: "Spend time exploring the zoo and amusement park.",
    cost: 35000,
    capacity: 8,
    tags: ["outdoor", "animals", "theme-park", "walking"],
    start: at(1), // Saturday, 10:00 KST
    end: at(8), // Saturday, 17:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000015",
    title: "Expo Science Park evening walk",
    category: "OUTDOOR",
    location: "Doryong-dong, Yuseong-gu, Daejeon",
    description: "Enjoy an evening walk around the Expo area and riverside.",
    cost: 0,
    capacity: 8,
    tags: ["outdoor", "walking", "photography", "evening"],
    start: at(9), // Saturday, 18:00 KST
    end: at(13), // Saturday, 22:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000016",
    title: "Cinema at Daejeon Shinsegae",
    category: "ART",
    location: "Doryong-dong, Yuseong-gu, Daejeon",
    description:
      "Watch a movie together; the film and screening time can be chosen later.",
    cost: 15000,
    capacity: 6,
    tags: ["indoor", "movies", "low-effort", "evening"],
    start: at(8), // Saturday, 17:00 KST
    end: at(14), // Saturday, 23:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000017",
    title: "Karaoke in Gung-dong",
    category: "MUSIC",
    location: "Gung-dong, Yuseong-gu, Daejeon",
    description: "Sing favorite songs in a private noraebang room.",
    cost: 12000,
    capacity: 6,
    tags: ["indoor", "music", "karaoke", "evening", "small-group"],
    start: at(10), // Saturday, 19:00 KST
    end: at(15), // Sunday, 00:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000018",
    title: "Basketball near KAIST",
    category: "SPORT",
    location: "Guseong-dong, Yuseong-gu, Daejeon",
    description: "Play a casual basketball game on an available outdoor court.",
    cost: 0,
    capacity: 10,
    tags: ["outdoor", "basketball", "team-sport", "high-effort"],
    start: at(4), // Saturday, 13:00 KST
    end: at(9), // Saturday, 18:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000019",
    title: "Cafe study and chat in Gung-dong",
    category: "Food",
    location: "Gung-dong, Yuseong-gu, Daejeon",
    description:
      "Meet for coffee, conversation or a quiet shared study session.",
    cost: 7000,
    capacity: 4,
    tags: ["indoor", "coffee", "study", "small-group", "low-effort"],
    start: at(2), // Saturday, 11:00 KST
    end: at(12), // Saturday, 21:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000020",
    title: "Daejeon Jungang Market food tour",
    category: "Food",
    location: "Jung-dong, Dong-gu, Daejeon",
    description: "Explore market stalls and try Korean street food together.",
    cost: 15000,
    capacity: 5,
    tags: ["food", "market", "walking", "social"],
    start: at(2), // Saturday, 11:00 KST
    end: at(10), // Saturday, 19:00 KST
  },
  {
    id: "00000000-0000-4000-8000-000000000021",
    title: "Sunday picnic at Yurim Park",
    category: "OUTDOOR",
    location: "Bongmyeong-dong, Yuseong-gu, Daejeon",
    description: "Bring snacks and enjoy a relaxed picnic with friends.",
    cost: 5000,
    capacity: 8,
    tags: ["outdoor", "nature", "picnic", "food", "low-effort"],
    start: at(27), // Sunday, 12:00 KST
    end: at(33), // Sunday, 18:00 KST
  },
];
