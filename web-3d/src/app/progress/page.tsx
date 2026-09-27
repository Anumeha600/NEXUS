import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdaptiveFlow from "@/components/AdaptiveFlow";
import TechStack from "@/components/TechStack";

export default function ProgressPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="bg-surface-blue px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold tracking-[0.2em] text-blue-dark uppercase">
              Progress
            </span>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Your mastery lives in the game
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-ink-muted">
              NEXUS doesn&apos;t yet have persistent accounts, so this site
              can&apos;t show your personal mastery history — that would be
              fabricated data. Every concept&apos;s mastery is tracked live,
              in real time, inside the game itself while you play. What this
              page <em>can</em> show honestly is how that tracking works.
            </p>
          </div>
        </section>

        <AdaptiveFlow />
        <TechStack />
      </main>
      <Footer />
    </>
  );
}
