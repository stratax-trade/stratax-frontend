// Map token symbols to TradingView symbols
export const getTokenTradingViewSymbol = (
  tokenSymbol,
  positionType = "long",
) => {
  const symbolMap = {
    // Crypto assets
    WETH: "BINANCE:ETHUSDT",
    ETH: "BINANCE:ETHUSDT",
    WBTC: "BINANCE:BTCUSDT",
    BTC: "BINANCE:BTCUSDT",
    USDC: "BINANCE:BTCUSDT", // Default to BTC for stablecoins
    USDT: "BINANCE:BTCUSDT",
    DAI: "BINANCE:ETHUSDT",
    LINK: "BINANCE:LINKUSDT",
    AAVE: "BINANCE:AAVEUSDT",
    UNI: "BINANCE:UNIUSDT",
    MATIC: "BINANCE:MATICUSDT",
    AVAX: "BINANCE:AVAXUSDT",
    ARB: "BINANCE:ARBUSDT",
    OP: "BINANCE:OPUSDT",
  };

  // If token symbol is not found, default to BTC
  return symbolMap[tokenSymbol] || "BINANCE:BTCUSDT";
};

// Get the relevant pair for the position
export const getPositionChartSymbol = (
  collateralToken,
  borrowToken,
  positionType,
) => {
  // For long positions, show the collateral asset (the asset we're long on)
  // For short positions, show the borrow asset (the asset we're short on)

  if (positionType === "long" && collateralToken) {
    return getTokenTradingViewSymbol(collateralToken);
  } else if (positionType === "short" && borrowToken) {
    return getTokenTradingViewSymbol(borrowToken);
  } else if (collateralToken) {
    return getTokenTradingViewSymbol(collateralToken);
  } else if (borrowToken) {
    return getTokenTradingViewSymbol(borrowToken);
  }

  // Default to BTC
  return "BINANCE:BTCUSDT";
};
