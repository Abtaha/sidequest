const fixtureLocation = "Fictional campus demo area (synthetic)";

export function activityLabels(activity: { title: string; location: string }) {
  if (activity.location !== fixtureLocation)
    return { title: activity.title, location: activity.location };
  const title = activity.title.replace(/^Synthetic\s+/u, "");
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    location: "Campus area",
  };
}
