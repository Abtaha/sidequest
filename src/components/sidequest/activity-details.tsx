"use client";
import * as React from "react";
import type { ActivityDetailsProps } from "./types";
import { hikingActivity } from "./data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Icon } from "./icons";
import { SummaryStat, DetailRow } from "./shared";
export function ActivityDetails({
  activity,
  isPlanned,
  onClose,
  onAdd,
  onRemove,
  onChanged,
  onHikingReschedule,
}: ActivityDetailsProps) {
  const [changing, setChanging] = React.useState(false),
    [changeRequest, setChangeRequest] = React.useState(""),
    [selectedChange, setSelectedChange] = React.useState(""),
    isHiking = activity.id === hikingActivity.id,
    isRescheduled = isHiking && activity.time.startsWith("9:30"),
    isTimeChange = isHiking && isPlanned && "Try another time" === selectedChange;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        design
        showCloseButton={false}
        className="h-full w-full overflow-y-auto bg-[#fbfcf8] shadow-2xl sm:max-w-xl"
      >
        <div className="relative h-64">
          <img src={activity.image} alt={activity.title} className="h-full w-full object-cover" />
          <Button
            design
            onClick={onClose}
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#244a36] shadow-md"
            aria-label="Close details"
            type="button"
          >
            <Icon name="close" className="h-5 w-5" />
          </Button>
          <span className="absolute bottom-5 left-5 rounded-full bg-[#dff4c7] px-3 py-1.5 text-xs font-bold text-[#244a36]">
            {activity.match}
            {"% compatibility"}
          </span>
        </div>
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b866f]">
            {activity.category}
          </p>
          <SheetTitle className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {activity.title}
          </SheetTitle>
          <p className="mt-3 text-sm leading-6 text-[#667169]">{activity.description}</p>
          <div className="mt-6 grid gap-3 rounded-2xl bg-[#eef2e8] p-5 text-sm">
            <DetailRow icon="calendar">
              {activity.date}
              {" · "}
              {activity.time}
            </DetailRow>
            <DetailRow icon="pin">{activity.location}</DetailRow>
            <DetailRow icon="users">
              {"With "}
              {activity.people.join(", ")}
            </DetailRow>
            <DetailRow icon="clock">{activity.price}</DetailRow>
          </div>
          {isHiking && (
            <div className="mt-6 rounded-2xl border border-[#b9d3a7] bg-[#f0f7e8] p-5">
              <div className="flex items-center gap-2 text-[#315c3e]">
                <Icon name="spark" className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-[0.12em]">
                  {"AI agent negotiation summary"}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#46564a]">
                {isRescheduled ? (
                  <React.Fragment>
                    {
                      "Your Scout checked the requested change with Maya’s and Theo’s agents. Everyone agreed that "
                    }
                    <b className="text-[#244a36]">{"9:30 AM"}</b>
                    {" works, so the Saturday hike has been moved to the new time."}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {
                      "Your Scout spoke with Maya’s and Theo’s agents. They agreed on a short trail near you so nobody has a long trip. Everyone is free on Saturday morning and agreed to meet at "
                    }
                    <b className="text-[#244a36]">{"9:00 AM"}</b>
                    {". The hike will stay relaxed and finish by 11."}
                  </React.Fragment>
                )}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <SummaryStat label="Day" value="Saturday" />
                <SummaryStat label="Meet" value={isRescheduled ? "9:30 AM" : "9:00 AM"} />
                <SummaryStat label="Trail" value="Short &amp; nearby" />
              </div>
            </div>
          )}
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7f8b82]">
              {"Why Scout picked this"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#4e5851]">{activity.reason}</p>
          </div>
          {isHiking && !isPlanned ? (
            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button
                design
                onClick={onAdd}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#244a36] px-5 py-3.5 text-sm font-bold text-white"
                type="button"
              >
                <Icon name="check" className="h-4 w-4" />
                {"Accept plan"}
              </Button>
              <Button
                design
                onClick={() => onChanged("You passed on the Saturday morning hike.")}
                className="rounded-xl border border-[#d8ddd5] px-5 py-3.5 text-sm font-semibold text-[#667169]"
                type="button"
              >
                {"Reject"}
              </Button>
            </div>
          ) : changing ? (
            <div className="mt-6 rounded-2xl border border-[#dfe2da] bg-white p-5">
              <h3 className="font-semibold">{"What should change?"}</h3>
              <p className="mt-1 text-xs text-[#78827b]">
                {"Scout will recheck the group before anything is updated."}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {["Try another time", "Lower the budget", "Closer location", "Smaller group"].map(
                  (e) => (
                    <Button
                      design
                      key={e}
                      onClick={() => {
                        if (isHiking && isPlanned) {
                          setSelectedChange(e);
                        } else {
                          onChanged(`Scout is looking for a version with: ${e.toLowerCase()}.`);
                        }
                      }}
                      className={`rounded-xl border px-3 py-3 text-xs font-semibold text-[#244a36] ${selectedChange === e ? "border-[#244a36] bg-[#e3f1d4]" : "border-[#d8ddd5] hover:bg-[#eef2e8]"}`}
                      type="button"
                    >
                      {e}
                    </Button>
                  ),
                )}
              </div>
              <div className="mt-4 border-t border-[#e3e6df] pt-4">
                <label className="block">
                  <span className="text-xs font-semibold text-[#536159]">
                    {"Or describe any other change"}
                  </span>
                  <Textarea
                    design
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    rows={3}
                    placeholder={
                      isTimeChange
                        ? "Tell Scout what you want to change about the time..."
                        : "For example: Could we make it dog-friendly, invite Maya, and finish before 8?"
                    }
                    className="mt-2 w-full resize-none rounded-xl border border-[#d8ddd5] bg-[#fbfcf8] px-3.5 py-3 text-sm leading-5 outline-none focus:border-[#71956f] focus:ring-4 focus:ring-[#c9ed93]/30"
                  />
                </label>
                <Button
                  design
                  onClick={() => {
                    if (isTimeChange) {
                      onHikingReschedule();
                    } else {
                      onChanged(`Scout is working on your request: “${changeRequest.trim()}”`);
                    }
                  }}
                  disabled={!changeRequest.trim()}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#244a36] px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"
                  type="button"
                >
                  <Icon name="send" className="h-4 w-4" />
                  {isTimeChange ? "Send change request" : "Ask Scout to make this change"}
                </Button>
              </div>
              <Button
                design
                onClick={() => setChanging(false)}
                className="mt-3 w-full py-2 text-xs font-semibold text-[#737d76]"
                type="button"
              >
                {"Never mind"}
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button
                design
                onClick={isPlanned ? onRemove : onAdd}
                className={`col-span-2 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold ${isPlanned ? "bg-[#dff4c7] text-[#244a36]" : "bg-[#244a36] text-white"}`}
                type="button"
              >
                <Icon name={isPlanned ? "check" : "plus"} className="h-4 w-4" />
                {isPlanned ? "Plan accepted" : "Add to my plans"}
              </Button>
              <Button
                design
                onClick={() => setChanging(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#d8ddd5] px-4 py-3 text-sm font-semibold text-[#244a36]"
                type="button"
              >
                <Icon name="edit" className="h-4 w-4" />
                {"Change"}
              </Button>
              <Button
                design
                onClick={isPlanned ? onRemove : onClose}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-[#737d76]"
                type="button"
              >
                {isPlanned ? "Leave plan" : "Pass for now"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
