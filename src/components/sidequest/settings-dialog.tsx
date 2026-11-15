"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "./icons";
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [testMatches, setTestMatches] = React.useState(true);
  const [planUpdates, setPlanUpdates] = React.useState(true);
  const [availabilitySharing, setAvailabilitySharing] = React.useState(true);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        design
        showCloseButton={false}
        className="top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6b866f]">
              {"Preferences"}
            </p>
            <DialogTitle className="mt-1 text-2xl font-semibold leading-8">
              {"Scout settings"}
            </DialogTitle>
          </div>
          <Button design onClick={onClose} aria-label="Close settings" type="button">
            <Icon name="close" />
          </Button>
        </div>
        <div className="mt-6 space-y-3">
          <PreferenceToggle
            title="Let Scout test matches"
            copy="Scout can privately compare compatibility."
            enabled={testMatches}
            onClick={() => setTestMatches((e) => !e)}
          />
          <PreferenceToggle
            title="Plan updates"
            copy="Notify me when details change."
            enabled={planUpdates}
            onClick={() => setPlanUpdates((value) => !value)}
          />
          <PreferenceToggle
            title="Availability sharing"
            copy="Only show broad free-time windows."
            enabled={availabilitySharing}
            onClick={() => setAvailabilitySharing((value) => !value)}
          />
        </div>
        <Button
          design
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#244a36] px-4 py-3 text-sm font-bold text-white"
          type="button"
        >
          {"Save preferences"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
export function PreferenceToggle({
  title,
  copy,
  enabled,
  onClick,
}: {
  title: string;
  copy: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#f4f5f1] p-4">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-[#737d76]">{copy}</p>
      </div>
      <Button
        design
        onClick={onClick}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${enabled ? "justify-end bg-[#76a85d]" : "justify-start bg-[#cbd1ca]"}`}
        aria-label={`Toggle ${title}`}
        role="switch"
        aria-checked={enabled}
        type="button"
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </Button>
    </div>
  );
}
