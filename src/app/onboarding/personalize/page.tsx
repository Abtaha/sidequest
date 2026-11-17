import PersonalizeForm from "@/components/sidequest/personalize-form";

import { redirect } from "next/navigation";
import { getSession } from "@/server/better-auth/server";
export default async function PersonalizePage() {
  if (!(await getSession())) redirect("/login");
  return (
    <main className="min-h-screen bg-[#f5f6f1] px-6 py-8 sm:px-10 sm:py-12">
      <PersonalizeForm />
    </main>
  );
}
