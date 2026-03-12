import { Navbar } from "@/components/ui/Navbar";
import { HeroSection } from "@/components/hero/HeroSection";
import { CodeEditorFlowSection } from "@/components/sections/CodeEditorFlowSection";
import { CodebaseIntelligenceSection } from "@/components/sections/CodebaseIntelligenceSection";
import { ArchitectureSection } from "@/components/sections/ArchitectureSection";
import { ControlCenterSection } from "@/components/sections/ControlCenterSection";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#030304] text-zinc-100">
      <Navbar />
      <HeroSection />
      <CodeEditorFlowSection />
      <CodebaseIntelligenceSection />
      <ArchitectureSection />
      <ControlCenterSection />
      <Footer />
    </div>
  );
}
