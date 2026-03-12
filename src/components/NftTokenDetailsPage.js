import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ethers } from "ethers";
import { CONTRACTS, SUPPORTED_NETWORKS } from "../config/contracts";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import "./NftTokenDetailsPage.css";

const DEFAULT_RPC_URL =
  process.env.REACT_APP_ETH_RPC_URL || SUPPORTED_NETWORKS[1]?.rpcUrl || "";
const NFT_ADDRESS =
  process.env.REACT_APP_STRATAX_NFT_ADDRESS || CONTRACTS.STRATAX_POSITION_NFT;
const WAITLIST_MODE =
  (process.env.REACT_APP_WAITLIST_MODE || "true").toLowerCase() === "true";
const TEST_TOKEN_ID = "-1";

const TEST_METADATA = {
  name: "Stratax Position #TEST",
  description:
    "Mock metadata preview for UI testing. This card simulates on-chain tokenURI output.",
  image: "/logo-no-text-no-background.png",
  attributes: [
    {
      trait_type: "Position USD Value",
      display_type: "number",
      value: "2450000000000000000000",
    },
    {
      trait_type: "Cumulative Trade Volume USD",
      display_type: "number",
      value: "9820000000000000000000",
    },
    {
      trait_type: "Collateral Token",
      value: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    {
      trait_type: "Borrow Token",
      value: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      trait_type: "Stratax Proxy",
      value: "0x1234567890abcdef1234567890abcdef12345678",
    },
  ],
};

function decodeTokenMetadata(tokenUri) {
  if (!tokenUri) {
    throw new Error("Empty tokenURI response");
  }

  if (tokenUri.startsWith("data:application/json;base64,")) {
    const base64 = tokenUri.split(",")[1];
    const decoded = atob(base64);
    return JSON.parse(decoded);
  }

  if (tokenUri.startsWith("data:application/json,")) {
    const raw = decodeURIComponent(
      tokenUri.replace("data:application/json,", ""),
    );
    return JSON.parse(raw);
  }

  if (tokenUri.startsWith("http://") || tokenUri.startsWith("https://")) {
    return fetch(tokenUri).then((response) => {
      if (!response.ok) {
        throw new Error("Unable to download token metadata");
      }
      return response.json();
    });
  }

  throw new Error("Unsupported tokenURI format");
}

function normalizeImageUri(uri) {
  if (!uri) {
    return "";
  }

  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }

  return uri;
}

function formatIntegerString(input) {
  if (!/^\d+$/.test(String(input))) {
    return String(input);
  }

  return String(input).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatWithDecimals(rawValue, decimals) {
  const value = window.BigInt(rawValue);
  const divisor = 10n ** window.BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return formatIntegerString(whole.toString());
  }

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, 2)
    .replace(/0+$/, "");

  if (!fractionText) {
    return formatIntegerString(whole.toString());
  }

  return `${formatIntegerString(whole.toString())}.${fractionText}`;
}

function formatUsdMetric(rawValue) {
  const valueText = String(rawValue || "0");
  if (!/^\d+$/.test(valueText)) {
    return valueText;
  }

  const bigValue = window.BigInt(valueText);
  const looksLikeWad = bigValue >= 10n ** 15n;

  if (looksLikeWad) {
    return `$${formatWithDecimals(valueText, 18)}`;
  }

  return `$${formatIntegerString(valueText)}`;
}

function shortAddress(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("0x") ||
    value.length < 12
  ) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getAttributeMap(attributes) {
  const mapped = {};
  attributes.forEach((attr) => {
    mapped[attr.trait_type] = attr.value;
  });
  return mapped;
}

function isHexAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function NftTokenDetailsPage() {
  const { tokenId: routeTokenId } = useParams();
  const navigate = useNavigate();
  const [tokenIdInput, setTokenIdInput] = useState(routeTokenId || "1");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [expandedAddresses, setExpandedAddresses] = useState({});
  const [copiedAddressKey, setCopiedAddressKey] = useState("");
  const backLink = WAITLIST_MODE ? "/waitlist" : "/";

  useEffect(() => {
    if (routeTokenId) {
      setTokenIdInput(routeTokenId);
    }
  }, [routeTokenId]);

  const fetchTokenDetails = async (tokenIdValue) => {
    setIsLoading(true);
    setError("");

    try {
      if (String(tokenIdValue) === TEST_TOKEN_ID) {
        setMetadata(TEST_METADATA);
        return;
      }

      if (!DEFAULT_RPC_URL) {
        throw new Error("No RPC URL configured");
      }

      if (
        !NFT_ADDRESS ||
        NFT_ADDRESS === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("NFT contract address is not configured");
      }

      const provider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
      const contract = new ethers.Contract(
        NFT_ADDRESS,
        STRATAX_POSITION_NFT_ABI,
        provider,
      );

      const tokenUri = await contract.tokenURI(tokenIdValue);
      const parsedMetadata = await decodeTokenMetadata(tokenUri);

      setMetadata({
        ...parsedMetadata,
        image: normalizeImageUri(parsedMetadata.image),
      });
    } catch (fetchError) {
      console.error("Failed to load token metadata", fetchError);
      setMetadata(null);
      setError(fetchError.message || "Unable to fetch token metadata");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (
      routeTokenId &&
      (/^\d+$/.test(routeTokenId) || routeTokenId === TEST_TOKEN_ID)
    ) {
      fetchTokenDetails(routeTokenId);
    }
  }, [routeTokenId]);

  const attributeMap = useMemo(() => {
    if (!metadata?.attributes) {
      return {};
    }
    return getAttributeMap(metadata.attributes);
  }, [metadata]);

  const valueMetric = attributeMap["Position USD Value"] || "0";
  const volumeMetric = attributeMap["Cumulative Trade Volume USD"] || "0";
  const addressRows = [
    {
      key: "collateral",
      label: "Collateral Token",
      value: attributeMap["Collateral Token"] || "-",
    },
    {
      key: "borrow",
      label: "Borrow Token",
      value: attributeMap["Borrow Token"] || "-",
    },
    {
      key: "proxy",
      label: "Stratax Proxy",
      value: attributeMap["Stratax Proxy"] || "-",
    },
    {
      key: "nft",
      label: "Position NFT Contract",
      value: NFT_ADDRESS || "-",
    },
  ];

  const momentum = useMemo(() => {
    const v = Number(valueMetric);
    const t = Number(volumeMetric);
    if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) {
      return 0.45;
    }
    return Math.max(0.08, Math.min(v / t, 0.92));
  }, [valueMetric, volumeMetric]);

  const handleLookup = (event) => {
    event.preventDefault();

    if (!/^\d+$/.test(tokenIdInput) && tokenIdInput !== TEST_TOKEN_ID) {
      setError("Token ID must be a whole number or -1 for test data");
      return;
    }

    navigate(`/nft/${tokenIdInput}`);
  };

  const toggleAddressExpanded = (key) => {
    setExpandedAddresses((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyAddress = async (key, value) => {
    if (!isHexAddress(value)) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedAddressKey(key);
      window.setTimeout(() => {
        setCopiedAddressKey((current) => (current === key ? "" : current));
      }, 1200);
    } catch (copyError) {
      console.error("Failed to copy address", copyError);
    }
  };

  return (
    <div className="nft-page">
      <div className="nft-page-overlay" />
      <SiteHeader />
      <main className="nft-shell with-site-chrome">
        <header className="nft-header">
          <div>
            <p className="nft-kicker">Stratax Position NFT</p>
            <h1>Stratax Token Explorer</h1>
            <p className="nft-subtitle">
              Read on-chain tokenURI metadata and visualize the live position
              profile for each Stratax NFT.
            </p>
          </div>
          <Link to={backLink} className="nft-back-link">
            Back to Waitlist
          </Link>
        </header>

        <form className="nft-form" onSubmit={handleLookup}>
          <label htmlFor="token-id">Token ID</label>
          <input
            id="token-id"
            value={tokenIdInput}
            onChange={(event) => setTokenIdInput(event.target.value.trim())}
            placeholder="Enter NFT token id"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Loading..." : "Load Token"}
          </button>
        </form>

        {error && <p className="nft-error">{error}</p>}

        {metadata && (
          <section className="nft-grid">
            <article className="nft-visual-card">
              <div
                className="nft-orb"
                style={{
                  background: `conic-gradient(#9ad0ff 0% ${(momentum * 100).toFixed(2)}%, #6578ff ${(momentum * 100).toFixed(2)}% 100%)`,
                }}
              >
                <div className="nft-orb-center">
                  <span>Position</span>
                  <strong>{formatUsdMetric(valueMetric)}</strong>
                </div>
              </div>

              {metadata.image ? (
                <img
                  className="nft-metadata-image"
                  src={metadata.image}
                  alt={metadata.name || "Stratax position"}
                />
              ) : (
                <div className="nft-metadata-image nft-metadata-placeholder">
                  No image returned by metadata
                </div>
              )}
            </article>

            <article className="nft-details-card">
              <h2>{metadata.name || "Position NFT"}</h2>
              <p>{metadata.description || "No description found."}</p>

              <div className="nft-stats">
                <div>
                  <span>Position USD Value</span>
                  <strong>{formatUsdMetric(valueMetric)}</strong>
                </div>
                <div>
                  <span>Cumulative Trade Volume</span>
                  <strong>{formatUsdMetric(volumeMetric)}</strong>
                </div>
              </div>

              <div className="nft-attributes">
                {addressRows.map((row) => {
                  const isAddress = isHexAddress(row.value);
                  const isExpanded = !!expandedAddresses[row.key];
                  const displayValue =
                    isAddress && !isExpanded
                      ? shortAddress(row.value)
                      : row.value;

                  return (
                    <div key={row.key} className="nft-attribute-row">
                      <div className="nft-attribute-header">
                        <span>{row.label}</span>
                        {isAddress && (
                          <div className="nft-address-actions">
                            <button
                              type="button"
                              onClick={() => toggleAddressExpanded(row.key)}
                            >
                              {isExpanded ? "Collapse" : "Expand"}
                            </button>
                            <button
                              type="button"
                              className="nft-copy-icon-button"
                              onClick={() => copyAddress(row.key, row.value)}
                              aria-label={`Copy ${row.label} address`}
                              title={
                                copiedAddressKey === row.key
                                  ? "Copied"
                                  : "Copy address"
                              }
                            >
                              {copiedAddressKey === row.key ? "✓" : "⧉"}
                            </button>
                          </div>
                        )}
                      </div>
                      <strong className="nft-address-value">
                        {displayValue}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default NftTokenDetailsPage;
