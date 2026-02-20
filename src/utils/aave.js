// Aave GraphQL API integration for fetching protocol positions
import { ethers } from "ethers";

/**
 * Aave contract addresses by chain ID
 */
const AAVE_CONTRACTS = {
  1: {
    // Ethereum Mainnet
    pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    dataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3",
    oracle: "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
  },
  // Add other chains as needed
};

/**
 * Aave Pool ABI (minimal - only functions we need)
 */
const AAVE_POOL_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserAccountData",
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Aave Protocol Data Provider ABI
 */
const AAVE_DATA_PROVIDER_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getAllUserReserves",
    outputs: [
      {
        components: [
          { name: "underlyingAsset", type: "address" },
          { name: "scaledATokenBalance", type: "uint256" },
          { name: "usageAsCollateralEnabledOnUser", type: "bool" },
          { name: "stableBorrowRate", type: "uint256" },
          { name: "scaledVariableDebt", type: "uint256" },
          { name: "principalStableDebt", type: "uint256" },
          { name: "stableBorrowLastUpdateTimestamp", type: "uint256" },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveTokensAddresses",
    outputs: [
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveConfigurationData",
    outputs: [
      { name: "decimals", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "liquidationBonus", type: "uint256" },
      { name: "reserveFactor", type: "uint256" },
      { name: "usageAsCollateralEnabled", type: "bool" },
      { name: "borrowingEnabled", type: "bool" },
      { name: "stableBorrowRateEnabled", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "isFrozen", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * ERC20 ABI for token info
 */
const ERC20_ABI_MINIMAL = [
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
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

/**
 * Aave GraphQL endpoints by chain ID
 */
const AAVE_GRAPHQL_ENDPOINTS = {
  1: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3", // Ethereum
  137: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon", // Polygon
  8453: "https://api.studio.thegraph.com/query/24660/aave-v3-base/version/latest", // Base
  42161: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum", // Arbitrum
  10: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism", // Optimism
  43114: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche", // Avalanche
};

/**
 * Check if a token is a stablecoin
 * @param {string} symbol - Token symbol
 * @returns {boolean} True if stablecoin
 */
const isStablecoin = (symbol) => {
  const stablecoins = [
    "USDC",
    "USDT",
    "DAI",
    "BUSD",
    "FRAX",
    "TUSD",
    "USDP",
    "GUSD",
    "LUSD",
    "sUSD",
    "UST",
    "USDD",
  ];
  return stablecoins.includes(symbol?.toUpperCase());
};

/**
 * Determine position direction (long/short/neutral)
 * @param {string} collateralToken - Collateral token symbol
 * @param {string} borrowToken - Borrowed token symbol
 * @returns {object} Position direction info
 */
const getPositionDirection = (collateralToken, borrowToken) => {
  if (!collateralToken || !borrowToken) {
    return { direction: "neutral", description: "No position" };
  }

  const collateralIsStable = isStablecoin(collateralToken);
  const borrowIsStable = isStablecoin(borrowToken);

  if (collateralIsStable && !borrowIsStable) {
    // Deposited stablecoin, borrowed volatile = SHORT the borrowed asset
    return {
      direction: "short",
      description: `Short ${borrowToken}`,
      asset: borrowToken,
    };
  } else if (!collateralIsStable && borrowIsStable) {
    // Deposited volatile, borrowed stablecoin = LONG the deposited asset
    return {
      direction: "long",
      description: `Long ${collateralToken}`,
      asset: collateralToken,
    };
  } else if (!collateralIsStable && !borrowIsStable) {
    // Both volatile = SHORT the borrowed asset (pair trading)
    return {
      direction: "short",
      description: `Short ${borrowToken}`,
      asset: borrowToken,
    };
  } else {
    // Both stablecoins = neutral
    return {
      direction: "neutral",
      description: "Neutral",
    };
  }
};

/**
 * Fetch Aave positions for an array of addresses using GraphQL
 * @param {string[]} addresses - Array of wallet/contract addresses
 * @param {number} chainId - The chain ID (e.g., 1 for Ethereum, 137 for Polygon)
 * @returns {Promise<Object[]>} Array of position objects
 */
export const fetchAavePositions = async (addresses, chainId) => {
  const endpoint = AAVE_GRAPHQL_ENDPOINTS[chainId];

  if (!endpoint) {
    throw new Error(
      `Aave GraphQL endpoint not configured for chain ID ${chainId}`,
    );
  }

  if (!addresses || addresses.length === 0) {
    return [];
  }

  // Convert addresses to lowercase for GraphQL query
  const lowerCaseAddresses = addresses.map((addr) => addr.toLowerCase());

  // GraphQL query to fetch user accounts with their positions
  const query = `
    query GetUserPositions($addresses: [String!]!) {
      users(where: { id_in: $addresses }) {
        id
        reserves {
          id
          currentATokenBalance
          currentVariableDebt
          currentStableDebt
          reserve {
            id
            symbol
            name
            decimals
            underlyingAsset
            priceInMarketReferenceCurrency
            lastUpdateTimestamp
          }
        }
      }
      priceOracle(id: "1") {
        usdPriceEth
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          addresses: lowerCaseAddresses,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Aave GraphQL API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(
        `Aave GraphQL query error: ${JSON.stringify(data.errors)}`,
      );
    }

    return parseAavePositions(data.data, chainId);
  } catch (error) {
    console.error("Error fetching Aave positions:", error);
    throw error;
  }
};

/**
 * Parse Aave position data from GraphQL response
 * @param {Object} data - GraphQL response data
 * @param {number} chainId - Chain ID
 * @returns {Array} Parsed positions
 */
const parseAavePositions = (data, chainId) => {
  const positions = [];

  if (!data.users || data.users.length === 0) {
    return positions;
  }

  // Get ETH/USD price for conversions
  const ethPriceUSD = data.priceOracle?.usdPriceEth
    ? parseFloat(data.priceOracle.usdPriceEth)
    : 0;

  data.users.forEach((user) => {
    const userAddress = user.id;

    // Separate collateral and debt reserves
    const collateralReserves = [];
    const debtReserves = [];

    user.reserves.forEach((userReserve) => {
      const balance = parseFloat(userReserve.currentATokenBalance);
      const variableDebt = parseFloat(userReserve.currentVariableDebt);
      const stableDebt = parseFloat(userReserve.currentStableDebt);
      const totalDebt = variableDebt + stableDebt;

      const reserve = userReserve.reserve;
      const decimals = parseInt(reserve.decimals);
      const symbol = reserve.symbol;
      const priceInEth =
        parseFloat(reserve.priceInMarketReferenceCurrency) / 1e18;

      // Calculate USD price (price in ETH * ETH price in USD)
      const priceUSD = priceInEth * ethPriceUSD;

      if (balance > 0) {
        const actualBalance = balance / Math.pow(10, decimals);
        collateralReserves.push({
          symbol,
          amount: actualBalance,
          valueUSD: actualBalance * priceUSD,
          reserve,
        });
      }

      if (totalDebt > 0) {
        const actualDebt = totalDebt / Math.pow(10, decimals);
        debtReserves.push({
          symbol,
          amount: actualDebt,
          valueUSD: actualDebt * priceUSD,
          reserve,
        });
      }
    });

    // Create position objects for each collateral-debt combination
    // If user has multiple collaterals and debts, we'll create primary position
    if (collateralReserves.length > 0 || debtReserves.length > 0) {
      // Sort by value to get primary assets
      collateralReserves.sort((a, b) => b.valueUSD - a.valueUSD);
      debtReserves.sort((a, b) => b.valueUSD - a.valueUSD);

      const primaryCollateral = collateralReserves[0] || null;
      const primaryDebt = debtReserves[0] || null;

      const totalCollateralValue = collateralReserves.reduce(
        (sum, r) => sum + r.valueUSD,
        0,
      );
      const totalDebtValue = debtReserves.reduce(
        (sum, r) => sum + r.valueUSD,
        0,
      );

      // Calculate leverage: (Collateral Value) / (Collateral Value - Debt Value)
      const equity = totalCollateralValue - totalDebtValue;
      const leverage = equity > 0 ? totalCollateralValue / equity : 0;

      // Calculate health factor (simplified)
      // Real health factor requires liquidation thresholds, this is an approximation
      const healthFactor =
        totalDebtValue > 0
          ? (totalCollateralValue * 0.8) / totalDebtValue
          : 999;

      const direction = getPositionDirection(
        primaryCollateral?.symbol,
        primaryDebt?.symbol,
      );

      positions.push({
        id: `${userAddress}-${chainId}`,
        userAddress,
        chainId,
        collateralToken: primaryCollateral?.symbol || "N/A",
        collateralAmount: primaryCollateral?.amount || 0,
        collateralValue: totalCollateralValue,
        borrowToken: primaryDebt?.symbol || "N/A",
        debtAmount: primaryDebt?.amount || 0,
        debtValue: totalDebtValue,
        leverage: leverage > 0 ? `${leverage.toFixed(2)}x` : "0x",
        healthFactor: healthFactor,
        direction: direction.direction,
        directionDescription: direction.description,
        status: healthFactor < 1.5 ? "warning" : "active",
        allCollateral: collateralReserves,
        allDebt: debtReserves,
      });
    }
  });

  return positions;
};

/**
 * Fetch Aave positions for a single Stratax contract address
 * @param {string} strataxAddress - The Stratax contract address
 * @param {number} chainId - The chain ID
 * @returns {Promise<Object[]>} Array of position objects
 */
export const fetchStrataxAavePositions = async (strataxAddress, chainId) => {
  if (!strataxAddress) {
    console.warn("Stratax contract address is required");
    return [];
  }

  return fetchAavePositions([strataxAddress], chainId);
};

/**
 * Check if Aave is supported on the given chain
 * @param {number} chainId - The chain ID
 * @returns {boolean} True if Aave is supported
 */
export const isAaveSupported = (chainId) => {
  return !!AAVE_GRAPHQL_ENDPOINTS[chainId];
};

/**
 * Get the list of supported Aave chain IDs
 * @returns {number[]} Array of supported chain IDs
 */
export const getSupportedAaveChains = () => {
  return Object.keys(AAVE_GRAPHQL_ENDPOINTS).map(Number);
};

/**
 * Fetch Aave positions directly from blockchain using RPC calls
 * Use this for testnets (Anvil, Tenderly) where GraphQL is not available
 * @param {string[]} addresses - Array of wallet/contract addresses
 * @param {number} chainId - The chain ID
 * @param {Object} provider - ethers.js provider
 * @returns {Promise<Object[]>} Array of position objects
 */
export const fetchAavePositionsFromRPC = async (
  addresses,
  chainId,
  provider,
) => {
  console.log("Fetching Aave positions from RPC for addresses:", addresses);

  if (!addresses || addresses.length === 0) {
    return [];
  }

  if (!provider) {
    throw new Error("Provider is required for RPC queries");
  }

  // For forks/testnets, use mainnet contract addresses (chainId 1)
  const contractAddresses = AAVE_CONTRACTS[1] || AAVE_CONTRACTS[chainId];

  if (!contractAddresses) {
    throw new Error(
      `Aave contracts not configured for chain ID ${chainId}. Using direct RPC requires contract addresses.`,
    );
  }

  const positions = [];

  try {
    const poolContract = new ethers.Contract(
      contractAddresses.pool,
      AAVE_POOL_ABI,
      provider,
    );

    const dataProviderContract = new ethers.Contract(
      contractAddresses.dataProvider,
      AAVE_DATA_PROVIDER_ABI,
      provider,
    );

    for (const address of addresses) {
      try {
        console.log(`Querying Aave position for ${address}...`);

        // Get account data
        const accountData = await poolContract.getUserAccountData(address);
        console.log(`Account data for ${address}:`, {
          totalCollateralBase: accountData.totalCollateralBase.toString(),
          totalDebtBase: accountData.totalDebtBase.toString(),
          healthFactor: accountData.healthFactor.toString(),
        });

        // Get all user reserves
        const userReserves =
          await dataProviderContract.getAllUserReserves(address);
        console.log(`Found ${userReserves.length} reserves for ${address}`);

        if (userReserves.length === 0) {
          console.log(`No reserves found for ${address}`);
          continue;
        }

        const collateralReserves = [];
        const debtReserves = [];

        // Process each reserve
        for (const reserve of userReserves) {
          try {
            const assetAddress = reserve.underlyingAsset;

            // Get reserve token addresses
            const tokenAddresses =
              await dataProviderContract.getReserveTokensAddresses(
                assetAddress,
              );

            // Get asset info
            const assetContract = new ethers.Contract(
              assetAddress,
              ERC20_ABI_MINIMAL,
              provider,
            );

            const [symbol, decimals, aTokenBalance, variableDebtBalance] =
              await Promise.all([
                assetContract.symbol(),
                assetContract.decimals(),
                // Get aToken balance
                new ethers.Contract(
                  tokenAddresses.aTokenAddress,
                  ERC20_ABI_MINIMAL,
                  provider,
                ).balanceOf(address),
                // Get variable debt balance
                new ethers.Contract(
                  tokenAddresses.variableDebtTokenAddress,
                  ERC20_ABI_MINIMAL,
                  provider,
                ).balanceOf(address),
              ]);

            const actualBalance =
              parseFloat(ethers.formatUnits(aTokenBalance, decimals)) || 0;
            const actualDebt =
              parseFloat(ethers.formatUnits(variableDebtBalance, decimals)) ||
              0;

            console.log(
              `  ${symbol}: balance=${actualBalance}, debt=${actualDebt}`,
            );

            if (actualBalance > 0) {
              collateralReserves.push({
                symbol,
                amount: actualBalance,
                valueUSD: 0, // Price oracle not implemented yet
                asset: assetAddress,
              });
            }

            if (actualDebt > 0) {
              debtReserves.push({
                symbol,
                amount: actualDebt,
                valueUSD: 0, // Price oracle not implemented yet
                asset: assetAddress,
              });
            }
          } catch (assetError) {
            console.error(
              `Error processing asset ${reserve.underlyingAsset}:`,
              assetError,
            );
          }
        }

        // Create position if there's collateral or debt
        if (collateralReserves.length > 0 || debtReserves.length > 0) {
          const primaryCollateral = collateralReserves[0] || null;
          const primaryDebt = debtReserves[0] || null;

          // Convert health factor from contract (18 decimals)
          const healthFactor = parseFloat(
            ethers.formatUnits(accountData.healthFactor, 18),
          );

          // Calculate approximate leverage from collateral/debt
          const totalCollateralBase = parseFloat(
            ethers.formatUnits(accountData.totalCollateralBase, 8),
          ); // Base currency usually 8 decimals
          const totalDebtBase = parseFloat(
            ethers.formatUnits(accountData.totalDebtBase, 8),
          );

          const equity =
            totalCollateralBase > 0 ? totalCollateralBase - totalDebtBase : 0;
          const leverage =
            equity > 0 && totalCollateralBase > 0
              ? totalCollateralBase / equity
              : 0;

          const direction = getPositionDirection(
            primaryCollateral?.symbol,
            primaryDebt?.symbol,
          );

          positions.push({
            id: `${address}-${chainId}`,
            userAddress: address,
            chainId,
            collateralToken: primaryCollateral?.symbol || "N/A",
            collateralAmount: primaryCollateral?.amount || 0,
            collateralValue: totalCollateralBase,
            borrowToken: primaryDebt?.symbol || "N/A",
            debtAmount: primaryDebt?.amount || 0,
            debtValue: totalDebtBase,
            leverage: leverage > 0 ? `${leverage.toFixed(2)}x` : "0x",
            healthFactor: healthFactor,
            direction: direction.direction,
            directionDescription: direction.description,
            status: healthFactor < 1.5 ? "warning" : "active",
            allCollateral: collateralReserves,
            allDebt: debtReserves,
            source: "RPC", // Mark as RPC-sourced
          });

          console.log(`✓ Position created for ${address}`);
        }
      } catch (addressError) {
        console.error(`Error fetching position for ${address}:`, addressError);
      }
    }

    return positions;
  } catch (error) {
    console.error("Error fetching Aave positions from RPC:", error);
    throw error;
  }
};

/**
 * Fetch Aave positions using the appropriate method based on network
 * Automatically uses GraphQL for production or RPC for testnets
 * @param {string[]} addresses - Array of wallet/contract addresses
 * @param {number} chainId - The chain ID
 * @param {Object} provider - ethers.js provider (required for testnets)
 * @returns {Promise<Object[]>} Array of position objects
 */
export const fetchAavePositionsAuto = async (addresses, chainId, provider) => {
  const isTestnet = chainId === 31337 || chainId === 11155111;

  if (isTestnet || !isAaveSupported(chainId)) {
    console.log(
      `Using RPC method for chain ${chainId} (testnet or unsupported by GraphQL)`,
    );
    return fetchAavePositionsFromRPC(addresses, chainId, provider);
  } else {
    console.log(`Using GraphQL method for chain ${chainId} (production)`);
    return fetchAavePositions(addresses, chainId);
  }
};
