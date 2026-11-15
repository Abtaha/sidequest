import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center"><span className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#244a36] text-2xl text-[#c9ed93]">✦</span><h1 className="text-3xl font-semibold tracking-tight">This trail ends here.</h1><p className="mt-3 text-sm text-[#69756d]">We couldn’t find that page. Your next SideQuest is still waiting.</p><Link href="/app" className="mt-6 rounded-xl bg-[#244a36] px-5 py-3 text-sm font-bold text-white">Back to SideQuest</Link></main>;
}
