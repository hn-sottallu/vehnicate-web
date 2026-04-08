import { useState, useRef } from "react";

const styles = `
  :root {
    --black: #000;
    --white: #fff;
    --off-white: #f5f0e8;
    --paper: #faf8f2;
    --paper-dark: #f0ead8;
    --ink: #1a1a1a;
    --ink-light: #555;
    --purple: #a855f7;
    --pink: #ec4899;
    --grad: linear-gradient(135deg, #a855f7, #ec4899);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  #opsin-guide {
    background: #000 url('/vehnicate_wallpaper.png') center/cover no-repeat;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'DM Mono', monospace;
    padding: 40px 20px;
    position: relative;
    overflow: hidden;
  }

  #opsin-guide::before {
    content: "";
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 30% 20%, rgba(168,85,247,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 75% 80%, rgba(236,72,153,0.05) 0%, transparent 55%);
    pointer-events: none;
  }

  .book-scene {
    perspective: 2000px;
    width: 100%;
    max-width: 780px;
    position: relative;
    z-index: 1;
  }

  .cover-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
  }

  .cover-book {
    width: 320px;
    background: var(--white);
    border-radius: 4px 16px 16px 4px;
    padding: 48px 40px;
    box-shadow:
      -6px 0 0 #e0e0e0,
      -8px 0 0 #ccc,
      -10px 0 0 #bbb,
      0 24px 80px rgba(0,0,0,0.7),
      0 8px 24px rgba(0,0,0,0.5);
    position: relative;
  }

  .cover-book::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 16px;
    background: linear-gradient(to right, #ccc, #e8e8e8);
    border-radius: 4px 0 0 4px;
  }

  .cover-eyebrow {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: none;
    color: #999;
    margin-bottom: 28px;
    padding-left: 2px;
  }

  .cover-logo {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
  }

  .cover-title {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    color: #111;
    margin-bottom: 12px;
  }

  .cover-subtitle {
    font-family: 'Crimson Pro', serif;
    font-size: 14px;
    font-style: italic;
    color: #888;
    line-height: 1.6;
    margin-bottom: 36px;
  }

  .cover-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #ccc, transparent);
    margin: 24px 0;
  }

  .cover-publisher {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: none;
    color: #bbb;
    text-align: center;
  }

  .book-spread {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--paper);
    border-radius: 4px 16px 16px 4px;
    box-shadow:
      -6px 0 0 #e0e0e0,
      -8px 0 0 #ccc,
      0 24px 80px rgba(0,0,0,0.7),
      0 8px 24px rgba(0,0,0,0.4);
    min-height: 520px;
    overflow: hidden;
    animation: bookOpen 0.5s ease forwards;
  }

  @keyframes bookOpen {
    from { transform: rotateY(-8deg) scale(0.97); opacity: 0.7; }
    to   { transform: rotateY(0deg) scale(1); opacity: 1; }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }
  .book-spread.flipping-right { animation: flipRight 0.4s ease forwards; }
  .book-spread.flipping-left  { animation: flipLeft  0.4s ease forwards; }

  @keyframes flipRight {
    0%  { transform: rotateY(0deg); }
    50% { transform: rotateY(-6deg) scaleX(0.97); }
    100%{ transform: rotateY(0deg); }
  }
  @keyframes flipLeft {
    0%  { transform: rotateY(0deg); }
    50% { transform: rotateY(6deg) scaleX(0.97); }
    100%{ transform: rotateY(0deg); }
  }

  .page-left {
    padding: 40px 32px 40px 40px;
    border-right: 1px solid rgba(0,0,0,0.08);
    box-shadow: inset -8px 0 16px rgba(0,0,0,0.06);
    position: relative;
    background: var(--paper);
  }
  .page-right {
    padding: 40px 40px 40px 32px;
    box-shadow: inset 8px 0 16px rgba(0,0,0,0.04);
    position: relative;
    background: var(--paper-dark);
  }

  .page-chapter {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #999;
    margin-bottom: 16px;
  }

  .page-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    color: #111;
    line-height: 1.3;
    margin-bottom: 20px;
  }

  .page-body {
    font-family: 'Crimson Pro', serif;
    font-size: 15px;
    color: #333;
    line-height: 1.8;
    margin-bottom: 16px;
  }
  .page-body strong { font-weight: 600; color: #111; }

  .page-divider {
    height: 1px;
    background: linear-gradient(to right, rgba(0,0,0,0.1), transparent);
    margin: 20px 0;
  }

  .install-option {
    background: #fff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
    text-decoration: none;
    display: block;
  }
  .install-option:hover {
    border-color: rgba(168,85,247,0.4);
    box-shadow: 0 2px 12px rgba(168,85,247,0.1);
  }
  .install-option-title {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: #111;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .install-option-title .badge {
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 99px;
    background: #000;
    color: #fff;
  }
  .install-option-body {
    font-family: 'Crimson Pro', serif;
    font-size: 13px;
    color: #666;
    line-height: 1.6;
  }

  .waitlist-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
  .waitlist-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 8px;
    background: #fff;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #111;
    outline: none;
    transition: border-color 0.2s;
  }
  .waitlist-input::placeholder { color: #aaa; }
  .waitlist-input:focus { border-color: rgba(168,85,247,0.5); }
  .waitlist-btn {
    padding: 9px 16px;
    border-radius: 8px;
    background: linear-gradient(135deg, #a855f7, #ec4899);
    border: none;
    color: #fff;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .waitlist-btn:hover { opacity: 0.85; }
  .waitlist-success {
    background: rgba(168,85,247,0.08);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'Crimson Pro', serif;
    font-size: 13px;
    color: #a855f7;
    line-height: 1.6;
  }

  .step-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid rgba(168,85,247,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #a855f7;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .step-title {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: #111;
    margin-bottom: 4px;
  }
  .step-desc {
    font-family: 'Crimson Pro', serif;
    font-size: 13px;
    color: #555;
    line-height: 1.6;
  }

  .screenshot {
    background: #1a1a2e;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 12px;
    margin: 12px 0;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    position: relative;
    overflow: hidden;
  }
  .screenshot::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 28px;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .screenshot-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin-top: 18px;
    width: 100%;
  }
  .screenshot-caption {
    font-family: 'Crimson Pro', serif;
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    font-style: italic;
    text-align: center;
    margin-top: 4px;
  }
  .mock-field {
    width: 100%;
    background: rgba(255,255,255,0.07);
    border-radius: 6px;
    padding: 8px 12px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.35);
  }
  .mock-btn {
    width: 100%;
    background: linear-gradient(135deg, rgba(168,85,247,0.7), rgba(236,72,153,0.7));
    border-radius: 6px;
    padding: 8px 12px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #fff;
    text-align: center;
  }

  .results-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 99px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    margin: 2px;
    white-space: nowrap;
  }
  .results-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .book-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 24px;
    width: 100%;
  }
  .book-nav-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 40px;
    padding: 10px 20px;
    color: rgba(255,255,255,0.6);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .book-nav-btn:hover {
    border-color: rgba(168,85,247,0.5);
    color: white;
  }
  .book-nav-btn:disabled { opacity: 0.2; cursor: not-allowed; }
  .book-page-indicator {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 1px;
  }
  .page-num {
    position: absolute;
    bottom: 18px;
    font-family: 'Crimson Pro', serif;
    font-size: 11px;
    color: #bbb;
    font-style: italic;
  }
  .page-left .page-num { right: 32px; }
  .page-right .page-num { left: 32px; }

  @media (max-width: 600px) {
    .book-spread { grid-template-columns: 1fr; }
    .page-left { border-right: none; border-bottom: 1px solid rgba(0,0,0,0.08); }
    .cover-book { width: 280px; }
  }
`;

