import AuthForm from "@/components/sidequest/auth-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#f5f6f1] lg:grid-cols-[1.05fr_.95fr]">
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <AuthForm />
      </section>
      <section className="relative hidden overflow-hidden bg-[#244a36] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border-[60px] border-[#c9ed93]/10" />
        <p className="relative max-w-md text-sm leading-6 text-white/65">
          Built for spontaneous plans, not endless group chats.
        </p>
        <div className="relative">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-[#dff4c7]">
            <span className="h-2 w-2 rounded-full bg-[#c9ed93]" /> Scout is comparing matches
          </div>
          <blockquote className="max-w-xl text-4xl font-medium leading-[1.08] tracking-[-0.04em]">
            “Three friends are free Saturday. Want to try the night market for under ₩20,000?”
          </blockquote>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
            {["Accept", "Change", "Pass"].map((label, index) => (
              <div
                key={label}
                className={`rounded-2xl px-4 py-4 text-center text-sm font-semibold ${index === 0 ? "bg-[#c9ed93] text-[#244a36]" : "border border-white/15 text-white/75"}`}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/45">
          Private by default · You make the final call
        </p>
      </section>
    </main>
  );
}
