import React from "react";
import Navbar from "./components/Navbar/Navbar";
import HeroSection from "./components/HeroSection/HeroSection";
import ExploreToursSection from "./components/ExploreToursSection/ExploreToursSection";
import CustomItinerarySection from "./components/CustomItinerarySection/CustomItinerarySection";
import Footer from "./components/Footer/Footer";
import "./Home.css";

export default function HomePage({ user, onNeedAuth, onLogout }) {
  return (
    <div className="wanderlust-home snap-container antialiased selection:bg-orange-500 selection:text-white">
      <Navbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
      <HeroSection />
      <ExploreToursSection />
      <CustomItinerarySection />
      <Footer />
    </div>
  );
}
