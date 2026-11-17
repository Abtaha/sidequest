import { redirect } from "next/navigation";
import SideQuestApp from "@/components/sidequest/sidequest-app";
import { getSession } from "@/server/better-auth/server";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
export default async function AppPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [profile] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id));
  if (!profile) redirect("/onboarding");
  return <SideQuestApp userName={session.user.name} userId={session.user.id} />;
}
