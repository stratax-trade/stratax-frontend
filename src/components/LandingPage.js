import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import "./LandingPage.css";
import { CONTRACTS, SUPPORTED_NETWORKS } from "../config/contracts";
import { STRATAX_POSITION_NFT_ABI, FEE_COLLECTOR_ABI } from "../contracts/abi";

function LandingPage() {
  const [stats, setStats] = useState({
    activePositions: 0,
    totalVolume: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use the first supported network as default (Ethereum mainnet fork)
        const networkId = 1;
        const network = SUPPORTED_NETWORKS[networkId];

        if (!network || !CONTRACTS.STRATAX_POSITION_NFT) {
          return;
        }

        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        // Get active positions from NFT currentTokenId
        if (
          CONTRACTS.STRATAX_POSITION_NFT !== "" &&
          CONTRACTS.STRATAX_POSITION_NFT !==
            "0x0000000000000000000000000000000000000000"
        ) {
          const nftContract = new ethers.Contract(
            CONTRACTS.STRATAX_POSITION_NFT,
            STRATAX_POSITION_NFT_ABI,
            provider,
          );
          const currentTokenId = await nftContract.currentTokenId();

          // Get total trade volume from FeeCollector
          let totalVolume = 0;
          if (
            CONTRACTS.FEE_COLLECTOR &&
            CONTRACTS.FEE_COLLECTOR !==
              "0x0000000000000000000000000000000000000000"
          ) {
            const feeCollectorContract = new ethers.Contract(
              CONTRACTS.FEE_COLLECTOR,
              FEE_COLLECTOR_ABI,
              provider,
            );
            const volumeBigInt = await feeCollectorContract.totalTradeVolume();
            // Assuming volume is stored in USD with 18 decimals
            totalVolume = Number(ethers.formatUnits(volumeBigInt, 18));
          }

          setStats({
            activePositions: Number(currentTokenId),
            totalVolume: totalVolume,
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);
  return (
    <div className="landing-page">
      {/* Header Navigation */}
      <header className="landing-header">
        <div className="header-container">
          <div className="logo">
            <h1>Stratax</h1>
          </div>

          <nav className="nav-menu">
            <a href="#trade" className="nav-link">
              Trade
            </a>
            <a href="#earn" className="nav-link">
              Earn
            </a>
            <a
              href="https://stratax.gitbook.io/stratax-docs/"
              target="_blank"
              className="nav-link"
            >
              Docs
            </a>
            <a href="#about" className="nav-link">
              About
            </a>
          </nav>

          <div className="header-actions">
            <Link to="/app" className="btn btn-primary btn-small">
              Launch App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <h1 className="gradient-text">Stratax </h1>
            Advanced Leverage <span className="gradient-text">On-Chain</span>
          </h1>
          <p className="hero-subtitle">
            Create leveraged positions with DeFi's most efficient execution
            layer. Powered by Aave and 1inch.
          </p>
          <div className="hero-buttons">
            <Link to="/app" className="btn btn-primary">
              Open App
              <span className="btn-arrow">→</span>
            </Link>
            <a
              href="https://stratax.gitbook.io/stratax-docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Documentation
            </a>
          </div>

          {/* Supported Networks */}
          <div className="supported-networks">
            <p className="networks-label">Supported Networks</p>
            <div className="network-icons">
              <div className="network-badge">Ethereum</div>
              <div className="network-badge">Arbitrum</div>
              <div className="network-badge">Polygon</div>
              <div className="network-badge">Optimism</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card card-1">
            <div className="card-icon">📊</div>
            <div className="card-text">Up to 5x Leverage</div>
          </div>
          <div className="floating-card card-2">
            <div className="card-icon">⚡</div>
            <div className="card-text">Flash Loan Execution</div>
          </div>
          <div className="floating-card card-3">
            <div className="card-icon">🔒</div>
            <div className="card-text">Non-Custodial</div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-card">
            <h3 className="stat-value">{stats.activePositions}</h3>
            <p className="stat-label">Active Positions</p>
          </div>
          <div className="stat-card">
            <h3 className="stat-value">
              $
              {stats.totalVolume >= 1000000
                ? `${(stats.totalVolume / 1000000).toFixed(2)}M`
                : stats.totalVolume >= 1000
                  ? `${(stats.totalVolume / 1000).toFixed(2)}K`
                  : stats.totalVolume.toFixed(2)}
            </h3>
            <p className="stat-label">Total Volume</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Trade with Confidence</h2>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Efficient Execution</h3>
            <p>
              Leverage flash loans for capital-efficient position creation. No
              upfront capital needed beyond your collateral.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔐</div>
            <h3>Secure & Transparent</h3>
            <p>
              All positions are managed through audited smart contracts. Your
              funds never leave your control.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💎</div>
            <h3>Optimized Routing</h3>
            <p>
              Best execution prices powered by 1inch aggregation across multiple
              DEXs and liquidity sources.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Flexible Leverage</h3>
            <p>
              Choose your leverage multiplier based on your risk appetite.
              Real-time health factor monitoring.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Multi-Chain Support</h3>
            <p>
              Deploy positions across multiple EVM-compatible networks with
              unified interface.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚙️</div>
            <h3>One-Click Operations</h3>
            <p>
              Open and close complex leveraged positions with a single
              transaction. Simplified DeFi.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Connect Wallet</h3>
            <p>
              Connect your Web3 wallet. No KYC, no registration. Start trading
              instantly.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">2</div>
            <h3>Mint Position</h3>
            <p>
              Supply collateral and select your leverage. Flash loans handle the
              rest automatically.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step">
            <div className="step-number">3</div>
            <h3>Manage & Unwind</h3>
            <p>
              Monitor your position's health. Close anytime with a single
              transaction.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <h2 className="section-title">FAQ</h2>
        <div className="faq-container">
          <div className="faq-item">
            <h3>What makes Stratax efficient?</h3>
            <p>
              Stratax uses flash loans to create leveraged positions without
              requiring upfront capital. Combined with 1inch's optimal routing,
              you get the best execution prices with minimal slippage.
            </p>
          </div>

          <div className="faq-item">
            <h3>How do I get started?</h3>
            <p>
              Simply connect your Web3 wallet (MetaMask, WalletConnect, etc.),
              ensure you have some collateral tokens on a supported network, and
              start creating positions. No deposits or lengthy onboarding
              required.
            </p>
          </div>

          <div className="faq-item">
            <h3>What are the risks?</h3>
            <p>
              Leveraged positions carry liquidation risk if the health factor
              drops below the threshold. Always monitor your position and be
              aware of market volatility. Smart contract risk also exists,
              though our contracts are audited.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I integrate Stratax?</h3>
            <p>
              Yes! Stratax is fully composable and can be integrated into your
              DeFi application. Check our documentation for contract addresses
              and integration guides.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Start?</h2>
          <p>Join the future of efficient leveraged trading</p>
          <Link to="/app" className="btn btn-primary btn-large">
            Launch App
            <span className="btn-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Stratax</h4>
            <p>Advanced leverage on-chain</p>
          </div>

          <div className="footer-section">
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

          <div className="footer-section">
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

          <div className="footer-section">
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

        <div className="footer-bottom">
          <p>&copy; 2026 Stratax. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
