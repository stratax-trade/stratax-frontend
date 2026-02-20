import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useStrataxContract } from "../hooks/useStrataxContract";
import { TOKENS, CONTRACTS } from "../config/contracts";
import { useWeb3 } from "../context/Web3Context";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import "./UnwindPosition.css";

const UnwindPosition = ({ selectedPosition, onClearSelection }) => {
  const { networkId, account, provider } = useWeb3();

  const [selectedNFT, setSelectedNFT] = useState(null);
  const [availableNFTs, setAvailableNFTs] = useState([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  const { loading, error, unwindPosition, calculateUnwindParams } =
    useStrataxContract(selectedNFT?.strataxProxy);

  const [formData, setFormData] = useState({
    collateralToken: "",
    borrowToken: "",
    oneInchSwapData: "0x",
    minReturnAmount: "0",
  });

  // Auto-fill form when a position is selected
  useEffect(() => {
    if (selectedPosition) {
      // Look up token addresses by symbol from TOKENS config
      const networkTokens = TOKENS[networkId] || TOKENS[1] || {};
      const collateralAddress =
        networkTokens[selectedPosition.collateralToken] || "";
      const borrowAddress = selectedPosition.borrowToken
        ? networkTokens[selectedPosition.borrowToken] || ""
        : "";

      console.log("Auto-filling unwind position data:", {
        networkId,
        collateralSymbol: selectedPosition.collateralToken,
        collateralAddress,
        borrowSymbol: selectedPosition.borrowToken,
        borrowAddress,
        availableTokens: Object.keys(networkTokens),
      });

      setFormData({
        collateralToken: collateralAddress,
        borrowToken: borrowAddress,
        oneInchSwapData: "0x",
        minReturnAmount: "0",
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

        // Only show active (funded) NFTs for unwinding
        const nfts = tokenIds
          .map((tokenId, index) => {
            const pos = positionList[index];
            return {
              tokenId: tokenId.toString(),
              strataxProxy: pos.strataxProxy,
              collateralToken: getSymbol(pos.collateralToken),
              borrowToken: getSymbol(pos.borrowToken),
              isActive: pos.isActive,
              display: `NFT #${tokenId.toString()} - ${getSymbol(pos.collateralToken)} → ${getSymbol(pos.borrowToken)}`,
            };
          })
          .filter((nft) => nft.isActive); // Only funded positions can be unwound

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Calculate parameters first
      const calculatedParams = await calculateUnwindParams(
        formData.collateralToken,
        formData.borrowToken,
      );

      // Unwind position with calculated parameters
      const params = {
        collateralToken: formData.collateralToken,
        collateralToWithdraw: calculatedParams.collateralToWithdraw,
        debtToken: formData.borrowToken,
        debtAmount: calculatedParams.debtAmount,
        oneInchSwapData: formData.oneInchSwapData,
        minReturnAmount: formData.minReturnAmount || "0",
      };

      const receipt = await unwindPosition(params);
      alert("Position unwound successfully!");
      console.log("Transaction receipt:", receipt);

      // Reset form
      setFormData({
        collateralToken: "",
        borrowToken: "",
        oneInchSwapData: "0x",
        minReturnAmount: "0",
      });
    } catch (err) {
      console.error("Transaction error:", err);
    }
  };

  return (
    <div className="unwind-position">
      <h2>Unwind Position</h2>

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
                <strong>Selected Position:</strong>
              </p>
              <p>
                Collateral: {selectedPosition.collateralAmount?.toFixed(4)}{" "}
                {selectedPosition.collateralToken}
              </p>
              <p>
                Debt: {selectedPosition.debtAmount?.toFixed(4)}{" "}
                {selectedPosition.borrowToken || "None"}
              </p>
              <p>Leverage: {selectedPosition.leverage}</p>
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

      <p className="info-text">
        {selectedPosition
          ? "Review the position details and confirm to unwind."
          : "Select a position from the left to unwind it and recover your collateral."}
      </p>

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
          >
            <option value="">
              {loadingNFTs
                ? "Loading NFTs..."
                : availableNFTs.length === 0
                  ? "No funded positions found"
                  : "Select an NFT"}
            </option>
            {availableNFTs.map((nft) => (
              <option key={nft.tokenId} value={nft.tokenId}>
                {nft.display}
              </option>
            ))}
          </select>
          <small className="form-hint">
            Select a funded position to unwind.
            {availableNFTs.length === 0 &&
              !loadingNFTs &&
              " You need to open a position first using the Create Position tab."}
          </small>
        </div>

        <div className="form-group">
          <label>Minimum Return Amount (optional)</label>
          <input
            type="number"
            name="minReturnAmount"
            value={formData.minReturnAmount}
            onChange={handleInputChange}
            placeholder="0"
            step="any"
          />
        </div>

        <div className="button-group">
          <button
            type="submit"
            className="btn btn-danger"
            disabled={
              loading ||
              !selectedNFT ||
              !formData.collateralToken ||
              !formData.borrowToken
            }
          >
            {loading ? "Unwinding Position..." : "Unwind Position"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UnwindPosition;
