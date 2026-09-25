import { AboutSection } from "@/components/home/AboutSection";
import { CalculatorSection } from "@/components/home/CalculatorSection";
import { DiscoverySection } from "@/components/home/DiscoverySection";
import { DriveChapter } from "@/components/home/DriveChapter";
import { FaqSection } from "@/components/home/FaqSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { HeroScene } from "@/components/home/HeroScene";
import { HomeStage } from "@/components/home/HomeStage";
import { ImportJourney } from "@/components/home/ImportJourney";
import { KnowChapter } from "@/components/home/KnowChapter";
import { ServiceSection } from "@/components/home/ServiceSection";
import { SourcingSection } from "@/components/home/SourcingSection";
import { TestimonialSection } from "@/components/home/TestimonialSection";
import { TrustSection } from "@/components/home/TrustSection";
import { VerifyChapter } from "@/components/home/VerifyChapter";
import { WorldMap } from "@/components/home/WorldMap";
import { repositories } from "@/lib/repositories";

/**
 * The homepage is one continuous story:
 *   desire → discovery → global search → verification → import
 *   → arrival → ownership
 * 3D chapters (data-chapter) play over a single fixed WebGL stage; the
 * opaque "plates" between them are where the practical tools live.
 */
export default async function Home() {
  const { vehicles, content } = repositories;
  const [featured, all, markets, steps, services, testimonials] = await Promise.all([
    vehicles.featured(6),
    vehicles.list(),
    content.markets(),
    content.journey(),
    content.services(),
    content.testimonials(),
  ]);
  const counts = all.reduce<Record<string, number>>((acc, v) => {
    if (v.status === "available") acc[v.location.countryCode] = (acc[v.location.countryCode] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <HomeStage />
      <HeroScene />
      <KnowChapter />
      <DiscoverySection vehicles={featured} />
      <WorldMap markets={markets} counts={counts} />
      <VerifyChapter />
      <TrustSection />
      <ImportJourney steps={steps} services={services} />
      <ServiceSection services={services} steps={steps} />
      <CalculatorSection />
      <DriveChapter />
      <AboutSection />
      {/* Client stories appear only once real, approved ones exist. */}
      {testimonials.some((t) => !t.isSample) && <TestimonialSection items={testimonials.filter((t) => !t.isSample)} />}
      <FaqSection />
      <SourcingSection />
      <FinalCTA />
    </>
  );
}
