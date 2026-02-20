import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import "./WalletConnect.css";

const WalletConnect = () => {
  const {
    account,
    isConnected,
    isConnecting,
    chainId,
    isMetaMaskInstalled,
    connectWallet,
    disconnectWallet,
    provider,
  } = useWeb3();

  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (account && provider) {
        try {
          const balanceWei = await provider.getBalance(account);
          const balanceEth = ethers.formatEther(balanceWei);
          setBalance(parseFloat(balanceEth).toFixed(4));
        } catch (err) {
          console.error("Error fetching balance:", err);
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [account, provider]);

  const formatAddress = (address) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getNativeCurrencySymbol = () => {
    if (!chainId) return "ETH";
    switch (chainId) {
      case 1:
        return "ETH";
      case 137:
        return "MATIC";
      case 8453:
        return "ETH";
      case 11155111:
        return "ETH";
      case 31337:
        return "ETH";
      default:
        return "ETH";
    }
  };

  if (!isMetaMaskInstalled) {
    return (
      <div className="wallet-connect">
        <div className="wallet-error">
          <p>MetaMask not detected</p>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Install MetaMask
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      {!isConnected ? (
        <button
          className="btn btn-primary"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <button className="wallet-button" onClick={disconnectWallet}>
          <span className="wallet-address">{formatAddress(account)}</span>
          {balance !== null && (
            <span className="wallet-balance">
              ({balance} {getNativeCurrencySymbol()})
            </span>
          )}
          <span className="disconnect-icon">✕</span>
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
