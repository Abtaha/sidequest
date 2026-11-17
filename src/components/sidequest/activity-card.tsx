"use client";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import type { Activity } from "./types";
export function ActivityCard({
  activity,
  onSelect,
  planned = false,
}: {
  activity: Activity;
  onSelect: () => void;
  planned?: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-[#dfe2da] bg-[#fbfcf8] transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#27372d]/10">
      <Button
        design
        onClick={onSelect}
        className="block w-full text-left"
        type="button"
      >
        <div className="relative h-48 overflow-hidden">
          <img
            src={activity.image}
            alt={activity.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <span className="absolute top-4 left-4 rounded-full bg-[#dff4c7] px-3 py-1.5 text-xs font-bold text-[#304137]">
            {activity.match > 0 ? `${activity.match}% match` : "Catalog option"}
          </span>
          {planned && (
            <span className="absolute top-4 right-4 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#244a36]">
              In your plans
            </span>
          )}
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-[#6b866f]">
            {activity.category}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
            {activity.title}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#707b73]">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {activity.date} · {activity.time.split(" – ")[0]}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-2 flex -space-x-2">
                {activity.people.slice(0, 3).map((name, index) => (
                  <div
                    key={name}
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 border-[#fbfcf8] text-[10px] font-bold ${["bg-[#d8c4b6]", "bg-[#c5d6c1]", "bg-[#c4cee0]"][index]}`}
                  >
                    {name[0]}
                  </div>
                ))}
              </div>
              <span className="text-xs text-[#737d76]">
                {activity.people.join(", ")}
              </span>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#244a36] text-white">
              <Icon name="arrow" className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Button>
    </article>
  );
}
