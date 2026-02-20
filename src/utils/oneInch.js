/**
 * 1inch API utilities for getting swap data
 */

const ONEINCH_API_KEY = process.env.REACT_APP_ONEINCH_API_KEY;
const ONEINCH_API_URL = "https://api.1inch.dev/swap/v6.0";

/**
 * Get swap data from 1inch API
 * @param {number} chainId - Network chain ID
 * @param {string} fromToken - Token address to swap from
 * @param {string} toToken - Token address to swap to
 * @param {string} amount - Amount to swap (in wei)
 * @param {string} fromAddress - Address initiating the swap
 * @param {string} slippage - Slippage tolerance percentage (default: "1")
 * @returns {Promise<{data: string, toAmount: string}>}
 */
export async function get1inchSwapData(
  chainId,
  fromToken,
  toToken,
  amount,
  fromAddress,
  slippage = "1",
) {
  if (!ONEINCH_API_KEY) {
    console.warn("1inch API key not found in environment variables");
    return { data: "0x", toAmount: "0" };
  }

  try {
    const params = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: amount,
      from: fromAddress,
      slippage: slippage, // Use provided slippage tolerance
      disableEstimate: "true", // Disable balance check - contract will have funds from flash loan
      allowPartialFill: "false",
    });

    const url = `${ONEINCH_API_URL}/${1}/swap?${params}`;

    console.log("1inch API request:", {
      chainId,
      fromToken,
      toToken,
      amount,
      fromAddress,
      url,
    });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ONEINCH_API_KEY}`,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("1inch API error response:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });

      let errorMessage = `1inch API error: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.description || errorJson.error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();

    return {
      data: result.tx.data,
      toAmount: result.toAmount,
    };
  } catch (error) {
    console.error("Error fetching 1inch swap data:", error);
    throw error;
  }
}
