import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { STRATAX_ABI, ERC20_ABI } from "../contracts/abi";
import { CONTRACTS } from "../config/contracts";

export const useStrataxContract = (strataxProxyAddress = null) => {
  const { signer, provider, account } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get contract instance
  const getContract = useCallback(() => {
    if (!signer) {
      throw new Error("Wallet not connected");
    }
    // Use provided proxy address or fall back to default CONTRACTS.STRATAX
    const contractAddress = strataxProxyAddress || CONTRACTS.STRATAX;
    if (
      !contractAddress ||
      contractAddress === "0x0000000000000000000000000000000000000000"
    ) {
      throw new Error("Stratax contract address not configured");
    }
    return new ethers.Contract(contractAddress, STRATAX_ABI, signer);
  }, [signer, strataxProxyAddress]);

  // Get ERC20 token contract
  const getTokenContract = useCallback(
    (tokenAddress) => {
      if (!provider) {
        throw new Error("Provider not available");
      }
      return new ethers.Contract(tokenAddress, ERC20_ABI, signer || provider);
    },
    [provider, signer],
  );

  // Create leveraged position
  const createLeveragedPosition = useCallback(
    async (params) => {
      setLoading(true);
      setError(null);

      try {
        const contract = getContract();

        // Approve token spending
        const tokenContract = getTokenContract(params.flashLoanToken);
        const strataxAddress = strataxProxyAddress || CONTRACTS.STRATAX;
        const approveTx = await tokenContract.approve(
          strataxAddress,
          params.collateralAmount,
        );
        await approveTx.wait();

        // Create position
        const tx = await contract.createLeveragedPosition(
          params.flashLoanToken,
          params.flashLoanAmount,
          params.collateralAmount,
          params.borrowToken,
          params.borrowAmount,
          params.oneInchSwapData,
          params.minReturnAmount,
        );

        const receipt = await tx.wait();
        setLoading(false);
        return receipt;
      } catch (err) {
        console.error("Error creating leveraged position:", err);
        setError(err.message || "Transaction failed");
        setLoading(false);
        throw err;
      }
    },
    [getContract, getTokenContract, strataxProxyAddress],
  );

  // Unwind position
  const unwindPosition = useCallback(
    async (params) => {
      setLoading(true);
      setError(null);

      try {
        const contract = getContract();

        const tx = await contract.unwindPosition(
          params.collateralToken,
          params.collateralToWithdraw,
          params.debtToken,
          params.debtAmount,
          params.oneInchSwapData,
          params.minReturnAmount,
        );

        const receipt = await tx.wait();
        setLoading(false);
        return receipt;
      } catch (err) {
        console.error("Error unwinding position:", err);
        setError(err.message || "Transaction failed");
        setLoading(false);
        throw err;
      }
    },
    [getContract],
  );

  // Calculate open parameters
  const calculateOpenParams = useCallback(
    async (tradeDetails) => {
      try {
        const contract = getContract();
        const [flashLoanAmount, borrowAmount] =
          await contract.calculateOpenParams(tradeDetails);
        return {
          flashLoanAmount: flashLoanAmount.toString(),
          borrowAmount: borrowAmount.toString(),
        };
      } catch (err) {
        console.error("Error calculating open params:", err);
        throw err;
      }
    },
    [getContract],
  );

  // Calculate unwind parameters
  const calculateUnwindParams = useCallback(
    async (collateralToken, borrowToken) => {
      try {
        const contract = getContract();
        const [collateralToWithdraw, debtAmount] =
          await contract.calculateUnwindParams(collateralToken, borrowToken);
        return {
          collateralToWithdraw: collateralToWithdraw.toString(),
          debtAmount: debtAmount.toString(),
        };
      } catch (err) {
        console.error("Error calculating unwind params:", err);
        throw err;
      }
    },
    [getContract],
  );

  // Get max leverage
  const getMaxLeverage = useCallback(
    async (asset) => {
      try {
        const contract = getContract();
        const maxLeverage = await contract["getMaxLeverage(address)"](asset);
        return maxLeverage.toString();
      } catch (err) {
        console.error("Error getting max leverage:", err);
        throw err;
      }
    },
    [getContract],
  );

  // Get token balance
  const getTokenBalance = useCallback(
    async (tokenAddress, accountAddress = account) => {
      try {
        const tokenContract = getTokenContract(tokenAddress);
        const balance = await tokenContract.balanceOf(accountAddress);
        const decimals = await tokenContract.decimals();
        return {
          raw: balance.toString(),
          formatted: ethers.formatUnits(balance, decimals),
          decimals: Number(decimals),
        };
      } catch (err) {
        console.error("Error getting token balance:", err);
        throw err;
      }
    },
    [getTokenContract, account],
  );

  // Get token info
  const getTokenInfo = useCallback(
    async (tokenAddress) => {
      try {
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.decimals(),
        ]);
        return { symbol, decimals: Number(decimals) };
      } catch (err) {
        console.error("Error getting token info:", err);
        throw err;
      }
    },
    [getTokenContract],
  );

  // Get free collateral
  const getFreeCollateral = useCallback(
    async (collateralToken) => {
      try {
        const contract = getContract();
        const freeCollateral =
          await contract.getFreeCollateral(collateralToken);
        return freeCollateral.toString();
      } catch (err) {
        console.error("Error getting free collateral:", err);
        throw err;
      }
    },
    [getContract],
  );

  return {
    loading,
    error,
    createLeveragedPosition,
    unwindPosition,
    calculateOpenParams,
    calculateUnwindParams,
    getMaxLeverage,
    getTokenBalance,
    getTokenInfo,
    getFreeCollateral,
  };
};
