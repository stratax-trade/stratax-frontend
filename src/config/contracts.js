// Contract addresses - Update these with your deployed contract addresses
export const CONTRACTS = {
  STRATAX: "", // just a test address for displaying positions
  STRATAX_POSITION_NFT: "0xc12905b187686f757e03ecaa85cebb83a418a240", // Update with deployed NFT contract address
  FEE_COLLECTOR: "0x0000000000000000000000000000000000000000", // Update with deployed FeeCollector address
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on mainnet
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on mainnet
};

// Network configuration
export const SUPPORTED_NETWORKS = {
  1: {
    name: "Ethereum Fork",
    rpcUrl: "http://localhost:8545",
    blockExplorer: "https://etherscan.io",
    isFork: true, // Run: anvil --fork-url <MAINNET_RPC> --chain-id 1
  },
  137: {
    name: "Polygon",
    rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY",
    blockExplorer: "https://polygonscan.com",
  },
  8453: {
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
  },
  11155111: {
    name: "Sepolia Testnet",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  31337: {
    name: "Anvil Local",
    rpcUrl: "http://localhost:8545",
    blockExplorer: "http://localhost:8545",
  },
  1996: {
    name: "Tenderly Eth",
    rpcUrl:
      "https://virtual.mainnet.us-east.rpc.tenderly.co/59b98c14-e3f1-4c22-8cdb-d62f00605007",
    blockExplorer: "",
  },
};

// Default network
export const DEFAULT_NETWORK = 11155111; // Sepolia for testing

// Common token addresses by network
export const TOKENS = {
  1: {
    // Mainnet
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  8453: {
    // Base
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    WETH: "0x4200000000000000000000000000000000000006",
    WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
  11155111: {
    // Sepolia
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    WBTC: "0x29f2D40B0605204364af54EC677bD022dA425d03",
    DAI: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357",
  },
  31337: {
    // Anvil Local (using mainnet addresses for forked mode)
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  1996: {
    // Tenderly Eth (forked mainnet)
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
};

// Token display info
export const TOKEN_INFO = {
  USDC: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  WETH: { name: "Wrapped Ether", symbol: "WETH", decimals: 18 },
  WBTC: { name: "Wrapped Bitcoin", symbol: "WBTC", decimals: 8 },
  DAI: { name: "Dai Stablecoin", symbol: "DAI", decimals: 18 },
};

// Leverage precision constant (matches contract)
export const LEVERAGE_PRECISION = 10000;
