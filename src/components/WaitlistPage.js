import React, { useMemo, useState } from "react";
import "./WaitlistPage.css";

const DISCORD_URL =
  process.env.REACT_APP_DISCORD_URL || "https://discord.gg/ekdnKGKGnq";
const TWITTER_URL =
  process.env.REACT_APP_TWITTER_URL || "https://x.com/stratax_trade";
const DOCS_URL =
  process.env.REACT_APP_DOCS_URL || "https://stratax.gitbook.io/stratax-docs/";
const FAQ_ITEMS = [
  {
    question: "How do I get early access?",
    answer: "Join our Discord to stay updated on early access opportunities.",
  },
  {
    question: "Which networks are planned for launch?",
    answer:
      "Stratax is focused on EVM networks. Follow the Docs and Discord announcements for final launch coverage.",
  },
  {
    question: "Is there a token sale or airdrop right now?",
    answer: "Token sale is in the works",
  },
];

const TOKENOMICS_ALLOCATIONS = [
  {
    id: "public-ico",
    label: "Public ICO",
    percent: 20,
    tokens: "20,000,000",
    color: "#56a4ff",
    description:
      "25% unlocked at TGE; remaining 75% unlocks linearly over 9 months.",
  },
  {
    id: "strategic-private",
    label: "Strategic/Private",
    percent: 12,
    tokens: "12,000,000",
    color: "#35ddb7",
    description:
      "10% unlocked at TGE, then 3-month cliff and linear vesting over 18 months.",
  },
  {
    id: "team",
    label: "Team",
    percent: 15,
    tokens: "15,000,000",
    color: "#ffcc66",
    description:
      "0% at TGE with a 12-month cliff, followed by linear vesting over 36 months.",
  },
  {
    id: "advisors",
    label: "Advisors",
    percent: 3,
    tokens: "3,000,000",
    color: "#c48dff",
    description:
      "0% at TGE with a 6-month cliff, then linear vesting over 24 months.",
  },
  {
    id: "ecosystem-incentives",
    label: "Ecosystem Incentives",
    percent: 22,
    tokens: "22,000,000",
    color: "#ff8f9d",
    description:
      "10% at TGE, with emissions distributed over 60 months to support protocol growth.",
  },
  {
    id: "treasury-dao-reserve",
    label: "Treasury/DAO Reserve",
    percent: 20,
    tokens: "20,000,000",
    color: "#93f089",
    description:
      "0% at TGE, 6-month lock, then linear vesting over 48 months under DAO control.",
  },
  {
    id: "liquidity-market-making",
    label: "Liquidity & Market Making",
    percent: 8,
    tokens: "8,000,000",
    color: "#ffd166",
    description:
      "50% unlocked at TGE, with the remaining 50% vesting linearly over 12 months.",
  },
];

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function WaitlistPage() {
  const [selectedTokenomicsId, setSelectedTokenomicsId] = useState(
    TOKENOMICS_ALLOCATIONS[0].id,
  );

  const tokenomicsSlices = useMemo(() => {
    let startAngle = 0;
    return TOKENOMICS_ALLOCATIONS.map((item) => {
      const sweep = (item.percent / 100) * 360;
      const endAngle = startAngle + sweep;
      const path = describeArc(110, 110, 90, startAngle, endAngle);
      const midAngle = startAngle + sweep / 2;
      const labelPos = polarToCartesian(110, 110, 60, midAngle);

      const slice = {
        ...item,
        path,
        labelX: labelPos.x,
        labelY: labelPos.y,
      };

      startAngle = endAngle;
      return slice;
    });
  }, []);

  const selectedTokenomics = useMemo(
    () =>
      TOKENOMICS_ALLOCATIONS.find((item) => item.id === selectedTokenomicsId) ||
      TOKENOMICS_ALLOCATIONS[0],
    [selectedTokenomicsId],
  );

  return (
    <div className="waitlist-page">
      <div className="waitlist-overlay" />
      <main className="waitlist-content">
        <div className="waitlist-main-column">
          <img
            className="waitlist-logo"
            src="/logo-no-text-no-background.png"
            alt="Stratax logo"
          />
          <h1 className="waitlist-brand">Stratax</h1>
          <p className="waitlist-brand-subtext">
            leveraged trading powered by Aave and 1inch
          </p>
          <p className="waitlist-kicker">Stratax Early Access</p>
          <h2 className="waitlist-title">Join the Waitlist</h2>
          <p className="waitlist-subtitle">
            We are onboarding users in controlled waves. Join our Discord for
            priority updates and instant access announcements.
          </p>

          <a
            className="waitlist-discord-cta"
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join via Discord
          </a>

          <div className="waitlist-links" aria-label="Stratax links">
            <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer">
              Twitter
            </a>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
              Docs
            </a>
          </div>
        </div>

        <section className="waitlist-tokenomics" aria-label="STRX tokenomics">
          <h3>STRX Tokenomics</h3>
          <p className="waitlist-tokenomics-subtitle">
            Fixed supply: 100,000,000 STRX
          </p>

          <div className="waitlist-tokenomics-chart-wrap">
            <svg
              className="waitlist-tokenomics-chart"
              viewBox="0 0 220 220"
              role="img"
              aria-label="STRX token allocation pie chart"
            >
              {tokenomicsSlices.map((slice) => {
                const isActive = selectedTokenomicsId === slice.id;
                return (
                  <g key={slice.id}>
                    <path
                      d={slice.path}
                      fill={slice.color}
                      className={`waitlist-tokenomics-slice ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedTokenomicsId(slice.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slice.label} ${slice.percent}%`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTokenomicsId(slice.id);
                        }
                      }}
                    />
                    <text
                      x={slice.labelX}
                      y={slice.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="waitlist-tokenomics-slice-label"
                    >
                      {slice.percent}%
                    </text>
                  </g>
                );
              })}
              <circle
                cx="110"
                cy="110"
                r="40"
                className="waitlist-tokenomics-hole"
              />
              <text
                x="110"
                y="102"
                textAnchor="middle"
                className="waitlist-tokenomics-center-title"
              >
                STRX
              </text>
              <text
                x="110"
                y="122"
                textAnchor="middle"
                className="waitlist-tokenomics-center-value"
              >
                100%
              </text>
            </svg>
          </div>

          <div className="waitlist-tokenomics-legend" role="list">
            {TOKENOMICS_ALLOCATIONS.map((item) => {
              const isActive = selectedTokenomicsId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`waitlist-tokenomics-legend-item ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedTokenomicsId(item.id)}
                >
                  <span
                    className="waitlist-tokenomics-legend-swatch"
                    style={{ background: item.color }}
                  />
                  <span className="waitlist-tokenomics-legend-label">
                    {item.label}
                  </span>
                  <strong>{item.percent}%</strong>
                </button>
              );
            })}
          </div>

          <p className="waitlist-tokenomics-details">
            <strong>
              {selectedTokenomics.label} ({selectedTokenomics.percent}% ·{" "}
              {selectedTokenomics.tokens} STRX)
            </strong>{" "}
            {selectedTokenomics.description}
          </p>
        </section>

        <section
          className="waitlist-faq"
          aria-label="Frequently asked questions"
        >
          <h3>FAQ</h3>
          {FAQ_ITEMS.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      </main>
    </div>
  );
}

export default WaitlistPage;
