import React, { useState, useRef, useEffect } from "react";
import { useWeb3 } from "../context/Web3Context";
import { SUPPORTED_NETWORKS } from "../config/contracts";
import "./NetworkSelector.css";

const NetworkSelector = () => {
  const { chainId, switchNetwork, error } = useWeb3();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const networkLogos = {
    1: "🔷", // Ethereum
    137: "🟣", // Polygon
    8453: "🔵", // Base
    11155111: "🔷", // Sepolia
    31337: "🔨", // Anvil
  };

  const currentNetwork = SUPPORTED_NETWORKS[chainId];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNetworkSelect = async (networkId) => {
    await switchNetwork(networkId);
    setIsOpen(false);
  };

  return (
    <div className="network-selector" ref={dropdownRef}>
      {error && error.includes("switch") && (
        <div className="network-error">{error}</div>
      )}
      <button
        className="network-selector-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="network-logo">{networkLogos[chainId] || "🌐"}</span>
        <span className="network-name">
          {currentNetwork?.name || "Unknown Network"}
        </span>
        <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
      </button>

      {isOpen && (
        <div className="network-dropdown">
          {Object.entries(SUPPORTED_NETWORKS).map(([id, network]) => (
            <button
              key={id}
              className={`network-option ${Number(id) === chainId ? "active" : ""}`}
              onClick={() => handleNetworkSelect(Number(id))}
            >
              <span className="network-logo">{networkLogos[id] || "🌐"}</span>
              <span className="network-name">{network.name}</span>
              {Number(id) === chainId && <span className="checkmark">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;
