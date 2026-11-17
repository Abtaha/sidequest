"use client";
import { formText } from "@/lib/sidequest-data";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { datedAvailability } from "@/lib/sidequest-data";
import { Input } from "@/components/ui/input";
const interests = [
    "Food & coffee",
    "Outdoors",
    "Sports & fitness",
    "Arts & culture",
    "Music & nightlife",
    "Games",
    "Study sessions",
    "Volunteering",
  ],
  availability = [
    "Weekday mornings",
    "Weekday afternoons",
    "Weekday evenings",
    "Weekends",
  ];
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-[0.15em] text-[#6b866f] uppercase">
      {children}
    </p>
  );
}
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#17211b] sm:text-5xl">
      {children}
    </h1>
  );
}
function Description({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-xl text-[15px] leading-6 text-[#6c776f]">
      {children}
    </p>
  );
}
function Choice({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className="group relative cursor-pointer">
      <Input
        design
        type="checkbox"
        name={name}
        value={value}
        className="peer sr-only"
      />
      <span className="flex min-h-14 items-center justify-center rounded-xl border border-[#d9dfd7] bg-white px-3 text-center text-sm font-semibold text-[#566259] transition group-hover:border-[#9ab590] peer-checked:border-[#244a36] peer-checked:bg-[#e3f1d4] peer-checked:text-[#244a36]">
        {label}
      </span>
    </label>
  );
}
function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <select
        name={name}
        defaultValue=""
        className="w-full rounded-xl border border-[#d8ddd5] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#71956f]"
      >
        <option value="" disabled={true}>
          {"Choose one"}
        </option>
        {options.map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
    </label>
  );
}
export default function OnboardingForm({ name }: { name: string }) {
  const router = useRouter(),
    [step, setStep] = React.useState(1),
    [error, setError] = React.useState("");
  const requestId = React.useRef<string>(crypto.randomUUID());
  const save = api.profile.onboard.useMutation();
  return (
    <form
      className="mx-auto w-full max-w-2xl"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const data = new FormData(event.currentTarget),
          selected = data.getAll("interests").map(String);
        if (selected.length < 2) {
          setError("Choose at least two interests.");
          return;
        }
        if (step === 1) {
          setStep(2);
          return;
        }
        const windows = datedAvailability(
          data.getAll("availability").map(String),
        ).slice(0, 30);
        if (!windows.length) {
          setError("Choose at least one availability window.");
          return;
        }
        try {
          await save.mutateAsync({
            requestId: requestId.current,
            interests: selected,
            socialStyle: formText(data, "socialStyle", "No preference"),
            budget: formText(data, "budget", "Flexible"),
            windows,
            optIn: data.get("optIn") === "on",
          });
          router.push("/onboarding/personalize");
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not save your profile.",
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
          {"Step "}
          {step}
          {" of 3"}
        </span>
      </div>
      <div className="mb-10 h-1.5 overflow-hidden rounded-full bg-[#e1e6dd]">
        <div
          className="h-full rounded-full bg-[#76a85d] transition-all"
          style={{ width: `${33.333 * step}%` }}
        />
      </div>
      <div className={1 === step ? "block" : "hidden"}>
        <Eyebrow>{"Build your taste map"}</Eyebrow>
        <Heading>
          {"What are you into, "}
          {name.split(" ")[0]}
          {"?"}
        </Heading>
        <Description>
          {
            "Pick at least two. Scout will use these as conversation starters, not rigid labels."
          }
        </Description>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {interests.map((e) => (
            <Choice key={e} name="interests" value={e} label={e} />
          ))}
        </div>
      </div>
      <div className={2 === step ? "block" : "hidden"}>
        <Eyebrow>{"Your social rhythm"}</Eyebrow>
        <Heading>{"What usually feels right?"}</Heading>
        <Description>
          {
            "This helps Scout avoid plans that look good on paper but do not fit your energy or wallet."
          }
        </Description>
        <div className="mt-7 grid gap-6 sm:grid-cols-2">
          <SelectField
            label="Ideal group size"
            name="socialStyle"
            options={[
              "One-on-one",
              "Small groups",
              "The more the merrier",
              "No preference",
            ]}
          />
          <SelectField
            label="Usual budget"
            name="budget"
            options={["Free", "Under ₩10,000", "Under ₩25,000", "Flexible"]}
          />
        </div>
        <fieldset className="mt-7">
          <legend className="mb-3 text-sm font-semibold">
            {"When are you normally free?"}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {availability.map((e) => (
              <Choice key={e} name="availability" value={e} label={e} />
            ))}
          </div>
        </fieldset>
      </div>
      {step === 2 && (
        <>
          <p className="mt-4 text-xs text-[#627067]">
            These choices create dated availability for the next two weeks. You
            can edit exact dates in Settings.
          </p>
          <label className="mt-5 flex gap-3 text-sm">
            <input type="checkbox" name="optIn" /> Allow Scout to discover
            people in my campus circle and share the necessary planning
            constraints with their Scouts.
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-10 flex items-center justify-between">
        <Button
          design
          type="button"
          onClick={() => setStep((e) => Math.max(1, e - 1))}
          className={`text-sm font-semibold text-[#627067] ${1 === step ? "invisible" : ""}`}
        >
          {"Back"}
        </Button>
        <Button
          design
          type="submit"
          disabled={save.isPending}
          className="rounded-xl bg-[#244a36] px-6 py-3 text-sm font-bold text-white"
        >
          {"Continue"}
        </Button>
      </div>
    </form>
  );
}
