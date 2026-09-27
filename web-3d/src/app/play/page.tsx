import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayExperience from "@/components/PlayExperience";

export default function PlayPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
              Nexus / Play
            </span>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Step into the lab
            </h1>
            <p className="mt-2 max-w-2xl text-ink-muted">
              This is the real NEXUS game, running in your browser via Godot
              Web — the same adaptive engine and physics described on the{" "}
              <a href="/learn" className="font-semibold text-purple underline">
                curriculum
              </a>{" "}
              and{" "}
              <a href="/progress" className="font-semibold text-purple underline">
                adaptive engine
              </a>{" "}
              pages.
            </p>
          </div>

          <PlayExperience />
        </div>
      </main>
      <Footer />
    </>
  );
}
