/* global BigInt */
import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { CONTRACTS, TOKENS } from "../config/contracts";
import { STRATAX_TOKEN_SALE_ABI } from "../contracts/abi";
import WalletConnect from "./WalletConnect";
import NetworkSelector from "./NetworkSelector";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import "./TokenSalePage.css";

const ERC20_READWRITE_ABI = [
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

function formatUsdFromE8(value) {
  return Number(ethers.formatUnits(value, 8)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function toAddressLabel(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function parseSlippageToBps(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 100;
  const clamped = Math.max(0, Math.min(20, parsed));
  return Math.floor(clamped * 100);
}

const TOKENOMICS_ALLOCATIONS = [
  {
    id: "public-ico",
    label: "Public ICO",
    percent: 20,
    color: "#56a4ff",
    description:
      "20,000,000 STRX allocated to public participants, with 25% unlocked at TGE and the remaining 75% vesting linearly over 9 months.",
  },
  {
    id: "strategic-private",
    label: "Strategic/Private",
    percent: 12,
    color: "#35ddb7",
    description:
      "12,000,000 STRX reserved for strategic and private rounds with 10% at TGE, a 3-month cliff, then linear vesting across 18 months.",
  },
  {
    id: "team",
    label: "Team",
    percent: 15,
    color: "#ffcc66",
    description:
      "15,000,000 STRX dedicated to core contributors with a 12-month cliff followed by 36 months of linear vesting.",
  },
  {
    id: "advisors",
    label: "Advisors",
    percent: 3,
    color: "#c48dff",
    description:
      "3,000,000 STRX for advisor incentives, locked for 6 months then vesting linearly over 24 months.",
  },
  {
    id: "ecosystem-incentives",
    label: "Ecosystem Incentives",
    percent: 22,
    color: "#ff8f9d",
    description:
      "22,000,000 STRX allocated to ecosystem growth with 10% unlocked at TGE and emissions distributed over 60 months.",
  },
  {
    id: "treasury-dao-reserve",
    label: "Treasury/DAO Reserve",
    percent: 20,
    color: "#93f089",
    description:
      "20,000,000 STRX held for DAO-governed reserve needs, with a 6-month lock then linear vesting across 48 months.",
  },
  {
    id: "liquidity-market-making",
    label: "Liquidity & Market Making",
    percent: 8,
    color: "#ffd166",
    description:
      "8,000,000 STRX set aside for market depth, with 50% unlocked at TGE and the remaining 50% vested over 12 months.",
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

const TokenSalePage = () => {
  const { account, provider, networkId, connectWallet } = useWeb3();

  const saleAddress =
    CONTRACTS.STRATAX_TOKEN_SALE ||
    process.env.REACT_APP_STRATAX_TOKEN_SALE_ADDRESS ||
    "";

  const paymentTokenOptions = useMemo(
    () => Object.entries(TOKENS[networkId] || TOKENS[1] || {}),
    [networkId],
  );

  const [paymentToken, setPaymentToken] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [slippagePct, setSlippagePct] = useState("1");
  const [isQuoting, setIsQuoting] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");

  const [saleMeta, setSaleMeta] = useState({
    strataxToken: "",
    strataxSymbol: "STRATAX",
    strataxDecimals: 18,
    strataxPriceUsdE8: 0n,
    inventory: 0n,
  });

  const [paymentMeta, setPaymentMeta] = useState({
    symbol: "",
    decimals: 18,
    isWhitelisted: false,
  });

  const [quote, setQuote] = useState({
    rawOut: 0n,
    formattedOut: "0",
    impliedUsd: "0",
  });
  const [selectedTokenomicsId, setSelectedTokenomicsId] = useState(
    TOKENOMICS_ALLOCATIONS[0].id,
  );

  const tokenomicsSlices = useMemo(() => {
    let startAngle = 0;
    return TOKENOMICS_ALLOCATIONS.map((item) => {
      const sweep = (item.percent / 100) * 360;
      const endAngle = startAngle + sweep;
      const path = describeArc(120, 120, 100, startAngle, endAngle);
      const midAngle = startAngle + sweep / 2;
      const labelPos = polarToCartesian(120, 120, 66, midAngle);

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

  useEffect(() => {
    if (!paymentToken && paymentTokenOptions.length > 0) {
      setPaymentToken(paymentTokenOptions[0][1]);
    }
  }, [paymentToken, paymentTokenOptions]);

  useEffect(() => {
    const loadSaleMeta = async () => {
      if (!provider || !saleAddress) {
        return;
      }

      try {
        const sale = new ethers.Contract(
          saleAddress,
          STRATAX_TOKEN_SALE_ABI,
          provider,
        );
        const [strataxToken, strataxPriceUsdE8] = await Promise.all([
          sale.strataxToken(),
          sale.strataxPriceUsd(),
        ]);

        const strataxContract = new ethers.Contract(
          strataxToken,
          ERC20_READWRITE_ABI,
          provider,
        );

        const [strataxSymbol, strataxDecimals, inventory] = await Promise.all([
          strataxContract.symbol(),
          strataxContract.decimals(),
          strataxContract.balanceOf(saleAddress),
        ]);

        setSaleMeta({
          strataxToken,
          strataxSymbol,
          strataxDecimals: Number(strataxDecimals),
          strataxPriceUsdE8,
          inventory,
        });
      } catch (metaError) {
        console.error("Failed to load token sale metadata", metaError);
        setError("Unable to read token sale contract. Check contract address.");
      }
    };

    loadSaleMeta();
  }, [provider, saleAddress, lastTxHash]);

  useEffect(() => {
    const runQuote = async () => {
      if (!provider || !saleAddress || !paymentToken || !paymentAmount) {
        setQuote({ rawOut: 0n, formattedOut: "0", impliedUsd: "0" });
        return;
      }

      try {
        setError("");
        setIsQuoting(true);

        const sale = new ethers.Contract(
          saleAddress,
          STRATAX_TOKEN_SALE_ABI,
          provider,
        );
        const paymentTokenContract = new ethers.Contract(
          paymentToken,
          ERC20_READWRITE_ABI,
          provider,
        );

        const [cfg, symbol, decimals] = await Promise.all([
          sale.paymentTokenConfigs(paymentToken),
          paymentTokenContract.symbol(),
          paymentTokenContract.decimals(),
        ]);

        setPaymentMeta({
          symbol,
          decimals: Number(decimals),
          isWhitelisted: cfg.isWhitelisted,
        });

        if (!cfg.isWhitelisted) {
          setQuote({ rawOut: 0n, formattedOut: "0", impliedUsd: "0" });
          setError("Selected payment token is not whitelisted in token sale.");
          return;
        }

        const paymentAmountWei = ethers.parseUnits(paymentAmount, decimals);
        const out = await sale.quote(paymentToken, paymentAmountWei);

        const formattedOut = ethers.formatUnits(out, saleMeta.strataxDecimals);
        const impliedUsdValue =
          (out * saleMeta.strataxPriceUsdE8) /
          10n ** BigInt(saleMeta.strataxDecimals);

        setQuote({
          rawOut: out,
          formattedOut,
          impliedUsd: formatUsdFromE8(impliedUsdValue),
        });
      } catch (quoteError) {
        console.error("Quote failed", quoteError);
        setQuote({ rawOut: 0n, formattedOut: "0", impliedUsd: "0" });
        setError(
          quoteError.shortMessage || quoteError.message || "Quote failed",
        );
      } finally {
        setIsQuoting(false);
      }
    };

    runQuote();
  }, [
    paymentAmount,
    paymentToken,
    provider,
    saleAddress,
    saleMeta.strataxDecimals,
    saleMeta.strataxPriceUsdE8,
  ]);

  const handleBuy = async (event) => {
    event.preventDefault();

    if (!account || !provider) {
      connectWallet();
      return;
    }

    if (!saleAddress) {
      setError("Token sale contract address is not configured.");
      return;
    }

    if (!paymentToken || !paymentAmount || quote.rawOut <= 0n) {
      setError("Enter a valid amount to buy.");
      return;
    }

    try {
      setIsBuying(true);
      setError("");
      setStatus("Preparing transaction...");
      setLastTxHash("");

      const signer = await provider.getSigner();
      const sale = new ethers.Contract(
        saleAddress,
        STRATAX_TOKEN_SALE_ABI,
        signer,
      );
      const paymentTokenContract = new ethers.Contract(
        paymentToken,
        ERC20_READWRITE_ABI,
        signer,
      );

      const paymentAmountWei = ethers.parseUnits(
        paymentAmount,
        paymentMeta.decimals,
      );
      const slippageBps = BigInt(parseSlippageToBps(slippagePct));
      const minOut = (quote.rawOut * (10000n - slippageBps)) / 10000n;

      const allowance = await paymentTokenContract.allowance(
        account,
        saleAddress,
      );
      if (allowance < paymentAmountWei) {
        setStatus(`Approving ${paymentMeta.symbol}...`);
        const approveTx = await paymentTokenContract.approve(
          saleAddress,
          paymentAmountWei,
        );
        await approveTx.wait();
      }

      setStatus("Submitting purchase...");
      const buyTx = await sale.buy(paymentToken, paymentAmountWei, minOut, []);
      setLastTxHash(buyTx.hash);
      await buyTx.wait();

      setStatus("Purchase complete.");
      setPaymentAmount("");
    } catch (buyError) {
      console.error("Purchase failed", buyError);
      setError(
        buyError.shortMessage ||
          buyError.reason ||
          buyError.message ||
          "Purchase failed",
      );
      setStatus("");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="token-sale-page">
      <SiteHeader
        showLaunchApp={false}
        extraActions={
          <>
            <NetworkSelector />
            <WalletConnect />
          </>
        }
      />

      <main className="token-sale-shell with-site-chrome">
        <header className="token-sale-header">
          <div>
            <p className="token-sale-kicker">Stratax Token Sale</p>
            <h1>Purchase {saleMeta.strataxSymbol}</h1>
            <h2
              className="token-sale-subtitle"
              style={{ color: "#56a4ff", marginBottom: "0.5em" }}
            >
              Public ICO - 20% of total supply
            </h2>
            <h2
              className="token-sale-subtitle"
              style={{ color: "#35ddb7", marginBottom: "0.5em" }}
            >
              Comming soon: Stake STRATAX for rewards and protocol profits
            </h2>
            <p>
              Buy STRATAX with whitelisted payment tokens. Quotes are read
              on-chain from the live sale contract.
            </p>
          </div>
          <Link to="/" className="token-sale-back-link">
            Back to Landing
          </Link>
        </header>

        <section className="token-sale-info-grid">
          <article>
            <span>Sale Contract</span>
            <strong>
              {saleAddress ? toAddressLabel(saleAddress) : "Not set"}
            </strong>
          </article>
          <article>
            <span>{saleMeta.strataxSymbol} Price</span>
            <strong>
              $
              {saleMeta.strataxPriceUsdE8
                ? formatUsdFromE8(saleMeta.strataxPriceUsdE8)
                : "0.00"}
            </strong>
          </article>
          <article>
            <span>Sale Inventory</span>
            <strong>
              {saleMeta.inventory
                ? Number(
                    ethers.formatUnits(
                      saleMeta.inventory,
                      saleMeta.strataxDecimals,
                    ),
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })
                : "0"}{" "}
              {saleMeta.strataxSymbol}
            </strong>
          </article>
        </section>

        <section className="token-sale-card">
          <form onSubmit={handleBuy} className="token-sale-form">
            <div className="token-sale-field">
              <label htmlFor="payment-token">Payment Token</label>
              <select
                id="payment-token"
                value={paymentToken}
                onChange={(e) => setPaymentToken(e.target.value)}
              >
                {paymentTokenOptions.map(([symbol, address]) => (
                  <option key={address} value={address}>
                    {symbol}
                  </option>
                ))}
              </select>
            </div>

            <div className="token-sale-field">
              <label htmlFor="payment-amount">Amount</label>
              <input
                id="payment-amount"
                type="number"
                min="0"
                step="any"
                placeholder="0.0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <div className="token-sale-field">
              <label htmlFor="slippage-pct">Slippage (%)</label>
              <input
                id="slippage-pct"
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={slippagePct}
                onChange={(e) => setSlippagePct(e.target.value)}
              />
            </div>

            <div className="token-sale-quote">
              <p>
                <span>Quoted Output</span>
                <strong>
                  {isQuoting
                    ? "Loading quote..."
                    : `${Number(quote.formattedOut || 0).toLocaleString(
                        undefined,
                        {
                          maximumFractionDigits: 6,
                        },
                      )} ${saleMeta.strataxSymbol}`}
                </strong>
              </p>
              <p>
                <span>Implied USD Value</span>
                <strong>${quote.impliedUsd}</strong>
              </p>
              <p>
                <span>Whitelist Status</span>
                <strong>
                  {paymentMeta.isWhitelisted
                    ? "Whitelisted"
                    : "Not whitelisted"}
                </strong>
              </p>
            </div>

            {status && <p className="token-sale-status">{status}</p>}
            {error && <p className="token-sale-error">{error}</p>}
            {lastTxHash && (
              <p className="token-sale-status">
                Tx:{" "}
                <span className="token-sale-hash">
                  {toAddressLabel(lastTxHash)}
                </span>
              </p>
            )}

            <button
              type="submit"
              className="token-sale-buy-btn"
              disabled={isBuying || isQuoting || !saleAddress}
            >
              {!account
                ? "Connect Wallet"
                : isBuying
                  ? "Processing Purchase..."
                  : `Buy ${saleMeta.strataxSymbol}`}
            </button>
          </form>

          <section className="tokenomics-panel">
            <h2>Tokenomics</h2>
            <p className="tokenomics-subtitle">
              Click a pie section to view details about that allocation.
            </p>

            <div className="tokenomics-layout">
              <div className="tokenomics-chart-wrap">
                <svg
                  className="tokenomics-chart"
                  viewBox="0 0 240 240"
                  role="img"
                  aria-label="Tokenomics allocation pie chart"
                >
                  {tokenomicsSlices.map((slice) => {
                    const isActive = selectedTokenomicsId === slice.id;
                    return (
                      <g key={slice.id}>
                        <path
                          d={slice.path}
                          fill={slice.color}
                          className={`tokenomics-slice ${isActive ? "active" : ""}`}
                          onClick={() => setSelectedTokenomicsId(slice.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${slice.label} ${slice.percent}%`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedTokenomicsId(slice.id);
                            }
                          }}
                        />
                        <text
                          x={slice.labelX}
                          y={slice.labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="tokenomics-slice-label"
                        >
                          {slice.percent}%
                        </text>
                      </g>
                    );
                  })}
                  <circle
                    cx="120"
                    cy="120"
                    r="45"
                    className="tokenomics-hole"
                  />
                  <text
                    x="120"
                    y="112"
                    textAnchor="middle"
                    className="tokenomics-center-title"
                  >
                    STRATAX
                  </text>
                  <text
                    x="120"
                    y="134"
                    textAnchor="middle"
                    className="tokenomics-center-value"
                  >
                    100%
                  </text>
                </svg>
              </div>

              <div className="tokenomics-legend">
                {TOKENOMICS_ALLOCATIONS.map((item) => {
                  const isActive = selectedTokenomicsId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`tokenomics-legend-item ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedTokenomicsId(item.id)}
                    >
                      <span
                        className="tokenomics-legend-swatch"
                        style={{ background: item.color }}
                      />
                      <span className="tokenomics-legend-label">
                        {item.label}
                      </span>
                      <strong>{item.percent}%</strong>
                    </button>
                  );
                })}
              </div>
            </div>

            <article className="tokenomics-details">
              <h3>
                {selectedTokenomics.label} ({selectedTokenomics.percent}%)
              </h3>
              <p>{selectedTokenomics.description}</p>
            </article>
          </section>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default TokenSalePage;
