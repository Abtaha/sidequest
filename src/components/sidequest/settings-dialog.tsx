"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type RouterOutputs } from "@/trpc/react";
import { authClient } from "@/server/better-auth/client";
import { localDateValue } from "@/lib/sidequest-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const profile = api.profile.get.useQuery();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        design
        className="top-1/2 left-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-white p-6"
      >
        <DialogTitle className="text-2xl font-semibold">
          Scout settings
        </DialogTitle>
        {profile.isLoading && <p role="status">Loading profile…</p>}
        {profile.error && (
          <p role="alert" className="text-sm text-red-700">
            {profile.error.message}
          </p>
        )}
        {profile.data?.profile && (
          <SettingsForm data={profile.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
function SettingsForm({
  data,
  onClose,
}: {
  data: RouterOutputs["profile"]["get"];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const profile = data.profile!,
    router = useRouter(),
    utils = api.useUtils();
  const [discoverable, setDiscoverable] = React.useState(profile.discoverable),
    [openDiscovery, setOpenDiscovery] = React.useState(profile.openDiscovery),
    [sharing, setSharing] = React.useState(profile.sharing),
    [circle, setCircle] = React.useState(profile.circle),
    [maxCost, setMaxCost] = React.useState(
      profile.constraints.maxCost?.toString() ?? "",
    ),
    [windows, setWindows] = React.useState(
      data.availability.map((w) => ({
        start: localDateValue(w.start),
        end: localDateValue(w.end),
      })),
    ),
    [error, setError] = React.useState("");
  const saveProfile = api.profile.update.useMutation(),
    saveAvailability = api.profile.updateAvailability.useMutation();
  const busy = saveProfile.isPending || saveAvailability.isPending;
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const parsed = windows.map((w) => ({
          start: new Date(w.start),
          end: new Date(w.end),
        }));
        if (
          parsed.some(
            (w) =>
              !Number.isFinite(+w.start) ||
              !Number.isFinite(+w.end) ||
              w.end <= w.start,
          )
        ) {
          setError(
            "Each availability window needs a valid start and a later end.",
          );
          return;
        }
        try {
          await saveProfile.mutateAsync({
            discoverable,
            openDiscovery,
            sharing,
            circle,
            blockedUsers: profile.blockedUsers,
            constraints: {
              ...profile.constraints,
              maxCost: maxCost === "" ? undefined : Number(maxCost),
            },
          });
          await saveAvailability.mutateAsync({ windows: parsed });
          await Promise.all([
            utils.profile.invalidate(),
            utils.people.invalidate(),
          ]);
          onClose();
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not save preferences.",
          );
        }
      }}
      className="space-y-4"
    >
      <label className="flex gap-3 rounded-xl bg-[#f4f5f1] p-4 text-sm">
        <input
          type="checkbox"
          checked={discoverable}
          onChange={(event) => setDiscoverable(event.target.checked)}
        />{" "}
        Let other people discover my Scout
      </label>
      <label className="flex gap-3 rounded-xl bg-[#f4f5f1] p-4 text-sm">
        <input
          type="checkbox"
          checked={sharing}
          onChange={(event) => setSharing(event.target.checked)}
        />{" "}
        Allow Scouts to share necessary planning constraints. Private notes stay
        private.
      </label>
      <label className="flex gap-3 rounded-xl bg-[#f4f5f1] p-4 text-sm">
        <input
          type="checkbox"
          checked={openDiscovery}
          onChange={(event) => setOpenDiscovery(event.target.checked)}
        />{" "}
        <span>
          Match with people across SideQuest
          <span className="mt-1 block text-xs text-slate-600">
            Turn this off to match within your planning circle.
          </span>
        </span>
      </label>
      <label className="block text-sm">
        Planning circle
        <input
          required
          maxLength={80}
          value={circle}
          onChange={(event) => setCircle(event.target.value)}
          className="mt-2 w-full rounded-xl border p-3"
        />
      </label>
      <label className="block text-sm">
        Hard budget ceiling per person (₩)
        <input
          type="number"
          min={0}
          step={1}
          value={maxCost}
          onChange={(event) => setMaxCost(event.target.value)}
          placeholder="No explicit ceiling"
          className="mt-2 w-full rounded-xl border p-3"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">
          Exact availability (your local timezone)
        </legend>
        <p className="mt-2 text-xs text-[#627067]">
          Only these dated windows may be proposed. An empty calendar prevents
          new proposals.
        </p>
        <div className="mt-3 space-y-3">
          {windows.map((window, index) => (
            <div key={index} className="rounded-xl border p-3">
              <label className="block text-xs">
                Start
                <input
                  required
                  type="datetime-local"
                  value={window.start}
                  onChange={(event) =>
                    setWindows(
                      windows.map((w, i) =>
                        i === index ? { ...w, start: event.target.value } : w,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label className="mt-2 block text-xs">
                End
                <input
                  required
                  type="datetime-local"
                  value={window.end}
                  onChange={(event) =>
                    setWindows(
                      windows.map((w, i) =>
                        i === index ? { ...w, end: event.target.value } : w,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setWindows(windows.filter((_, i) => i !== index))
                }
                className="mt-2 text-xs text-red-700"
              >
                Remove window
              </button>
            </div>
          ))}
        </div>
        <Button
          design
          disabled={windows.length >= 30}
          type="button"
          onClick={() => setWindows([...windows, { start: "", end: "" }])}
          className="mt-3 rounded-xl border px-4 py-2 text-xs"
        >
          Add availability window
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        design
        disabled={busy}
        type="submit"
        className="w-full rounded-xl bg-[#244a36] p-3 text-sm font-semibold text-white"
      >
        {busy ? "Saving…" : "Save preferences"}
      </Button>
      <Button
        design
        type="button"
        onClick={async () => {
          try {
            const result = await authClient.signOut();
            if (result.error) {
              setError(result.error.message ?? "Could not sign out");
              return;
            }
            queryClient.clear();
            router.replace("/login");
            router.refresh();
          } catch {
            setError("Could not sign out.");
          }
        }}
        className="w-full text-sm text-[#627067]"
      >
        Sign out
      </Button>
    </form>
  );
}
