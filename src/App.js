import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Web3Provider } from "./context/Web3Context";
import WalletConnect from "./components/WalletConnect";
import CreatePosition from "./components/CreatePosition";
import MintPosition from "./components/MintPosition";
import UnwindPosition from "./components/UnwindPosition";
import PositionsList from "./components/PositionsList";
import LandingPage from "./components/LandingPage";
import NetworkSelector from "./components/NetworkSelector";
import TradingViewChart from "./components/TradingViewChart";
import ErrorBoundary from "./components/ErrorBoundary";
import { getPositionChartSymbol } from "./utils/tradingViewSymbols";
import "./App.css";

function TradingApp() {
  const [activeTab, setActiveTab] = useState("mint");
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState({
    collateralToken: "WETH",
    borrowToken: "USDC",
    positionType: "long",
  });
  const [refreshPositions, setRefreshPositions] = useState(0);

  const handleManagePosition = (position) => {
    setSelectedPosition(position);
    setActiveTab("open");
  };

  const handleUnwindPosition = (position) => {
    setSelectedPosition(position);
    setActiveTab("unwind");
  };

  const clearSelectedPosition = () => {
    setSelectedPosition(null);
  };

  const handleAssetChange = (collateralToken, borrowToken, positionType) => {
    setSelectedAsset({ collateralToken, borrowToken, positionType });
  };

  const handleMintSuccess = () => {
    setRefreshPositions((prev) => prev + 1);
    // Optionally switch to positions list or stay on mint tab
  };

  const chartSymbol = getPositionChartSymbol(
    selectedAsset.collateralToken,
    selectedAsset.borrowToken,
    selectedAsset.positionType,
  );

  return (
    <Web3Provider>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <Link to="/" className="logo-link">
              <h1>Stratax</h1>
            </Link>
            <div className="header-actions">
              <NetworkSelector />
              <WalletConnect />
            </div>
          </div>
        </header>

        <main className="App-main">
          <div className="container">
            <div className="left-section">
              <div className="card chart-card">
                <div className="chart-header">
                  <h2>Market Chart</h2>
                  <span className="chart-symbol-display">
                    {selectedAsset.positionType === "long"
                      ? selectedAsset.collateralToken
                      : selectedAsset.borrowToken ||
                        selectedAsset.collateralToken}
                  </span>
                </div>
                <ErrorBoundary>
                  <TradingViewChart symbol={chartSymbol} />
                </ErrorBoundary>
              </div>
              <div className="card positions-card">
                <PositionsList
                  onManagePosition={handleManagePosition}
                  onUnwindPosition={handleUnwindPosition}
                  refreshTrigger={refreshPositions}
                />
              </div>
            </div>

            <div className="right-section">
              <div className="card">
                <div className="tabs">
                  <button
                    className={`tab ${activeTab === "mint" ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab("mint");
                      setSelectedPosition(null);
                    }}
                  >
                    Mint Position
                  </button>
                  <button
                    className={`tab ${activeTab === "open" ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab("open");
                      if (!selectedPosition) {
                        // Don't clear if there's a selected position
                      }
                    }}
                  >
                    Open Position
                  </button>
                  <button
                    className={`tab ${activeTab === "unwind" ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab("unwind");
                      setSelectedPosition(null);
                    }}
                  >
                    Unwind Position
                  </button>
                </div>

                <div className="tab-content">
                  {activeTab === "mint" ? (
                    <MintPosition onMintSuccess={handleMintSuccess} />
                  ) : activeTab === "open" ? (
                    <CreatePosition
                      selectedPosition={selectedPosition}
                      onClearSelection={clearSelectedPosition}
                      onAssetChange={handleAssetChange}
                    />
                  ) : (
                    <UnwindPosition
                      selectedPosition={selectedPosition}
                      onClearSelection={clearSelectedPosition}
                    />
                  )}
                </div>
              </div>

              <div className="card info-card">
                <h2>How It Works</h2>
                <ol>
                  <li>
                    <strong>Mint Position:</strong> Supply collateral and create
                    a leveraged position by borrowing against it on Aave. The
                    contract uses flash loans and 1inch for efficient execution.
                  </li>
                  <li>
                    <strong>Manage Leverage:</strong> Choose your desired
                    leverage multiplier up to the maximum allowed by the
                    collateral asset's LTV ratio.
                  </li>
                  <li>
                    <strong>Unwind Position:</strong> Close your position by
                    repaying the debt and withdrawing your collateral.
                  </li>
                </ol>

                <div className="warning-box">
                  <strong>⚠️ Important:</strong>
                  <ul>
                    <li>Leveraged positions carry significant risk</li>
                    <li>Monitor your position's health factor</li>
                    <li>Be aware of liquidation risks</li>
                    <li>Test with small amounts first</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="App-footer">
          <p>Stratax - Powered by Aave & 1inch</p>
        </footer>
      </div>
    </Web3Provider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<TradingApp />} />
      </Routes>
    </Router>
  );
}

export default App;
