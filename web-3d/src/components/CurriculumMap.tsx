const MODULES = [
  {
    name: "Projectile Motion",
    color: "bg-blue",
    ring: "border-blue/30",
    concepts: ["Speed & Range", "Gravity & Trajectory"],
  },
  {
    name: "Newton's Laws",
    color: "bg-purple",
    ring: "border-purple/30",
    concepts: ["Force & Acceleration", "Net Force", "Friction"],
  },
  {
    name: "Work & Energy",
    color: "bg-gold-dark",
    ring: "border-gold/40",
    concepts: ["Work", "Kinetic Energy", "Work-Energy Theorem"],
  },
];

export default function CurriculumMap() {
  return (
    <section className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Learn
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            The curriculum map
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            This is the order concepts are introduced in — not a checklist
            of what you&apos;ve unlocked. The game itself, not this page,
            decides when you&apos;re ready to move on.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center">
          {MODULES.map((mod, i) => (
            <div key={mod.name} className="flex w-full flex-col items-center">
              <div
                className={`card-elevated w-full max-w-md rounded-2xl border-2 bg-white p-6 ${mod.ring}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${mod.color} font-display text-sm font-bold text-white`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display text-lg font-bold text-ink">
                    {mod.name}
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 border-l-2 border-border pl-4">
                  {mod.concepts.map((concept) => (
                    <li
                      key={concept}
                      className="relative text-sm font-medium text-ink-muted before:absolute before:-left-[21px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-border"
                    >
                      {concept}
                    </li>
                  ))}
                </ul>
              </div>

              {i < MODULES.length - 1 && (
                <div className="my-2 flex h-10 flex-col items-center justify-center text-ink-muted/50">
                  <div className="h-full w-0.5 bg-border" />
                  <span className="-mt-1">↓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
