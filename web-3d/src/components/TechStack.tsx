const STACK = [
  { name: "Godot 4", detail: "3D engine driving every experiment" },
  { name: "Real physics simulation", detail: "Kinematics, F=ma, and W=Fd computed directly, not approximated" },
  { name: "Adaptive learning engine", detail: "Deterministic mastery model — concept, module, and difficulty" },
  { name: "WebAssembly / Web Export", detail: "The full Godot game runs in-browser, no plugin required" },
  { name: "Next.js", detail: "The site you're reading, deployed on Vercel" },
  { name: "Server-side AI insight adapter", detail: "Structured explanations with a deterministic fallback — see /progress" },
];

export default function TechStack() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-cyan uppercase">
            Under the hood
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            What&apos;s actually running
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            No hidden layers, no unimplemented claims — this is the real
            stack behind NEXUS today.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((item) => (
            <div
              key={item.name}
              className="rounded-xl border border-border bg-surface-blue p-5"
            >
              <h3 className="font-display text-base font-bold text-ink">
                {item.name}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
