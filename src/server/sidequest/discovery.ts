import { eq, or } from "drizzle-orm";
import { profiles } from "../db/schema";

export function discoveryScope(profile: {
  circle: string;
  openDiscovery: boolean;
}) {
  const sameCircle = eq(profiles.circle, profile.circle);
  return profile.openDiscovery
    ? or(sameCircle, eq(profiles.openDiscovery, true))
    : sameCircle;
}

const genericWords = new Set(
  [
    "about activity activities after also and another are can check choose coordinate",
    "enjoy enjoys event evening find first for from fun going group have interest",
    "interested into like likes looking love loves meetup morning most much need next",
    "one open people play prefer prefers relaxed saturday scout small someone something",
    "sunday that the their them then there they this together under want weekend",
    "were what when where which who will with won would you your",
  ]
    .join(" ")
    .split(" "),
);

export function requestedGroupSize(intent: string) {
  const counts = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const total = /\b(?:group|party) of (two|three|four|five|[2-5])\b/i.exec(
    intent,
  );
  const others =
    /\bwith (one|two|three|four|[1-4]) (?:other )?(?:people|friends|classmates|participants)\b/i.exec(
      intent,
    );
  const count = total?.[1] ?? others?.[1];
  if (!count) return undefined;
  const normalized = count.toLowerCase();
  const size =
    (counts[normalized as keyof typeof counts] ?? Number(normalized)) +
    (total ? 0 : 1);
  return { minGroup: size, maxGroup: size };
}

export function interestTerms(text: string): Set<string> {
  const words =
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [];
  return new Set(
    words.flatMap((word) => {
      if (word.length < 2 || genericWords.has(word)) return [];
      const term =
        word.length > 4 && word.endsWith("s") && !word.endsWith("ss")
          ? word.slice(0, -1)
          : word;
      return genericWords.has(term) ? [] : [term];
    }),
  );
}

export function rankCandidatesByInterest<T extends { userId: string }>(
  ownerId: string,
  intent: string,
  candidates: T[],
  memories: { userId: string; content: string }[],
) {
  const interests = new Map<string, Set<string>>();
  for (const { userId, content } of memories) {
    const tokens = interests.get(userId) ?? new Set<string>();
    for (const term of interestTerms(content)) tokens.add(term);
    interests.set(userId, tokens);
  }
  const requested = interestTerms(intent);
  const owner = interests.get(ownerId);
  return candidates
    .map((candidate) => {
      let score = 0;
      for (const term of interests.get(candidate.userId) ?? []) {
        if (requested.has(term)) score += 3;
        if (owner?.has(term)) score += 1;
      }
      return { candidate, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.userId.localeCompare(b.candidate.userId),
    );
}
