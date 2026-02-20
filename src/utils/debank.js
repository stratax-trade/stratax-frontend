// DeBank API integration for fetching protocol positions
const DEBANK_API_BASE = "https://pro-openapi.debank.com/v1";

/**
 * Fetch all complex protocol positions for an address
 * @param {string} address - The wallet/contract address
 * @param {string} chainId - The chain ID (e.g., 'eth', 'base', 'arbitrum')
 * @param {string} apiKey - DeBank API key (optional for basic usage)
 * @returns {Promise<Array>} Array of protocol positions
 */
export const getComplexProtocolList = async (
  address,
  chainId = "eth",
  apiKey = null,
) => {
  try {
    const url = `${DEBANK_API_BASE}/user/complex_protocol_list?id=${address}&chain_id=${chainId}`;

    const headers = {
      accept: "application/json",
    };

    if (apiKey) {
      headers["AccessKey"] = apiKey;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(
        `DeBank API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching DeBank positions:", error);
    throw error;
  }
};

/**
 * Filter Aave positions from protocol list
 * @param {Array} protocols - Array of protocol positions
 * @returns {Array} Filtered Aave positions
 */
export const filterAavePositions = (protocols) => {
  if (!protocols || !Array.isArray(protocols)) {
    return [];
  }

  return protocols.filter(
    (protocol) =>
      protocol.id?.toLowerCase().includes("aave") ||
      protocol.name?.toLowerCase().includes("aave"),
  );
};

/**
 * Parse Aave position data into a simplified format
 * @param {Object} aaveProtocol - Aave protocol data from DeBank
 * @returns {Array} Array of parsed positions
 */
export const parseAavePositions = (aaveProtocol) => {
  if (!aaveProtocol || !aaveProtocol.portfolio_item_list) {
    return [];
  }

  const positions = [];

  aaveProtocol.portfolio_item_list.forEach((item) => {
    // Handle lending positions (supplied collateral)
    if (item.name === "Lending" && item.detail?.supply_token_list) {
      item.detail.supply_token_list.forEach((token) => {
        const existingPosition = positions.find((p) => p.id === token.id);

        if (existingPosition) {
          existingPosition.collateralAmount = token.amount;
          existingPosition.collateralValue = token.amount * (token.price || 0);
          existingPosition.collateralToken = token.symbol;
        } else {
          positions.push({
            id: token.id,
            collateralToken: token.symbol,
            collateralAmount: token.amount,
            collateralValue: token.amount * (token.price || 0),
            borrowToken: null,
            debtAmount: 0,
            debtValue: 0,
            healthFactor: item.detail?.health_rate || 0,
            status: "active",
          });
        }
      });
    }

    // Handle borrowing positions (debt)
    if (item.name === "Lending" && item.detail?.borrow_token_list) {
      item.detail.borrow_token_list.forEach((token) => {
        const existingPosition = positions.find((p) => !p.borrowToken);

        if (existingPosition) {
          existingPosition.borrowToken = token.symbol;
          existingPosition.debtAmount = token.amount;
          existingPosition.debtValue = token.amount * (token.price || 0);
        } else {
          positions.push({
            id: token.id,
            collateralToken: null,
            collateralAmount: 0,
            collateralValue: 0,
            borrowToken: token.symbol,
            debtAmount: token.amount,
            debtValue: token.amount * (token.price || 0),
            healthFactor: item.detail?.health_rate || 0,
            status: "active",
          });
        }
      });
    }
  });

  // Calculate leverage for positions with both collateral and debt
  positions.forEach((position) => {
    if (position.collateralValue > 0 && position.debtValue > 0) {
      position.leverage =
        (
          (position.collateralValue + position.debtValue) /
          position.collateralValue
        ).toFixed(2) + "x";
    } else {
      position.leverage = "1.00x";
    }
  });

  return positions;
};

/**
 * Fetch and parse Aave positions for a Stratax contract
 * @param {string} strataxAddress - The Stratax contract address
 * @param {string} chainId - The chain ID (default: 'eth')
 * @param {string} apiKey - DeBank API key (optional)
 * @returns {Promise<Array>} Array of parsed Aave positions
 */
export const fetchStrataxAavePositions = async (
  strataxAddress,
  chainId = "eth",
  apiKey = null,
) => {
  try {
    const protocols = await getComplexProtocolList(
      strataxAddress,
      chainId,
      apiKey,
    );
    const aaveProtocols = filterAavePositions(protocols);

    let allPositions = [];
    aaveProtocols.forEach((aaveProtocol) => {
      const positions = parseAavePositions(aaveProtocol);
      allPositions = [...allPositions, ...positions];
    });

    return allPositions;
  } catch (error) {
    console.error("Error fetching Stratax Aave positions:", error);
    return [];
  }
};

/**
 * Get chain ID for DeBank API from network ID
 * @param {number} networkId - Ethereum network ID
 * @returns {string} DeBank chain ID
 */
export const getDebankChainId = (networkId) => {
  const chainMap = {
    1: "eth", // Ethereum Mainnet
    10: "op", // Optimism
    56: "bsc", // BSC
    100: "xdai", // Gnosis
    137: "matic", // Polygon
    250: "ftm", // Fantom
    42161: "arb", // Arbitrum
    43114: "avax", // Avalanche
    8453: "base", // Base
    11155111: "eth", // Sepolia (treat as eth for testing)
    31337: "eth", // Anvil Local (treat as eth)
  };

  return chainMap[networkId] || "eth";
};
