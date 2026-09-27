import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InsightsView from "@/components/InsightsView";

export default function InsightsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg px-6 py-16">
        <div className="mx-auto mb-10 max-w-4xl text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">Nexus AI</span>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">Learning Insights</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            Generated from real attempts in this browser session — never
            invented. The adaptive engine still decides everything about
            difficulty and progression; this page only explains it.
          </p>
        </div>
        <InsightsView />
      </main>
      <Footer />
    </>
  );
}
