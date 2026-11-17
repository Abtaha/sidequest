import OnboardingForm from "@/components/sidequest/onboarding-form";

import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <main className="min-h-screen bg-[#f5f6f1] px-6 py-8 sm:px-10 sm:py-12">
      <OnboardingForm name={session.user.name} />
    </main>
  );
}
