import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./SiteChrome.css";

export function SiteHeader({ extraActions = null, showLaunchApp = true }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="site-header-container">
        <div className="site-logo">
          <Link to="/" className="site-logo-link" onClick={closeMobileMenu}>
            <h1>Stratax</h1>
          </Link>
        </div>

        <button
          type="button"
          className={`site-hamburger ${mobileMenuOpen ? "open" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`site-mobile-panel ${mobileMenuOpen ? "open" : ""}`}>
          <nav className="site-nav-menu">
            <Link
              to="/leaderboard"
              className="site-nav-link"
              onClick={closeMobileMenu}
            >
              Leaderboard
            </Link>
            <Link
              to="/token-sale"
              className="site-nav-link"
              onClick={closeMobileMenu}
            >
              Token Sale
            </Link>
            <Link to="/nft" className="site-nav-link" onClick={closeMobileMenu}>
              NFT Explorer
            </Link>
            <a href="/app" className="site-nav-link" onClick={closeMobileMenu}>
              Trade
            </a>
            <a
              href="/#earn"
              className="site-nav-link"
              onClick={closeMobileMenu}
            >
              Earn
            </a>
            <a
              href="https://stratax.gitbook.io/stratax-docs/"
              target="_blank"
              rel="noreferrer"
              className="site-nav-link"
              onClick={closeMobileMenu}
            >
              Docs
            </a>
            <a
              href="/#about"
              className="site-nav-link"
              onClick={closeMobileMenu}
            >
              About
            </a>
          </nav>

          <div className="site-header-actions">
            {extraActions}
            {showLaunchApp && (
              <Link
                to="/app"
                className="site-btn site-btn-primary site-btn-small"
                onClick={closeMobileMenu}
              >
                Launch App
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-content">
        <div className="site-footer-section">
          <h4>Stratax</h4>
          <p>Advanced leverage on-chain</p>
        </div>

        <div className="site-footer-section">
          <h4>Protocol</h4>
          <ul>
            <li>
              <a href="#governance">Governance</a>
            </li>
            <li>
              <a
                href="https://stratax.gitbook.io/stratax-docs/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation
              </a>
            </li>
            <li>
              <a href="#github">GitHub</a>
            </li>
          </ul>
        </div>

        <div className="site-footer-section">
          <h4>Community</h4>
          <ul>
            <li>
              <a href="#twitter">Twitter</a>
            </li>
            <li>
              <a href="#discord">Discord</a>
            </li>
            <li>
              <a href="#telegram">Telegram</a>
            </li>
          </ul>
        </div>

        <div className="site-footer-section">
          <h4>Resources</h4>
          <ul>
            <li>
              <a href="#terms">Terms</a>
            </li>
            <li>
              <a href="#privacy">Privacy</a>
            </li>
            <li>
              <a href="#audit">Audit</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>&copy; 2026 Stratax. All rights reserved.</p>
      </div>
    </footer>
  );
}
