import Hero from "@/components/Hero";
import PhysicsJourney from "@/components/PhysicsJourney";
import AIDashboardCard from "@/components/AIDashboardCard";

export default function Dashboard() {
  return (
    <>
      <Hero />
      <PhysicsJourney />
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <AIDashboardCard />
        </div>
      </section>
    </>
  );
}
