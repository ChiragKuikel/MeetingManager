import FAQ from "@/components/faq";
import Features from "@/components/features";
import Footer from "@/components/footer";
import HeroSection from "@/components/hero-section";
import HowItWorks from "@/components/howitworks";
import Pricing from "@/components/pricing";
import Testimonials from "@/components/testimonials";
export default function Home() {
  return (
    <div>
      <HeroSection />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <Footer />

    </div>
  );
}
