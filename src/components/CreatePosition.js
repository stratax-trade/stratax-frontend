/* global BigInt */
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useStrataxContract } from "../hooks/useStrataxContract";
import {
  LEVERAGE_PRECISION,
  TOKENS,
  TOKEN_INFO,
  CONTRACTS,
} from "../config/contracts";
import { useWeb3 } from "../context/Web3Context";
import { get1inchSwapData } from "../utils/oneInch";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import TransactionModal from "./TransactionModal";
import "./CreatePosition.css";

const CreatePosition = ({
  selectedPosition,
  onClearSelection,
  onAssetChange,
}) => {
  const { networkId, account, connectWallet, provider } = useWeb3();

  const [selectedNFT, setSelectedNFT] = useState(null);
  const [availableNFTs, setAvailableNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  const {
    loading,
    error,
    createLeveragedPosition,
    calculateOpenParams,
    getMaxLeverage,
    getTokenBalance,
    getTokenInfo,
    getFreeCollateral,
  } = useStrataxContract(selectedNFT?.strataxProxy);

  const [formData, setFormData] = useState({
    collateralToken: "",
    collateralAmount: "",
    borrowToken: "",
    positionType: "long",
    desiredLeverage: "2", // 2x leverage
    oneInchSwapData: "0x",
    slippage: "1", // 1% slippage for 1inch swap
  });

  const [calculatedParams, setCalculatedParams] = useState(null);
  const [maxLeverage, setMaxLeverage] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [flashingFields, setFlashingFields] = useState(new Set());
  const [freeCollateral, setFreeCollateral] = useState(null);
  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    txHash: null,
  });

  const showModal = (type, title, message, txHash = null) => {
    setModal({ isOpen: true, type, title, message, txHash });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  // Helper function to check if a token is a stablecoin
  const isStablecoin = (tokenSymbol) => {
    const stablecoins = ["USDC", "USDT", "DAI", "FRAX", "LUSD", "BUSD"];
    return stablecoins.includes(tokenSymbol?.toUpperCase());
  };

  // Helper function to get position direction label
  const getPositionDirectionLabel = (collateralToken, borrowToken) => {
    if (
      !collateralToken ||
      !borrowToken ||
      collateralToken === "Unknown" ||
      borrowToken === "Unknown"
    ) {
      return null;
    }

    const collateralIsStable = isStablecoin(collateralToken);
    const borrowIsStable = isStablecoin(borrowToken);

    // Longing: collateral is non-stable
    if (!collateralIsStable) {
      return { text: `Longing ${collateralToken}`, type: "long" };
    }

    // Shorting: collateral is stable, borrow is non-stable
    if (collateralIsStable && !borrowIsStable) {
      return { text: `Shorting ${borrowToken}`, type: "short" };
    }

    return null;
  };

  // Auto-fill form when a position is selected for managing
  useEffect(() => {
    if (selectedPosition) {
      // Look up token addresses by symbol from TOKENS config
      const networkTokens = TOKENS[networkId] || TOKENS[1] || {};
      const collateralAddress =
        networkTokens[selectedPosition.collateralToken] || "";
      const borrowAddress = selectedPosition.borrowToken
        ? networkTokens[selectedPosition.borrowToken] || ""
        : "";

      console.log("Auto-filling position data:", {
        networkId,
        collateralSymbol: selectedPosition.collateralToken,
        collateralAddress,
        borrowSymbol: selectedPosition.borrowToken,
        borrowAddress,
        availableTokens: Object.keys(networkTokens),
      });

      // Extract leverage from the position (e.g., "2.50x" -> "2.50")
      const currentLeverage = parseFloat(selectedPosition.leverage) || 2;

      setFormData({
        collateralToken: collateralAddress,
        collateralAmount: "", // Leave empty for user to specify additional amount
        borrowToken: borrowAddress,
        positionType:
          selectedPosition.direction === "long"
            ? "long"
            : selectedPosition.direction === "short"
              ? "short"
              : "long",
        desiredLeverage: currentLeverage.toFixed(2),
        oneInchSwapData: "0x",
        slippage: "1",
      });
    }
  }, [selectedPosition, networkId]);

  // Fetch available NFTs
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!account || !provider) return;

      setLoadingNFTs(true);
      try {
        const nftContract = new ethers.Contract(
          CONTRACTS.STRATAX_POSITION_NFT,
          STRATAX_POSITION_NFT_ABI,
          provider,
        );

        const [tokenIds, positionList] =
          await nftContract.getPositionsByOwner(account);

        // Helper to get token symbol from address
        const getSymbol = (address) => {
          const networkTokens = TOKENS[networkId] || {};
          for (const [symbol, addr] of Object.entries(networkTokens)) {
            if (addr.toLowerCase() === address.toLowerCase()) {
              return symbol;
            }
          }
          return "Unknown";
        };

        // Map to NFT objects with readable info
        const nfts = tokenIds.map((tokenId, index) => {
          const pos = positionList[index];
          return {
            tokenId: tokenId.toString(),
            strataxProxy: pos.strataxProxy,
            collateralToken: getSymbol(pos.collateralToken),
            borrowToken: getSymbol(pos.borrowToken),
            collateralTokenAddress: pos.collateralToken,
            borrowTokenAddress: pos.borrowToken,
            isActive: pos.isActive,
            display: `NFT #${tokenId.toString()} - ${getSymbol(pos.collateralToken)} → ${getSymbol(pos.borrowToken)}${pos.isActive ? "" : " (Not Funded)"}`,
          };
        });

        setAvailableNFTs(nfts);

        // Auto-select if only one NFT
        if (nfts.length === 1) {
          setSelectedNFT(nfts[0]);
        }
      } catch (error) {
        console.error("Error fetching NFTs:", error);
      } finally {
        setLoadingNFTs(false);
      }
    };

    fetchNFTs();
  }, [account, provider, networkId]);

  // Auto-select NFT when position is clicked from PositionsList
  useEffect(() => {
    if (selectedPosition && availableNFTs.length > 0) {
      const matchingNFT = availableNFTs.find(
        (nft) => nft.tokenId === selectedPosition.tokenId,
      );
      if (matchingNFT) {
        setSelectedNFT(matchingNFT);
      }
    }
  }, [selectedPosition, availableNFTs]);

  // Auto-populate form when NFT is selected
  useEffect(() => {
    if (selectedNFT) {
      const directionLabel = getPositionDirectionLabel(
        selectedNFT.collateralToken,
        selectedNFT.borrowToken,
      );

      setFormData((prev) => ({
        ...prev,
        collateralToken: selectedNFT.collateralTokenAddress,
        borrowToken: selectedNFT.borrowTokenAddress,
        positionType: directionLabel?.type || "long",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNFT]);

  // Fetch free collateral when NFT is selected
  useEffect(() => {
    const fetchFreeCollateral = async () => {
      if (selectedNFT?.collateralTokenAddress && getFreeCollateral) {
        try {
          const free = await getFreeCollateral(
            selectedNFT.collateralTokenAddress,
          );
          setFreeCollateral(free);
        } catch (err) {
          console.error("Error fetching free collateral:", err);
          setFreeCollateral("0");
        }
      }
    };
    fetchFreeCollateral();
  }, [selectedNFT, getFreeCollateral]);

  // Fetch max leverage when collateral token changes
  useEffect(() => {
    const fetchMaxLeverage = async () => {
      if (
        formData.collateralToken &&
        ethers.isAddress(formData.collateralToken)
      ) {
        try {
          const max = await getMaxLeverage(formData.collateralToken);
          // Round down to 2 decimal places to avoid rounding errors
          const leverageValue = Number(max) / LEVERAGE_PRECISION;
          const roundedDown = Math.floor(leverageValue * 100) / 100;
          setMaxLeverage(roundedDown);
        } catch (err) {
          console.error("Error fetching max leverage:", err);
        }
      }
    };
    fetchMaxLeverage();
  }, [formData.collateralToken, getMaxLeverage]);

  // Notify parent component when asset selection changes
  useEffect(() => {
    if (onAssetChange && formData.collateralToken && formData.borrowToken) {
      // Get token symbols from addresses
      const networkTokens = TOKENS[networkId] || TOKENS[1] || {};
      const collateralSymbol =
        Object.entries(networkTokens).find(
          ([, addr]) =>
            addr.toLowerCase() === formData.collateralToken.toLowerCase(),
        )?.[0] || "WETH";
      const borrowSymbol =
        Object.entries(networkTokens).find(
          ([, addr]) =>
            addr.toLowerCase() === formData.borrowToken.toLowerCase(),
        )?.[0] || "USDC";

      onAssetChange(collateralSymbol, borrowSymbol, formData.positionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.collateralToken,
    formData.borrowToken,
    formData.positionType,
    networkId,
  ]);

  // Fetch token balance and info
  useEffect(() => {
    const fetchTokenData = async () => {
      if (
        formData.collateralToken &&
        ethers.isAddress(formData.collateralToken)
      ) {
        try {
          const [balance, info] = await Promise.all([
            getTokenBalance(formData.collateralToken),
            getTokenInfo(formData.collateralToken),
          ]);
          setTokenBalance(balance);
          setTokenInfo(info);
        } catch (err) {
          console.error("Error fetching token data:", err);
        }
      }
    };
    fetchTokenData();
  }, [formData.collateralToken, getTokenBalance, getTokenInfo]);

  // Check token allowance when amount or token changes
  useEffect(() => {
    const checkAllowance = async () => {
      if (
        !formData.collateralToken ||
        !formData.collateralAmount ||
        !selectedNFT?.strataxProxy ||
        !account
      ) {
        setNeedsApproval(false);
        return;
      }

      setCheckingApproval(true);
      try {
        const tokenContract = new ethers.Contract(
          formData.collateralToken,
          [
            "function allowance(address owner, address spender) view returns (uint256)",
          ],
          provider,
        );

        const allowance = await tokenContract.allowance(
          account,
          selectedNFT.strataxProxy,
        );

        const requiredAmount = ethers.parseUnits(
          formData.collateralAmount,
          tokenInfo?.decimals || 18,
        );

        setNeedsApproval(allowance < requiredAmount);
      } catch (err) {
        console.error("Error checking allowance:", err);
        setNeedsApproval(true); // Assume approval needed on error
      } finally {
        setCheckingApproval(false);
      }
    };

    checkAllowance();
  }, [
    formData.collateralToken,
    formData.collateralAmount,
    selectedNFT?.strataxProxy,
    account,
    provider,
    tokenInfo,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Enforce max leverage dynamically from contract
    if (name === "desiredLeverage") {
      const numValue = parseFloat(value);
      const maxLev = maxLeverage || 5;
      if (numValue > maxLev) {
        setFormData((prev) => ({ ...prev, [name]: maxLev.toFixed(2) }));
        return;
      }
      if (numValue < 1) {
        setFormData((prev) => ({ ...prev, [name]: "1" }));
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleApprove = async () => {
    if (
      !formData.collateralToken ||
      !formData.collateralAmount ||
      !selectedNFT?.strataxProxy
    ) {
      return;
    }

    setApproving(true);
    try {
      const tokenContract = new ethers.Contract(
        formData.collateralToken,
        ["function approve(address spender, uint256 amount) returns (bool)"],
        await provider.getSigner(),
      );

      const amount = ethers.parseUnits(
        formData.collateralAmount,
        tokenInfo?.decimals || 18,
      );

      console.log(
        "Approving",
        amount.toString(),
        "tokens for",
        selectedNFT.strataxProxy,
      );
      const tx = await tokenContract.approve(selectedNFT.strataxProxy, amount);
      console.log("Approval transaction sent:", tx.hash);

      await tx.wait();
      console.log("Approval confirmed");

      // Recheck allowance
      setNeedsApproval(false);
      showModal(
        "success",
        "Approval Successful",
        `${tokenInfo?.symbol || "Token"} approved successfully!\n\nYou can now open your position.`,
      );
    } catch (err) {
      console.error("Approval error:", err);

      // Check if user rejected the transaction
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        showModal(
          "warning",
          "Transaction Rejected",
          "You rejected the approval transaction.",
        );
      } else {
        showModal(
          "error",
          "Approval Failed",
          err.message || "Transaction failed. Please try again.",
        );
      }
    } finally {
      setApproving(false);
    }
  };

  const handleDisabledClick = (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    const missingFields = new Set();

    if (!selectedNFT) {
      missingFields.add("nft");
    }

    // Only require collateral amount if there's no free collateral
    const hasFreeCollateral = freeCollateral && BigInt(freeCollateral) > 0n;
    if (!hasFreeCollateral && !formData.collateralAmount) {
      missingFields.add("collateralAmount");
    }

    if (missingFields.size > 0) {
      setFlashingFields(missingFields);
      // Clear flash after animation
      setTimeout(() => {
        setFlashingFields(new Set());
      }, 820); // Slightly longer than animation duration
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Get borrowToken decimals
      const borrowTokenSymbol = Object.entries(
        TOKENS[networkId || 1] || {},
      ).find(([, addr]) => addr === formData.borrowToken)?.[0];
      const borrowTokenDecimals = TOKEN_INFO[borrowTokenSymbol]?.decimals || 18;

      // Calculate parameters first
      const tradeDetails = {
        collateralToken: formData.collateralToken,
        borrowToken: formData.borrowToken,
        desiredLeverage: Math.floor(
          parseFloat(formData.desiredLeverage) * LEVERAGE_PRECISION,
        ),
        collateralAmount: ethers
          .parseUnits(formData.collateralAmount, tokenInfo?.decimals || 18)
          .toString(),
        collateralTokenPrice: 0, // Will be fetched from oracle
        borrowTokenPrice: 0, // Will be fetched from oracle
        collateralTokenDec: tokenInfo?.decimals || 18,
        borrowTokenDec: borrowTokenDecimals,
      };

      console.log("Calculating position parameters...");
      const calculatedParams = await calculateOpenParams(tradeDetails);
      console.log("Calculated params:", calculatedParams);

      // Get 1inch swap data for borrowToken -> collateralToken
      console.log("Fetching 1inch swap data...", {
        networkId,
        borrowToken: formData.borrowToken,
        collateralToken: formData.collateralToken,
        borrowAmount: calculatedParams.borrowAmount,
        strataxProxy: selectedNFT?.strataxProxy,
      });
      let oneInchSwapData = "0x";
      try {
        const swapData = await get1inchSwapData(
          networkId,
          formData.borrowToken,
          formData.collateralToken,
          calculatedParams.borrowAmount,
          selectedNFT?.strataxProxy, // Use Stratax proxy as the from address, not user wallet
          formData.slippage, // Pass slippage from form
        );
        oneInchSwapData = swapData.data;
        console.log("1inch swap data obtained:", swapData);
      } catch (error) {
        console.error("Failed to get 1inch swap data:", error);
        const errorMsg = error.message || "Unknown error";
        const unsupportedNetworks = [1996, 31337]; // Tenderly, Anvil

        if (unsupportedNetworks.includes(networkId)) {
          showModal(
            "error",
            "1inch API Error",
            `Failed to get swap data from 1inch.\n\nError: ${errorMsg}\n\nNote: Network ${networkId} may not be supported by 1inch. For testing on fork/local networks, you may need to use mainnet or a supported testnet.`,
          );
        } else {
          showModal(
            "error",
            "1inch API Error",
            `Failed to get swap data from 1inch.\n\nError: ${errorMsg}\n\nPlease check:\n- Token addresses are correct\n- Swap amount is valid\n- Network is supported by 1inch`,
          );
        }
        return;
      }

      // Calculate minReturnAmount as 95% of flashLoanAmount using ethers
      const flashLoanAmountBN = ethers.getBigInt(
        calculatedParams.flashLoanAmount,
      );
      const minReturnAmount =
        (flashLoanAmountBN * ethers.getBigInt(950)) / ethers.getBigInt(1000);

      // Create position with calculated parameters
      const params = {
        flashLoanToken: formData.collateralToken,
        flashLoanAmount: calculatedParams.flashLoanAmount,
        collateralAmount: ethers
          .parseUnits(formData.collateralAmount, tokenInfo?.decimals || 18)
          .toString(),
        borrowToken: formData.borrowToken,
        borrowAmount: calculatedParams.borrowAmount,
        oneInchSwapData: oneInchSwapData,
        minReturnAmount: minReturnAmount.toString(),
      };

      console.log("Creating position with params:", params);
      const receipt = await createLeveragedPosition(params);
      console.log("Transaction receipt:", receipt);

      showModal(
        "success",
        "Position Opened Successfully!",
        `Your leveraged position has been created successfully.\n\nLeverage: ${formData.desiredLeverage}x`,
        receipt.transactionHash || receipt.hash,
      );

      // Reset form
      setFormData({
        collateralToken: "",
        collateralAmount: "",
        borrowToken: "",
        positionType: "long",
        desiredLeverage: "2",
        oneInchSwapData: "0x",
        slippage: "1",
      });
      setCalculatedParams(null);
    } catch (err) {
      console.error("Transaction error:", err);

      // Check if user rejected the transaction
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        showModal(
          "warning",
          "Transaction Rejected",
          "You rejected the transaction.",
        );
      } else if (err.message?.includes("insufficient funds")) {
        showModal(
          "error",
          "Insufficient Funds",
          "You don't have enough funds to complete this transaction.\n\nPlease check your wallet balance and gas fees.",
        );
      } else {
        showModal(
          "error",
          "Transaction Failed",
          err.reason || err.message || "Transaction failed. Please try again.",
        );
      }
    }
  };

  return (
    <div className="create-position">
      <h2>Open Position</h2>

      {selectedPosition && (
        <div className="selected-position-info">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <p>
                <strong>Managing Position:</strong>
              </p>
              <p>
                Current Collateral:{" "}
                {selectedPosition.collateralAmount?.toFixed(4)}{" "}
                {selectedPosition.collateralToken}
              </p>
              <p>Current Leverage: {selectedPosition.leverage}</p>
              <p className="info-text">
                Add more collateral to increase your position size.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={onClearSelection}
              style={{ marginLeft: "1rem", flexShrink: 0 }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* NFT Selection - Required */}
        <div className="form-group">
          <label>
            Select Position NFT <span className="required">*</span>
          </label>
          <select
            value={selectedNFT?.tokenId || ""}
            onChange={(e) => {
              const nft = availableNFTs.find(
                (n) => n.tokenId === e.target.value,
              );
              setSelectedNFT(nft || null);
            }}
            required
            disabled={loadingNFTs || availableNFTs.length === 0}
            className={flashingFields.has("nft") ? "flash-error" : ""}
          >
            <option value="">
              {loadingNFTs
                ? "Loading NFTs..."
                : availableNFTs.length === 0
                  ? "No minted NFTs found"
                  : "Select an NFT"}
            </option>
            {availableNFTs.map((nft) => (
              <option key={nft.tokenId} value={nft.tokenId}>
                {nft.display}
              </option>
            ))}
          </select>
          <small className="form-hint">
            You must select a minted position NFT to open a position.
            {availableNFTs.length === 0 &&
              !loadingNFTs &&
              " Go to the Mint Position NFT tab to create one."}
          </small>
        </div>

        {/* Position Direction Display */}
        {selectedNFT &&
          (() => {
            const directionLabel = getPositionDirectionLabel(
              selectedNFT.collateralToken,
              selectedNFT.borrowToken,
            );
            return directionLabel ? (
              <div className="form-group">
                <div className="position-direction-display">
                  <span className={`direction-label ${directionLabel.type}`}>
                    {directionLabel.text}
                  </span>
                  <span className="token-pair">
                    {selectedNFT.collateralToken} → {selectedNFT.borrowToken}
                  </span>
                </div>
              </div>
            ) : null;
          })()}

        <div className="form-group">
          <label>
            Collateral Amount
            {freeCollateral !== null && tokenInfo && (
              <span
                style={{
                  color: BigInt(freeCollateral) > 0n ? "#22c55e" : "#a8b3cf",
                  fontSize: "0.85rem",
                  marginLeft: "0.5rem",
                }}
              >
                ({BigInt(freeCollateral) > 0n ? "optional - using" : ""} free
                collateral:{" "}
                {ethers
                  .formatUnits(freeCollateral, tokenInfo?.decimals || 18)
                  .substring(0, 8)}{" "}
                {tokenInfo?.symbol})
              </span>
            )}
          </label>
          <input
            type="number"
            name="collateralAmount"
            value={formData.collateralAmount}
            onChange={handleInputChange}
            placeholder={
              freeCollateral && BigInt(freeCollateral) > 0n
                ? "0.0 (optional)"
                : "0.0"
            }
            step="any"
            required={!(freeCollateral && BigInt(freeCollateral) > 0n)}
            className={
              flashingFields.has("collateralAmount") ? "flash-error" : ""
            }
          />
          {tokenInfo && tokenBalance && (
            <small className="form-hint">
              Balance: {tokenBalance?.formatted || "0"} {tokenInfo.symbol}
            </small>
          )}
        </div>

        <div className="form-group">
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span>Desired Leverage:</span>
            <input
              type="number"
              name="desiredLeverage"
              value={formData.desiredLeverage}
              onChange={handleInputChange}
              min="1"
              max={maxLeverage ? maxLeverage.toFixed(2) : "5.00"}
              step="0.01"
              style={{
                width: "70px",
                padding: "4px 8px",
                fontSize: "14px",
                textAlign: "center",
              }}
            />
            <span>x</span>
            {maxLeverage && (
              <span style={{ fontSize: "14px", color: "#a8b3cf" }}>
                (Max: {maxLeverage.toFixed(2)}x)
              </span>
            )}
          </label>
          <input
            type="range"
            name="desiredLeverage"
            value={formData.desiredLeverage}
            onChange={handleInputChange}
            min="1"
            max={maxLeverage ? maxLeverage.toFixed(2) : "5.00"}
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label>Slippage Tolerance (%)</label>
          <input
            type="number"
            name="slippage"
            value={formData.slippage}
            onChange={handleInputChange}
            placeholder="1"
            min="0.1"
            max="50"
            step="0.1"
          />
          <small className="form-hint">
            Maximum price slippage allowed for the 1inch swap. Default is 1%.
          </small>
        </div>

        <div className="button-group">
          <div
            onClick={(e) => {
              const hasFreeCollateral =
                freeCollateral && BigInt(freeCollateral) > 0n;
              const isDisabled =
                account &&
                (loading ||
                  approving ||
                  checkingApproval ||
                  !selectedNFT ||
                  (!hasFreeCollateral && !formData.collateralAmount));

              if (isDisabled) {
                e.preventDefault();
                e.stopPropagation();
                handleDisabledClick(e);
              }
            }}
            style={{ width: "100%", cursor: "pointer" }}
          >
            <button
              type={account && !needsApproval ? "submit" : "button"}
              className="btn btn-primary"
              onClick={(e) => {
                if (!account) {
                  e.preventDefault();
                  connectWallet();
                } else if (needsApproval) {
                  e.preventDefault();
                  handleApprove();
                }
              }}
              disabled={
                account &&
                (loading ||
                  approving ||
                  checkingApproval ||
                  !selectedNFT ||
                  (freeCollateral && BigInt(freeCollateral) > 0n
                    ? false
                    : !formData.collateralAmount))
              }
              style={{ width: "100%" }}
            >
              {!account
                ? "Connect Wallet"
                : approving
                  ? "Approving..."
                  : checkingApproval
                    ? "Checking Approval..."
                    : needsApproval
                      ? `Approve ${tokenInfo?.symbol || "Collateral"}`
                      : loading
                        ? "Opening Position..."
                        : "Open Position"}
            </button>
          </div>
        </div>

        {/* Order Details */}
        {account &&
          formData.collateralToken &&
          formData.borrowToken &&
          formData.collateralAmount && (
            <div className="order-details">
              <div className="details-header">
                <h3>Position Details</h3>
              </div>
              <div className="details-row">
                <span className="details-label">Leverage</span>
                <span className="details-value">
                  {formData.desiredLeverage}x
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Collateral</span>
                <span className="details-value">
                  {formData.collateralAmount}{" "}
                  {Object.entries(TOKENS[networkId || 1] || {}).find(
                    ([, addr]) => addr === formData.collateralToken,
                  )?.[0] || ""}
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Borrow Asset</span>
                <span className="details-value">
                  {Object.entries(TOKENS[networkId || 1] || {}).find(
                    ([, addr]) => addr === formData.borrowToken,
                  )?.[0] || ""}
                </span>
              </div>
              {maxLeverage && (
                <div className="details-row">
                  <span className="details-label">Max Leverage</span>
                  <span className="details-value">
                    {maxLeverage.toFixed(2)}x
                  </span>
                </div>
              )}
              {calculatedParams && (
                <>
                  <div className="details-divider"></div>
                  <div className="details-row">
                    <span className="details-label">
                      Estimated Borrow Amount
                    </span>
                    <span className="details-value">
                      {ethers
                        .formatUnits(
                          calculatedParams.borrowAmount,
                          TOKEN_INFO[
                            Object.entries(TOKENS[networkId || 1] || {}).find(
                              ([, addr]) => addr === formData.borrowToken,
                            )?.[0]
                          ]?.decimals || 18,
                        )
                        .substring(0, 8)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
      </form>

      <TransactionModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        txHash={modal.txHash}
      />
    </div>
  );
};

export default CreatePosition;
