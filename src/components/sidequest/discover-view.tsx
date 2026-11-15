"use client";
import { ActivityCard } from "./activity-card";
import type { DiscoverProps } from "./types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "./icons";
import { PageHeading, EmptyState } from "./shared";
export function DiscoverView({
  searchTerm,
  setSearchTerm,
  category,
  setCategory,
  activities,
  plannedIds,
  onSelect,
}: DiscoverProps) {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-9 md:py-10">
      <PageHeading
        eyebrow="Discover"
        title={searchTerm ? `Ideas for “${searchTerm}”` : "Plans that feel like you"}
        copy="Scout ranked these using your interests, budget, social style, and the people who are actually free."
      />
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#dfe2da] bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 px-2">
          <Icon name="search" className="h-5 w-5 text-[#758078]" />
          <Input
            design
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search a vibe, activity, or person"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
          {searchTerm && (
            <Button
              design
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              type="button"
            >
              <Icon name="close" className="h-4 w-4 text-[#758078]" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-t border-[#e5e8e2] pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          <Icon name="filter" className="h-4 w-4 shrink-0 text-[#758078]" />
          {["All", "Outdoors", "Arts & culture", "Sports", "Food", "Games"].map((e) => (
            <Button
              design
              key={e}
              onClick={() => setCategory(e)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${category === e ? "bg-[#244a36] text-white" : "bg-[#f0f2ec] text-[#657069]"}`}
              type="button"
            >
              {e}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-[#6f7972]">
          {activities.length}
          {" strong matches"}
        </p>
        <p className="text-xs font-semibold text-[#6f7972]">{"Sorted by compatibility"}</p>
      </div>
      {activities.length ? (
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((e) => (
            <ActivityCard
              key={e.id}
              activity={e}
              onSelect={() => onSelect(e)}
              planned={plannedIds.includes(e.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No exact matches yet"
          copy="Try a broader vibe or switch the category filter."
          action="Clear filters"
          onAction={() => {
            setSearchTerm("");
            setCategory("All");
          }}
        />
      )}
    </div>
  );
}
