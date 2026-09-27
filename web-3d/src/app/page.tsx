import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PhysicsJourney from "@/components/PhysicsJourney";
import AIDashboardCard from "@/components/AIDashboardCard";
import Footer from "@/components/Footer";

export default function Dashboard() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <PhysicsJourney />
        <section className="bg-bg px-6 pb-20">
          <div className="mx-auto max-w-3xl">
            <AIDashboardCard />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
