import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { CONTRACTS, SUPPORTED_NETWORKS } from "../config/contracts";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import "./LeaderboardPage.css";

const DEFAULT_RPC_URL =
  process.env.REACT_APP_ETH_RPC_URL || SUPPORTED_NETWORKS[1]?.rpcUrl || "";
const NFT_ADDRESS =
  process.env.REACT_APP_STRATAX_NFT_ADDRESS || CONTRACTS.STRATAX_POSITION_NFT;
const WAITLIST_MODE =
  (process.env.REACT_APP_WAITLIST_MODE || "true").toLowerCase() === "true";

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

function getAttributeMap(attributes = []) {
  const mapped = {};
  attributes.forEach((attr) => {
    mapped[attr.trait_type] = attr.value;
  });
  return mapped;
}

function parseMetric(rawValue) {
  const valueText = String(rawValue || "0");
  if (!/^\d+$/.test(valueText)) {
    return 0;
  }

  const bigValue = window.BigInt(valueText);
  const looksLikeWad = bigValue >= 10n ** 15n;

  if (looksLikeWad) {
    return Number(ethers.formatUnits(bigValue, 18));
  }

  return Number(valueText);
}

function formatUsd(value) {
  if (!Number.isFinite(value)) {
    return "$0.00";
  }

  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function resolveStatus(position) {
  if (!position) {
    return "Unknown";
  }

  if (position.isBurned) {
    return "Burned";
  }

  if (position.isActive) {
    return "Active";
  }

  return "Closed";
}

function LeaderboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [searchToken, setSearchToken] = useState("");
  const [sortBy, setSortBy] = useState("position");

  const backLink = WAITLIST_MODE ? "/waitlist" : "/";

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      setError("");

      try {
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

        const currentTokenId = Number(await contract.currentTokenId());
        const tokenIds = [];

        for (let id = 1; id <= currentTokenId; id += 1) {
          const exists = await contract.exists(id);
          if (exists) {
            tokenIds.push(id);
          }
        }

        const fetchedRows = await Promise.all(
          tokenIds.map(async (tokenId) => {
            const [position, tokenUri] = await Promise.all([
              contract.getPosition(tokenId),
              contract.tokenURI(tokenId),
            ]);

            const metadata = await decodeTokenMetadata(tokenUri);
            const attributeMap = getAttributeMap(metadata.attributes || []);
            const positionSize = parseMetric(
              attributeMap["Position USD Value"],
            );
            const totalTradeVolume = parseMetric(
              attributeMap["Cumulative Trade Volume USD"],
            );

            return {
              tokenId,
              status: resolveStatus(position),
              collateralToken: position.collateralToken,
              borrowToken: position.borrowToken,
              positionSize,
              totalTradeVolume,
            };
          }),
        );

        setRows(fetchedRows);
      } catch (loadError) {
        console.error("Failed to load leaderboard", loadError);
        setRows([]);
        setError(loadError.message || "Unable to load leaderboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const query = searchToken.trim();

    const filtered = query
      ? rows.filter((row) => String(row.tokenId).includes(query))
      : rows;

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "volume") {
        return b.totalTradeVolume - a.totalTradeVolume;
      }
      return b.positionSize - a.positionSize;
    });

    return sorted;
  }, [rows, searchToken, sortBy]);

  return (
    <div className="leaderboard-page">
      <SiteHeader />
      <main className="leaderboard-shell with-site-chrome">
        <header className="leaderboard-header">
          <div>
            <p className="leaderboard-kicker">Stratax</p>
            <h1>NFT Leaderboard</h1>
            <p>
              Live on-chain ranking of position NFTs with status, position size,
              and cumulative trade volume.
            </p>
          </div>
          <div className="leaderboard-header-actions">
            <Link to="/nft" className="leaderboard-link-secondary">
              NFT Explorer
            </Link>
            <Link to={backLink} className="leaderboard-link-primary">
              Back
            </Link>
          </div>
        </header>

        <section className="leaderboard-controls">
          <label htmlFor="token-search">Search Token #</label>
          <input
            id="token-search"
            type="text"
            value={searchToken}
            onChange={(event) =>
              setSearchToken(event.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="Enter token id"
          />

          <label htmlFor="sort-by">Order By</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="position">Position Size (Default)</option>
            <option value="volume">Total Trade Volume</option>
          </select>
        </section>

        {error && <p className="leaderboard-error">{error}</p>}

        {isLoading ? (
          <p className="leaderboard-loading">Loading leaderboard...</p>
        ) : (
          <section className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Token #</th>
                  <th>Status</th>
                  <th>Position Size</th>
                  <th>Total Trade Volume</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="leaderboard-empty">
                      No NFTs found for current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((row, index) => (
                    <tr key={row.tokenId}>
                      <td>{index + 1}</td>
                      <td>#{row.tokenId}</td>
                      <td>
                        <span
                          className={`status-pill ${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{formatUsd(row.positionSize)}</td>
                      <td>{formatUsd(row.totalTradeVolume)}</td>
                      <td>
                        <Link to={`/nft/${row.tokenId}`} className="token-link">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default LeaderboardPage;