function WaitlistPage() {
  return (
    <>
      <p className="page-body">
        Prefer to wait for the official Play Store release? Drop your details below and we'll notify you the moment it's live.
      </p>
      <iframe
        src="https://tally.so/embed/b5rbJe?alignLeft=1&hideTitle=1&transparentBackground=1"
        width="100%"
        height="220"
        frameBorder="0"
        style={{ borderRadius: 8, marginTop: 8 }}
        title="Waitlist"
      />
    </>
  );
}

const PAGES = [
  {
    left: {
      chapter: "Chapter 01",
      title: "Installing the application",
      content: (
        <>
          <p className="page-body">
            Opsin is <strong>not yet available on the Play Store.</strong> We're currently in an invite-only phase, collecting road data across select cities before the public launch.
          </p>
          <p className="page-body">In the meantime, you have two options to get started.</p>
          <div className="page-divider" />
          <div className="install-option">
            <div className="install-option-title">↓ Install the APK directly <span className="badge">available now</span></div>
            <div className="install-option-body">Download and sideload the APK on your Android device. Works on Android 8.0 and above.</div>
          </div>
          <a className="install-option" href="/hn-Opsin.apk" download style={{ color: "inherit" }}>
            <div className="install-option-title" style={{ color: "#a855f7" }}>→ Download hn-Opsin.apk</div>
            <div className="install-option-body">Tap to download. Then open the file and allow installation from unknown sources when prompted.</div>
          </a>
        </>
      ),
    },
    right: {
      chapter: "Chapter 01 · continued",
      title: "Join the waitlist",
      content: <WaitlistPage />,
    },
  },
  {
    left: {
      chapter: "Chapter 02",
      title: "Signing up",
      content: (
        <>
          <p className="page-body">When you first launch Opsin, tap <strong>Create account</strong> and fill in your details.</p>
          <div className="screenshot">
            <img src="/signup_screen.jpeg" alt="Signup screen" style={{ width: "100%", height: 200, borderRadius: 8, objectFit: "cover" }} />
          </div>
          
        </>
      ),
    },
    right: {
      chapter: "Chapter 02 · continued",
      title: "Adding a vehicle",
      content: (
        <>
          <p className="page-body">After signup, register the vehicle you'll be scanning with.</p>
          <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
            <img src="/garage.jpeg" alt="Garage" style={{ width: "50%", height: 200, borderRadius: 8, objectFit: "cover" }} />
            <img src="/add_vehicle.jpeg" alt="Add vehicle" style={{ width: "50%", height: 200, borderRadius: 8, objectFit: "cover" }} />
          </div>
          <p className="page-body" style={{ fontSize: 13 }}>
            You can register multiple vehicles and switch between them before starting any trip.
          </p>
        </>
      ),
    },
  },
  {
    left: {
      chapter: "Chapter 03",
      title: "Starting a drive",
      content: (
        <>
          <p className="page-body">From the home screen, select your vehicle and tap <strong>Start trip</strong>.</p>
          <div className="page-divider" />
          <div className="screenshot">
            <img src="/App_home.jpeg" alt="App home" style={{ width: "100%", height: 200, borderRadius: 8, objectFit: "cover" }} />
          </div>
          {[
            ["1", "Mount your phone", "Use a windshield or dashboard mount incase of car and a traditional handlbar phone stand incase of bike. The phone must be fixed to the vehicle — not held."],
            ["2", "Orient it correctly", "Place the phone horizontally with the screen facing you and the camera should be at the bottom-right corner."],
            ["3", "Drive normally", "The app detects bumps and potholes automatically."],
          ].map(([n, t, d]) => (
            <div key={n} className="step-row">
              <div className="step-num">{n}</div>
              <div>
                <div className="step-title">{t}</div>
                <div className="step-desc">{d}</div>
              </div>
            </div>
          ))}
        </>
      ),
    },
    right: {
      chapter: "Chapter 03 · continued",
      title: "During the drive",
      content: (
        <>
          <p className="page-body">Opsin senses autonomously - you need not touch it.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" }}>
            <img src="/dataCollection_screen.jpeg" alt="Data collection screen" style={{ width: "100%", height: 150, borderRadius: 8, objectFit: "cover" }} />
            <img src="/appOnMount.png" alt="App on mount" style={{ width: "100%", height: 150, borderRadius: 8, objectFit: "cover" }} />
          </div>
          <p className="page-body" style={{ fontSize: 13 }}>
            Tap <strong>End trip</strong> when done. Events upload automatically when connectivity is available.
          </p>
        </>
      ),
    },
  },
  {
    left: {
      chapter: "Chapter 04",
      title: "Seeing your results",
      content: (
        <>
          <p className="page-body">Head to <strong>Road-Scout</strong> — our web dashboard — to see everything your drive captured, visualised on the map.</p>
          <div className="page-divider" />
          <p className="page-body" style={{ fontSize: 13 }}>Each segment is colour-coded by severity:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 0" }}>
            {[
              { c: "rgb(0,220,0)",   bg: "rgba(0,200,0,0.1)",   b: "rgba(0,180,0,0.3)",   l: "Low  (0.0–0.3)" },
              { c: "rgb(255,140,0)", bg: "rgba(255,140,0,0.1)", b: "rgba(255,140,0,0.3)", l: "Medium  (0.3–0.5)" },
              { c: "rgb(255,50,0)",  bg: "rgba(255,50,0,0.1)",  b: "rgba(255,50,0,0.3)",  l: "High  (0.5–1.0)" },
            ].map(r => (
              <div key={r.l} className="results-chip" style={{ background: r.bg, border: `1px solid ${r.b}`, color: r.c }}>
                <div className="results-dot" style={{ background: r.c }} />
                {r.l}
              </div>
            ))}
          </div>
          <p className="page-body" style={{ fontSize: 13 }}>Tap any segment to see the photos Opsin captured at that location.</p>
        </>
      ),
    },
    right: {
      chapter: "Chapter 04 · continued",
      title: "Staying up to date",
      content: (
        <>
          <p className="page-body">The Road-Scout map updates in real time. Hit <strong>↻</strong> to pull fresh events without refreshing the page.</p>
          <div className="page-divider" />
          {[
            ["✓", "Pan and zoom freely", "Events load as you explore. Zoom in to see individual road segments."],
            ["✓", "Search any location", "Use the search bar to jump to any city or address."],
            ["✓", "More drives = better data", "Every trip you complete improves the resolution of the map for your city."],
          ].map(([n, t, d]) => (
            <div key={t} className="step-row">
              <div className="step-num">{n}</div>
              <div>
                <div className="step-title">{t}</div>
                <div className="step-desc">{d}</div>
              </div>
            </div>
          ))}
          <div className="page-divider" />
          <p className="page-body" style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>
            That's everything. Happy driving and thank you for mapping the roads.
          </p>
          <p style={{ fontFamily: "DM Mono", fontSize: 9, letterSpacing: 2, color: "#bbb", marginTop: 12, textTransform: "uppercase" }}>
            vehnicate · road-scout platform
          </p>
        </>
      ),
    },
  },
];

