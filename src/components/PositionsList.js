import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { fetchAavePositionsAuto } from "../utils/aave";
import { CONTRACTS, TOKENS } from "../config/contracts";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import "./PositionsList.css";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

const PositionsList = ({
  onManagePosition,
  onUnwindPosition,
  refreshTrigger,
}) => {
  const { account, chainId, provider } = useWeb3();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Helper function to get token symbol from address
  const getTokenSymbol = (tokenAddress) => {
    if (!tokenAddress || !chainId) {
      console.log("getTokenSymbol: missing address or chainId", {
        tokenAddress,
        chainId,
      });
      return "N/A";
    }

    const networkTokens = TOKENS[chainId] || {};
    const address = tokenAddress.toLowerCase();

    console.log("Looking up token:", {
      address,
      chainId,
      availableTokens: Object.entries(networkTokens).map(([sym, addr]) => ({
        sym,
        addr,
      })),
    });

    // Find token symbol by comparing addresses
    for (const [symbol, addr] of Object.entries(networkTokens)) {
      if (addr.toLowerCase() === address) {
        console.log(`Found match: ${symbol} for ${address}`);
        return symbol;
      }
    }

    console.log(`No match found for ${address}`);
    return "N/A";
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
      collateralToken === "N/A" ||
      borrowToken === "N/A"
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

  const fetchPositions = async () => {
    if (!account || !provider) return;

    const network = await provider.getNetwork();
    console.log("===== FETCHING POSITIONS =====");
    console.log("Network:", {
      chainId: network.chainId ? network.chainId.toString() : "unknown",
      name: network.name,
    });
    console.log("Account:", account);
    console.log("NFT Contract:", CONTRACTS.STRATAX_POSITION_NFT);
    console.log("==============================");

    setLoading(true);
    setError(null);
    try {
      // Check if NFT contract address is configured
      if (
        !CONTRACTS.STRATAX_POSITION_NFT ||
        CONTRACTS.STRATAX_POSITION_NFT ===
          "0x0000000000000000000000000000000000000000"
      ) {
        setError(
          "NFT contract address not configured. Please update CONTRACTS.STRATAX_POSITION_NFT in contracts.js",
        );
        return;
      }

      // Create contract instance for NFT contract
      const nftContract = new ethers.Contract(
        CONTRACTS.STRATAX_POSITION_NFT,
        STRATAX_POSITION_NFT_ABI,
        provider,
      );

      // Check if contract exists
      const code = await provider.getCode(CONTRACTS.STRATAX_POSITION_NFT);
      if (code === "0x") {
        console.error(
          "NFT contract not found at:",
          CONTRACTS.STRATAX_POSITION_NFT,
        );
        setError(
          `NFT contract not deployed at ${CONTRACTS.STRATAX_POSITION_NFT}`,
        );
        return;
      }
      console.log("NFT contract verified at:", CONTRACTS.STRATAX_POSITION_NFT);

      // Check user's NFT balance first
      try {
        const balance = await nftContract.balanceOf(account);
        console.log("User NFT balance:", balance?.toString() || "0");

        if (balance === 0n) {
          console.log("User has no NFTs");
          setPositions([]);
          setLastUpdate(new Date());
          return;
        }
      } catch (balanceError) {
        console.error("Error checking NFT balance:", balanceError);
      }

      // Get user's positions from NFT contract
      console.log("Fetching positions for account:", account);
      console.log("Using NFT contract:", CONTRACTS.STRATAX_POSITION_NFT);

      console.log("Calling getPositionsByOwner for account:", account);

      let tokenIds, positionList;
      try {
        [tokenIds, positionList] =
          await nftContract.getPositionsByOwner(account);
        console.log("Raw getPositionsByOwner result:", {
          tokenIds,
          positionList,
        });
      } catch (error) {
        console.error("Error calling getPositionsByOwner:", error);
        throw error;
      }

      console.log("User positions from NFT:", {
        count: tokenIds.length,
        tokenIds: tokenIds.map((id) => id?.toString() || "unknown"),
        positions: positionList.map((pos) => ({
          collateralToken: pos.collateralToken,
          borrowToken: pos.borrowToken,
          strataxProxy: pos.strataxProxy,
          createdAt: pos.createdAt?.toString() || "0",
          lastModifiedAt: pos.lastModifiedAt?.toString() || "0",
          isActive: pos.isActive,
        })),
      });

      if (tokenIds.length === 0) {
        console.log("No positions found for this account");
        setPositions([]);
        setLastUpdate(new Date());
        return;
      }

      console.log(`Found ${tokenIds.length} NFT positions`);

      // Extract Stratax proxy addresses from active positions
      const activePositions = positionList.filter((pos) => pos.isActive);
      const strataxProxyAddresses = activePositions.map(
        (pos) => pos.strataxProxy,
      );

      console.log("Active Stratax proxy addresses:", strataxProxyAddresses);

      let enhancedPositions = [];

      // Handle active positions (with Aave data)
      if (strataxProxyAddresses.length > 0) {
        // Fetch Aave positions for all active Stratax proxy contracts
        // Automatically uses GraphQL for production or RPC for testnets
        const aavePositions = await fetchAavePositionsAuto(
          strataxProxyAddresses,
          chainId,
          provider,
        );

        console.log("Aave positions fetched:", {
          count: aavePositions.length,
          positions: aavePositions.map((p) => ({
            userAddress: p.userAddress,
            collateralToken: p.collateralToken,
            collateralAmount: p.collateralAmount,
            collateralValue: p.collateralValue,
            borrowToken: p.borrowToken,
            debtAmount: p.debtAmount,
            debtValue: p.debtValue,
            leverage: p.leverage,
            healthFactor: p.healthFactor,
          })),
        });

        // Track which active positions have Aave data
        const fundedProxyAddresses = new Set(
          aavePositions.map((p) => p.userAddress.toLowerCase()),
        );

        // Enhance Aave positions with NFT metadata
        enhancedPositions = aavePositions.map((aavePos) => {
          // Find matching NFT position by strataxProxy address
          const nftPosIndex = positionList.findIndex(
            (pos) =>
              pos.strataxProxy.toLowerCase() ===
              aavePos.userAddress.toLowerCase(),
          );

          if (nftPosIndex >= 0) {
            const nftPos = positionList[nftPosIndex];
            const enhanced = {
              ...aavePos,
              tokenId: tokenIds[nftPosIndex]?.toString() || "unknown",
              createdAt: new Date(Number(nftPos.createdAt || 0) * 1000),
              lastModifiedAt: new Date(
                Number(nftPos.lastModifiedAt || 0) * 1000,
              ),
              nftCollateralToken: nftPos.collateralToken,
              nftBorrowToken: nftPos.borrowToken,
              strataxProxy: nftPos.strataxProxy,
            };
            console.log(`Enhanced position for tokenId ${enhanced.tokenId}:`, {
              tokenId: enhanced.tokenId,
              strataxProxy: enhanced.strataxProxy,
              collateralToken: enhanced.collateralToken,
              borrowToken: enhanced.borrowToken,
              createdAt: enhanced.createdAt.toISOString(),
            });
            return enhanced;
          }
          console.warn(
            `No matching NFT position found for Aave position:`,
            aavePos.userAddress,
          );
          return aavePos;
        });

        // Add unfunded active positions (NFT minted but no collateral deposited)
        activePositions.forEach((pos, index) => {
          const proxyAddress = pos.strataxProxy.toLowerCase();
          if (!fundedProxyAddresses.has(proxyAddress)) {
            // Find the tokenId for this position
            const nftPosIndex = positionList.findIndex(
              (p) => p.strataxProxy.toLowerCase() === proxyAddress,
            );
            if (nftPosIndex >= 0) {
              console.log("Creating unfunded position with tokens:", {
                collateralAddress: pos.collateralToken,
                borrowAddress: pos.borrowToken,
                collateralSymbol: getTokenSymbol(pos.collateralToken),
                borrowSymbol: getTokenSymbol(pos.borrowToken),
              });

              const unfundedPosition = {
                id: `unfunded-${tokenIds[nftPosIndex]?.toString() || "unknown"}`,
                tokenId: tokenIds[nftPosIndex]?.toString() || "unknown",
                collateralToken: getTokenSymbol(pos.collateralToken),
                borrowToken: getTokenSymbol(pos.borrowToken),
                nftCollateralToken: pos.collateralToken,
                nftBorrowToken: pos.borrowToken,
                strataxProxy: pos.strataxProxy,
                collateralAmount: 0,
                collateralValue: 0,
                debtAmount: 0,
                debtValue: 0,
                leverage: "0x",
                healthFactor: 0,
                status: "unfunded",
                createdAt: new Date(Number(pos.createdAt || 0) * 1000),
                lastModifiedAt: new Date(
                  Number(pos.lastModifiedAt || 0) * 1000,
                ),
                isUnfunded: true,
              };
              console.log(
                `Found unfunded position: tokenId ${unfundedPosition.tokenId}`,
              );
              enhancedPositions.push(unfundedPosition);
            }
          }
        });
      }

      // Add inactive positions (minted but not opened)
      const inactivePositions = positionList
        .map((pos, index) => {
          if (!pos.isActive) {
            return {
              id: `inactive-${tokenIds[index]?.toString() || "unknown"}`,
              tokenId: tokenIds[index]?.toString() || "unknown",
              collateralToken: getTokenSymbol(pos.collateralToken),
              borrowToken: getTokenSymbol(pos.borrowToken),
              nftCollateralToken: pos.collateralToken,
              nftBorrowToken: pos.borrowToken,
              strataxProxy: pos.strataxProxy,
              collateralAmount: 0,
              collateralValue: 0,
              debtAmount: 0,
              debtValue: 0,
              leverage: "0x",
              healthFactor: 0,
              status: "inactive",
              createdAt: new Date(Number(pos.createdAt || 0) * 1000),
              lastModifiedAt: new Date(Number(pos.lastModifiedAt || 0) * 1000),
              isInactive: true,
            };
          }
          return null;
        })
        .filter((pos) => pos !== null);

      const allPositions = [...enhancedPositions, ...inactivePositions];

      // Count position types for logging
      const fundedCount = enhancedPositions.filter((p) => !p.isUnfunded).length;
      const unfundedCount = enhancedPositions.filter(
        (p) => p.isUnfunded,
      ).length;
      const inactiveCount = inactivePositions.length;

      console.log(
        `Total positions: ${allPositions.length} (${fundedCount} funded, ${unfundedCount} unfunded, ${inactiveCount} inactive)`,
      );
      setPositions(allPositions);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching positions:", error);
      setError(
        `Failed to load positions: ${error.message || "Please try again later."}`,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchPositions();
    };
    fetchData();
  }, [account, chainId, provider, refreshTrigger]);

  if (!account) {
    return (
      <div className="positions-list">
        <h2>Positions(0)</h2>
        <div className="empty-state">
          <p>Connect your wallet to view positions</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="positions-list">
        <h2>Positions({positions.length})</h2>
        <div className="loading-state">
          <p>Loading positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="positions-list">
        <h2>Positions({positions.length})</h2>
        <div className="error-state">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="positions-list">
      <div className="positions-header">
        <div>
          <h2>Positions({positions.length})</h2>
          {lastUpdate && (
            <small className="last-update">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </small>
          )}
        </div>
        <button
          className="btn btn-secondary btn-small"
          onClick={fetchPositions}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {positions.length === 0 ? (
        <div className="empty-state">
          <p>No open positions</p>
          <small>Create a leveraged position to get started</small>
        </div>
      ) : (
        <div className="positions-grid">
          {positions.map((position) => (
            <div
              key={position.id}
              className={`position-card ${position.isInactive || position.isUnfunded ? "inactive-position" : ""}`}
            >
              <div className="position-header">
                <div className="position-header-main">
                  {(() => {
                    const directionLabel = getPositionDirectionLabel(
                      position.collateralToken,
                      position.borrowToken,
                    );
                    return directionLabel ? (
                      <span
                        className={`position-direction-label ${directionLabel.type}`}
                      >
                        {directionLabel.text}
                      </span>
                    ) : null;
                  })()}
                  <span className="position-tokens">
                    {position.collateralToken || "N/A"} →{" "}
                    {position.borrowToken || "N/A"}
                  </span>
                </div>
                <div className="position-badges">
                  {position.tokenId && (
                    <span className="position-token-id" title="NFT Token ID">
                      #{position.tokenId}
                    </span>
                  )}
                  {(position.isInactive || position.isUnfunded) && (
                    <span className="position-status inactive">
                      {position.isUnfunded ? "Ready to Fund" : "Not Opened"}
                    </span>
                  )}
                  {!position.isInactive &&
                    !position.isUnfunded &&
                    position.directionDescription && (
                      <span
                        className={`position-direction ${position.direction}`}
                      >
                        {position.directionDescription}
                      </span>
                    )}
                  {!position.isInactive && !position.isUnfunded && (
                    <span className={`position-status ${position.status}`}>
                      {position.status}
                    </span>
                  )}
                </div>
              </div>

              {position.isInactive || position.isUnfunded ? (
                <>
                  <div className="position-details">
                    <div className="inactive-message">
                      <p>
                        <strong>
                          {position.isUnfunded
                            ? "Position NFT Ready"
                            : "Position NFT Minted"}
                        </strong>
                      </p>
                      <p>
                        {position.isUnfunded
                          ? "Your position NFT has been minted and is ready to be funded. Use the Create Position tab to deposit collateral and open your leveraged position."
                          : "This position has been minted but not yet opened with collateral. Click 'Open Position' to fund it."}
                      </p>
                    </div>
                    <div className="detail-row">
                      <span className="label">Stratax Proxy</span>
                      <span className="value" style={{ fontSize: "0.75rem" }}>
                        {position.strataxProxy
                          ? `${position.strataxProxy.slice(0, 6)}...${position.strataxProxy.slice(-4)}`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Created</span>
                      <span className="value" style={{ fontSize: "0.85rem" }}>
                        {position.createdAt
                          ? position.createdAt.toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="position-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() =>
                        onManagePosition && onManagePosition(position)
                      }
                    >
                      Fund Position
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="position-details">
                    <div className="detail-row">
                      <span className="label">Stratax Proxy</span>
                      <span className="value" style={{ fontSize: "0.75rem" }}>
                        {position.strataxProxy
                          ? `${position.strataxProxy.slice(0, 6)}...${position.strataxProxy.slice(-4)}`
                          : "N/A"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Collateral</span>
                      <span className="value">
                        {position.collateralAmount
                          ? position.collateralAmount.toFixed(4)
                          : "0"}{" "}
                        {position.collateralToken || "-"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Collateral Value</span>
                      <span className="value">
                        $
                        {position.collateralValue
                          ? position.collateralValue.toFixed(2)
                          : "0.00"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Debt</span>
                      <span className="value">
                        {position.debtAmount
                          ? position.debtAmount.toFixed(4)
                          : "0"}{" "}
                        {position.borrowToken || "-"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Debt Value</span>
                      <span className="value">
                        $
                        {position.debtValue
                          ? position.debtValue.toFixed(2)
                          : "0.00"}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span className="label">Leverage</span>
                      <span className="value">{position.leverage}</span>
                    </div>

                    {position.directionDescription && (
                      <div className="detail-row">
                        <span className="label">Position Type</span>
                        <span
                          className={`value position-direction-text ${position.direction}`}
                        >
                          {position.directionDescription}
                        </span>
                      </div>
                    )}

                    <div className="detail-row">
                      <span className="label">Health Factor</span>
                      <span
                        className={`value ${parseFloat(position.healthFactor) < 1.5 ? "warning" : ""}`}
                      >
                        {position.healthFactor
                          ? position.healthFactor.toFixed(2)
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="position-actions">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() =>
                        onManagePosition && onManagePosition(position)
                      }
                    >
                      Manage Position
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() =>
                        onUnwindPosition && onUnwindPosition(position)
                      }
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PositionsList;
