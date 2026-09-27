const FLOW = [
  { label: "Player Performance", color: "bg-blue" },
  { label: "Concept Mastery", color: "bg-cyan" },
  { label: "Adaptive Engine", color: "bg-purple" },
  { label: "Next Challenge", color: "bg-gold-dark" },
  { label: "Personalized Learning", color: "bg-green" },
];

export default function AdaptiveFlow() {
  return (
    <section className="bg-surface-lavender px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Adaptive Engine
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            How NEXUS adapts
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-ink-muted">
            NEXUS observes accuracy, success, and response performance on
            every attempt, then adapts difficulty, challenge parameters, and
            which concept comes next — a deterministic adaptive learning
            engine, not a fixed lesson plan, and not machine learning.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
          {FLOW.map((step, i) => (
            <div key={step.label} className="flex flex-1 items-center gap-3">
              <div
                className={`flex-1 rounded-xl ${step.color} px-4 py-4 text-center text-sm font-bold text-white shadow-sm`}
              >
                {step.label}
              </div>
              {i < FLOW.length - 1 && (
                <span className="hidden text-xl font-bold text-ink-muted/50 md:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-ink">
              What NEXUS measures
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>• Accuracy — how close your result landed to the target</li>
              <li>• Success — whether the attempt met the challenge&apos;s tolerance</li>
              <li>• Response performance — how quickly you responded</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-ink">
              What NEXUS adapts
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li>• Difficulty — target values, tolerance, and complexity</li>
              <li>• Concept reinforcement — repeat practice when you struggle</li>
              <li>• Concept &amp; module progression — new material once you&apos;re ready</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border-2 border-dashed border-purple/25 bg-white/70 p-6">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            AI Learning Insight
          </span>
          <p className="mt-2 text-sm text-ink-muted">
            After every attempt, the adaptive engine&apos;s structured record
            — module, concept, target, actual result, performance, and
            mastery before/after — is handed to a server-side insight
            service that explains <em>why</em> you performed the way you
            did, in plain language. It never decides what challenge comes
            next; that stays the adaptive engine&apos;s job. Try it on the{" "}
            <a href="/play" className="font-semibold text-purple underline">
              Play
            </a>{" "}
            page.
          </p>
        </div>
      </div>
    </section>
  );
}
