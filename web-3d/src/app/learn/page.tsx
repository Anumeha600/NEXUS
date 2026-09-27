import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CurriculumMap from "@/components/CurriculumMap";

export default function LearnPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <CurriculumMap />
      </main>
      <Footer />
    </>
  );
}