export default function HNOpsinGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [flipping, setFlipping] = useState(null);

  const flip = (dir) => {
    if (flipping) return;
    setFlipping(dir);
    setTimeout(() => {
      setPageIdx(i => i + (dir === "right" ? 1 : -1));
      setFlipping(null);
    }, 380);
  };

  const current = PAGES[pageIdx];

  return (
    <>
      <style>{styles}</style>
      <div id="opsin-guide">
        {!isOpen ? (
          <div className="book-scene">
            <div className="cover-wrap" style={{ position: "relative", alignItems: "center" }}>
              {/* Steering wheel above the book */}
              <svg width="48" height="48" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="36" cy="36" r="30" stroke="white" strokeWidth="2" fill="none" />
                <circle cx="36" cy="36" r="10" stroke="white" strokeWidth="2" fill="none" />
                <line x1="36" y1="26" x2="36" y2="6" stroke="white" strokeWidth="2" />
                <line x1="27.5" y1="29.5" x2="10" y2="52" stroke="white" strokeWidth="2" />
                <line x1="44.5" y1="29.5" x2="62" y2="52" stroke="white" strokeWidth="2" />
              </svg>

              {/* Book + right arrow side by side */}
              <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                <div className="cover-book">
                  <div className="cover-eyebrow">vehnicate · opsin app</div>
                  <div className="cover-logo">
                    <img src="/hn-logo.png" alt="vehnicate" style={{ width: 32, height: 32, objectFit: "contain" }} />
                  </div>
                  <h1 className="cover-title">User Manual to vehnicate's Mobile App</h1>
                  <p className="cover-subtitle">Opsin: feel the roads!</p>
                  <div className="cover-divider" />
                  <p className="cover-publisher">vehnicate · version 1.0</p>
                </div>

                {/* Blinking arrow */}
                <div
                  onClick={() => setIsOpen(true)}
                  style={{ cursor: "pointer", animation: "blink 1.1s ease-in-out infinite" }}
                >
                  <svg width="40" height="60" viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4 L36 30 L8 56" stroke="#f5a623" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="book-scene">
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
              {/* Left button */}
              <button className="book-nav-btn" disabled={!!flipping}
                onClick={() => pageIdx === 0 ? setIsOpen(false) : flip("left")}
                style={{ flexShrink: 0 }}>
                ←
              </button>

              {/* Book spread */}
              <div className={`book-spread${flipping ? ` flipping-${flipping}` : ""}`}
                style={{ flex: 1 }}>
                <div className="page-left">
                  <div className="page-chapter">{current.left.chapter}</div>
                  <h2 className="page-title">{current.left.title}</h2>
                  {current.left.content}
                  <span className="page-num">{pageIdx * 2 + 1}</span>
                </div>
                <div className="page-right">
                  <div className="page-chapter">{current.right.chapter}</div>
                  <h2 className="page-title">{current.right.title}</h2>
                  {current.right.content}
                  <span className="page-num">{pageIdx * 2 + 2}</span>
                </div>
              </div>

              {/* Right button */}
              <button className="book-nav-btn"
                disabled={!!flipping || pageIdx >= PAGES.length - 1}
                onClick={() => flip("right")}
                style={{ flexShrink: 0 }}>
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}