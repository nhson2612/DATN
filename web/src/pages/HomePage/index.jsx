import { useState } from "react";
import Footer from "../../components/layout/Footer";
import HeroSearch from "./HeroSearch";
import HomeSections from "./HomeSections";
import "./Home.css";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("tour");

  return (
    <div className="wanderlust-home">
      <HeroSearch activeTab={activeTab} setActiveTab={setActiveTab} />
      <HomeSections activeTab={activeTab} />
      <Footer />
    </div>
  );
}
