import React, { useState } from "react";
import "./WaitlistPage.css";

const WAITLIST_FORM_ENDPOINT = process.env.REACT_APP_WAITLIST_FORM_ENDPOINT;
const DISCORD_URL = process.env.REACT_APP_DISCORD_URL || "https://discord.gg";
const TWITTER_URL =
  process.env.REACT_APP_TWITTER_URL || "https://x.com/strataxfi";
const DOCS_URL =
  process.env.REACT_APP_DOCS_URL || "https://stratax.gitbook.io/stratax-docs/";
const FAQ_ITEMS = [
  {
    question: "How do I get early access?",
    answer:
      "Join our Discord first. We announce access waves there before email updates.",
  },
  {
    question: "Do I still need to submit my email?",
    answer:
      "Email is optional. It helps us send product and launch updates if you prefer inbox notifications.",
  },
  {
    question: "Which networks are planned for launch?",
    answer:
      "Stratax is focused on EVM networks. Follow the Docs and Discord announcements for final launch coverage.",
  },
  {
    question: "Is there a token or airdrop right now?",
    answer:
      "There is no official airdrop announcement at this time. Always verify updates through our official links.",
  },
];

function WaitlistPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveLocalFallback = () => {
    const current = JSON.parse(localStorage.getItem("strataxWaitlist") || "[]");
    current.push({
      ...formData,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("strataxWaitlist", JSON.stringify(current));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      if (WAITLIST_FORM_ENDPOINT) {
        const response = await fetch(WAITLIST_FORM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error("Form submission failed");
        }
      } else {
        // Local fallback keeps signups available until a backend endpoint is configured.
        saveLocalFallback();
      }

      setStatus("success");
      setMessage("Thanks. You are on the waitlist and we will reach out soon.");
      setFormData({ name: "", email: "" });
    } catch (error) {
      console.error("Waitlist submit error:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again in a moment.");
    }
  };

  return (
    <div className="waitlist-page">
      <div className="waitlist-overlay" />
      <main className="waitlist-content">
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

        <p className="waitlist-form-note">Prefer email updates instead?</p>

        <form className="waitlist-form" onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Submitting..." : "Get Early Access"}
          </button>
        </form>

        {message && (
          <p
            className={`waitlist-message ${status === "success" ? "ok" : "error"}`}
          >
            {message}
          </p>
        )}

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
