"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
function AuthField({
  label,
  ...s
}: React.ComponentProps<"input"> & {
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#4f5d54]">{label}</span>
      <Input
        design
        {...s}
        required={true}
        className="w-full rounded-xl border border-[#d8ddd5] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#a1a9a3] focus:border-[#71956f] focus:ring-4 focus:ring-[#c9ed93]/30"
      />
    </label>
  );
}
export default function AuthForm() {
  const router = useRouter(),
    [mode, setMode] = React.useState("signup");
  return (
    <div className="w-full max-w-[460px]">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#244a36] text-xl text-[#c9ed93]">
          {"✦"}
        </div>
        <span className="text-xl font-bold tracking-[-0.04em]">{"SideQuest"}</span>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#63806f]">
        {"Meet your social sidekick"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#17211b] sm:text-5xl">
        {"Your plans start with Scout."}
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-6 text-[#69756d]">
        {
          "Create a private profile, tell Scout what you enjoy, and get thoughtful plans you always approve first."
        }
      </p>
      <div className="mt-8 grid grid-cols-2 rounded-xl bg-[#e9ede6] p-1">
        <Button
          design
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${"signup" === mode ? "bg-white text-[#244a36] shadow-sm" : "text-[#748078]"}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          {"Create account"}
        </Button>
        <Button
          design
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${"login" === mode ? "bg-white text-[#244a36] shadow-sm" : "text-[#748078]"}`}
          onClick={() => setMode("login")}
          type="button"
        >
          {"Log in"}
        </Button>
      </div>
      <form
        className="mt-5 space-y-4"
        onSubmit={(t) => {
          t.preventDefault();
          router.push("/onboarding");
        }}
      >
        {"signup" === mode && (
          <AuthField label="Your name" name="name" placeholder="Alex" autoComplete="name" />
        )}
        <AuthField
          label="School email"
          name="email"
          placeholder="you@university.edu"
          type="text"
          autoComplete="email"
        />
        <AuthField
          label="Password"
          name="password"
          placeholder="At least 8 characters"
          type="password"
          autoComplete={"login" === mode ? "current-password" : "new-password"}
        />
        <Button
          design
          className="w-full rounded-xl bg-[#244a36] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#315e47]"
          type="submit"
        >
          {"login" === mode ? "Log in to SideQuest" : "Create my Scout"}
        </Button>
      </form>
      <p className="mt-5 text-xs leading-5 text-[#7a857e]">
        {
          "Scout only uses your profile to find relevant matches. Nothing gets shared without your approval."
        }
      </p>
    </div>
  );
}
