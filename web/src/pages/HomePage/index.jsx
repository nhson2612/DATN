import React from "react";
import HeroSection from "./components/HeroSection/HeroSection";
import ExploreToursSection from "./components/ExploreToursSection/ExploreToursSection";
import CustomItinerarySection from "./components/CustomItinerarySection/CustomItinerarySection";
import Footer from "./components/Footer/Footer";
import "./Home.css";

export default function HomePage() {
  return (
    <div className="wanderlust-home snap-container antialiased selection:bg-orange-500 selection:text-white">
      <HeroSection />
      <ExploreToursSection />
      <CustomItinerarySection />
      <Footer />
    </div>
  );
}
