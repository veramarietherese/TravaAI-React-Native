import {
    ArrowRight,
    Brain,
    Briefcase,
    CalendarDays,
    Coins,
    Heart,
    Sparkles,
    Users,
  } from "lucide-react"
  
  export default function SmartMatchScreen({ onStartChat }) {
    return (
      <div className="scroll-area smartmatch-screen">
        <section className="smartmatch-hero">
          <div className="smartmatch-glow" />
  
          <span className="smartmatch-badge">
            <Sparkles size={14} />
            AI Travel Concierge
          </span>
  
          <h1>
            Find your perfect trip in
            <br />
            under 60 seconds.
          </h1>
  
          <p>
            Tell us your budget, travel style and dream destinations.
            We'll match you with destinations, itineraries and verified agencies.
          </p>
  
          <button type="button" onClick={onStartChat}>
            Start Smart Match
            <ArrowRight size={18} />
          </button>
        </section>
  
        <section className="smartmatch-preview">
          <div className="smartmatch-section-title">
            <span>HOW IT WORKS</span>
            <h2>Answer 3 Questions</h2>
          </div>
  
          <div className="question-cards">
            <article>
              <Coins size={20} />
              <h3>Budget</h3>
              <p>How much are you planning to spend?</p>
            </article>
  
            <article>
              <Heart size={20} />
              <h3>Travel Style</h3>
              <p>Luxury, family, adventure, foodie, romantic.</p>
            </article>
  
            <article>
              <Users size={20} />
              <h3>Travel Group</h3>
              <p>Solo, friends, family or couple getaway.</p>
            </article>
          </div>
        </section>
  
        <section className="ai-result-card">
          <div className="ai-result-header">
            <Brain size={24} />
            <div>
              <span>Example Match</span>
              <h3>Japan Spring Escape</h3>
            </div>
          </div>
  
          <div className="match-score">
            <strong>96%</strong>
            <span>Match Score</span>
          </div>
  
          <div className="match-tags">
            <span>🌸 Cherry Blossom</span>
            <span>👨‍👩‍👧 Family Friendly</span>
            <span>💰 Within Budget</span>
          </div>
  
          <div className="match-details">
            <div>
              <CalendarDays size={16} />
              <span>8 Days</span>
            </div>
  
            <div>
              <Coins size={16} />
              <span>₱78,000 Budget</span>
            </div>
  
            <div>
              <Briefcase size={16} />
              <span>Agency Assisted</span>
            </div>
          </div>
        </section>
  
        <section className="agency-match-card">
          <div>
            <span>VERIFIED AGENCY</span>
            <h2>Sakura Travels</h2>
            <p>
              Specializes in Japan tours, visa assistance,
              cherry blossom routes and family packages.
            </p>
          </div>
  
          <div className="agency-score">
            <strong>96%</strong>
            <span>Agency Match</span>
          </div>
        </section>
      </div>
    )
  }