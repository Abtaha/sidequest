"use client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DetailRow } from "./shared";
import type { Activity } from "./types";
export function ActivityDetails({
  activity,
  onClose,
  onCoordinate,
  busy,
}: {
  activity: Activity;
  onClose: () => void;
  onCoordinate: () => void;
  busy: boolean;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        design
        className="inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-[#fbfcf8] p-0"
      >
        <img src={activity.image} alt="" className="h-60 w-full object-cover" />
        <div className="p-6 md:p-8">
          <p className="text-xs font-semibold text-[#6b866f]">
            {activity.category}
          </p>
          <SheetTitle className="mt-2 text-3xl font-semibold">
            {activity.title}
          </SheetTitle>
          <p className="mt-4 text-sm leading-6 text-[#627067]">
            {activity.description}
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <DetailRow icon="calendar">{activity.date}</DetailRow>
            <DetailRow icon="clock">
              Available window: {activity.time}
            </DetailRow>
            <DetailRow icon="pin">{activity.location}</DetailRow>
            <p className="font-semibold">{activity.price}/person</p>
          </div>
          <p className="mt-6 rounded-xl bg-[#e3ebd9] p-4 text-sm leading-6">
            Scout will contact permitted participants and negotiate a feasible
            option. You will review the exact proposal before joining. Catalog
            activities are not reservations.
          </p>
          <Button
            design
            disabled={busy}
            onClick={onCoordinate}
            className="mt-6 w-full rounded-xl bg-[#244a36] p-4 text-sm font-semibold text-white"
          >
            {busy ? "Starting…" : "Ask Scout to coordinate"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
