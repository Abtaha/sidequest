"use client";
import { formText } from "@/lib/sidequest-data";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { api } from "@/trpc/react";
import { Textarea } from "@/components/ui/textarea";
export default function PersonalizeForm() {
  const router = useRouter();
  const save = api.scout.sendMessage.useMutation();
  const [error, setError] = React.useState("");
  const requestId = React.useRef(crypto.randomUUID());
  return (
    <form
      className="mx-auto w-full max-w-2xl"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const content = formText(
          new FormData(event.currentTarget),
          "personalContext",
        ).trim();
        try {
          if (content)
            await save.mutateAsync({ requestId: requestId.current, content });
          router.push("/app");
          router.refresh();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Could not save context.",
          );
        }
      }}
    >
      <div className="mb-9 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#244a36] text-[#c9ed93]">
            {"✦"}
          </div>
          <b className="tracking-[-0.03em]">{"SideQuest"}</b>
        </div>
        <span className="text-xs font-semibold text-[#758078]">
          {"Step 3 of 3"}
        </span>
      </div>
      <div className="mb-10 h-1.5 overflow-hidden rounded-full bg-[#e1e6dd]">
        <div className="h-full w-full rounded-full bg-[#76a85d]" />
      </div>
      <p className="text-xs font-bold tracking-[0.15em] text-[#6b866f] uppercase">
        {"Make Scout yours"}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#17211b] sm:text-5xl">
        {"Tell Scout anything."}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-6 text-[#6c776f]">
        {
          "This part is completely open-ended. Share the little things that make a plan feel right for you—there are no preset answers and nothing here is required."
        }
      </p>
      <div className="mt-7 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">
            {"What would help Scout understand you?"}
          </span>
          <Textarea
            design
            name="personalContext"
            rows={8}
            autoFocus={true}
            placeholder="Write whatever feels useful—for example: I like spontaneous food trips, I’m quiet in big groups, Sundays are usually my reset day, or I’ve always wanted to learn pottery."
            className="w-full resize-none rounded-xl border border-[#d8ddd5] bg-white px-4 py-3.5 text-sm leading-6 outline-none focus:border-[#71956f] focus:ring-4 focus:ring-[#c9ed93]/30"
          />
        </label>
        <div className="rounded-2xl bg-[#e7eddf] p-4 text-sm leading-6 text-[#536351]">
          <b className="text-[#244a36]">{"Private by default."}</b>
          {
            " Scout uses this context to make better suggestions, but never shares your personal notes with other people or agents."
          }
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-10 flex items-center justify-between">
        <Button
          design
          type="button"
          onClick={() => router.back()}
          className="text-sm font-semibold text-[#627067]"
        >
          {"Back"}
        </Button>
        <Button
          design
          type="submit"
          disabled={save.isPending}
          className="rounded-xl bg-[#c9ed93] px-6 py-3 text-sm font-bold text-[#244a36]"
        >
          {"Meet my Scout"}
        </Button>
      </div>
    </form>
  );
}
