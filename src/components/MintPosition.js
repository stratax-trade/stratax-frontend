/* global BigInt */
import React, { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { TOKENS, TOKEN_INFO, LEVERAGE_PRECISION } from "../config/contracts";
import { CONTRACTS } from "../config/contracts";
import { STRATAX_POSITION_NFT_ABI } from "../contracts/abi";
import { get1inchSwapData } from "../utils/oneInch";
import "./MintPosition.css";

const MintPosition = ({ onMintSuccess }) => {
  const { networkId, account, provider, connectWallet } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    collateralToken: "",
    borrowToken: "",
    positionType: "long",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [openImmediately, setOpenImmediately] = useState(false);
  const [openParams, setOpenParams] = useState({
    collateralAmount: "",
    desiredLeverage: "2",
    slippage: "1",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log("\n\n");
    console.log("═══════════════════════════════════════════");
    console.log("  MINT POSITION NFT - DEBUG LOG");
    console.log("═══════════════════════════════════════════");

    if (!account) {
      console.log("No account connected, prompting wallet connection");
      connectWallet();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get USDC address for the current network
      const usdcAddress = networkTokens.USDC;
      if (!usdcAddress) {
        throw new Error("USDC not available on this network");
      }

      // Determine actual tokens to use
      let actualCollateralToken = formData.collateralToken;
      let actualBorrowToken = formData.borrowToken;

      // In simple mode, auto-fill USDC based on position type
      if (!showAdvanced) {
        if (formData.positionType === "long") {
          // Long: user selects collateral, borrow is USDC
          actualBorrowToken = usdcAddress;
          if (!actualCollateralToken) {
            throw new Error("Please select the asset you want to long");
          }
        } else {
          // Short: user selects borrow, collateral is USDC
          actualCollateralToken = usdcAddress;
          if (!actualBorrowToken) {
            throw new Error("Please select the asset you want to short");
          }
        }
      } else {
        // Advanced mode: validate both selections
        if (!actualCollateralToken || !actualBorrowToken) {
          throw new Error("Please select both collateral and borrow tokens");
        }
      }

      if (actualCollateralToken === actualBorrowToken) {
        throw new Error("Collateral and borrow tokens must be different");
      }

      // Check if contract exists at the address
      console.log("=== NFT Contract Debug Info ===");
      console.log("Network ID:", networkId);
      console.log("NFT Contract Address:", CONTRACTS.STRATAX_POSITION_NFT);
      console.log("User Account:", account);
      console.log("Collateral Token:", actualCollateralToken);
      console.log("Borrow Token:", actualBorrowToken);

      const contractCode = await provider.getCode(
        CONTRACTS.STRATAX_POSITION_NFT,
      );
      console.log("Contract code exists:", contractCode !== "0x");
      console.log("Contract code length:", contractCode.length);

      if (contractCode === "0x") {
        throw new Error(
          `StrataxPositionNft contract not found at ${CONTRACTS.STRATAX_POSITION_NFT}. Please deploy the contract to this network first, or update the contract address in contracts.js`,
        );
      }

      // Create contract instance
      const signer = await provider.getSigner();
      const nftContract = new ethers.Contract(
        CONTRACTS.STRATAX_POSITION_NFT,
        STRATAX_POSITION_NFT_ABI,
        signer,
      );

      console.log("Minting position NFT...", {
        to: account,
        collateralToken: actualCollateralToken,
        borrowToken: actualBorrowToken,
        nftContractAddress: CONTRACTS.STRATAX_POSITION_NFT,
      });

      // Debug: Check contract state before minting
      console.log("\n=== Checking NFT Contract State ===");
      try {
        // Fetch all public variables
        const owner = await nftContract.owner();
        const strataxBeacon = await nftContract.strataxBeacon();
        const oneInchRouter = await nftContract.oneInchRouter();
        const feeCollector = await nftContract.feeCollector();
        const defaultBorrowSafetyMargin =
          await nftContract.defaultBorrowSafetyMargin();

        // Try to get additional info
        let contractName = "N/A";
        let totalPositions = "N/A";
        try {
          contractName = await nftContract.name();
        } catch (e) {
          console.log("Could not fetch contract name:", e.message);
        }
        try {
          totalPositions = await nftContract.getTotalPositionsCreated();
        } catch (e) {
          console.log("Could not fetch total positions:", e.message);
        }

        console.log("Owner:", owner);
        console.log("Contract Name:", contractName);
        console.log("Stratax Beacon:", strataxBeacon);
        console.log("1inch Router:", oneInchRouter);
        console.log("Fee Collector:", feeCollector);
        console.log(
          "Default Borrow Safety Margin:",
          defaultBorrowSafetyMargin.toString(),
        );
        console.log("Total Positions Created:", totalPositions.toString());
        console.log("Current Signer:", account);

        const stateTable = {
          Owner: owner,
          "Stratax Beacon": strataxBeacon,
          "1inch Router": oneInchRouter,
          "Fee Collector": feeCollector,
          "Safety Margin": defaultBorrowSafetyMargin.toString(),
          "Total Positions": totalPositions.toString(),
        };
        console.table(stateTable);

        // Validation checks
        console.log("\n=== Validation Checks ===");
        if (strataxBeacon === ethers.ZeroAddress) {
          console.error("❌ StrataxBeacon address is zero!");
          throw new Error(
            "StrataxBeacon address is zero. Contract not initialized properly.",
          );
        } else {
          console.log("✓ StrataxBeacon address is valid");
        }

        if (oneInchRouter === ethers.ZeroAddress) {
          console.error("❌ 1inch Router address is zero!");
          throw new Error(
            "1inch Router address is zero. Contract not initialized properly.",
          );
        } else {
          console.log("✓ 1inch Router address is valid");
        }

        if (feeCollector === ethers.ZeroAddress) {
          console.error("❌ Fee Collector address is zero!");
          throw new Error(
            "Fee Collector address is zero. Contract not initialized properly.",
          );
        } else {
          console.log("✓ Fee Collector address is valid");
        }

        // Check if beacon has implementation
        console.log("\n=== Checking Beacon Deployment ===");
        const beaconCode = await provider.getCode(strataxBeacon);
        console.log("Beacon code exists:", beaconCode !== "0x");
        console.log("Beacon code length:", beaconCode.length);

        if (beaconCode === "0x") {
          console.error("❌ StrataxBeacon contract not found!");
          throw new Error(
            `StrataxBeacon contract not found at ${strataxBeacon}. The beacon must be deployed first.`,
          );
        }
        console.log("✓ StrataxBeacon exists at:", strataxBeacon);

        console.log("\n✓ All validation checks passed!\n");
      } catch (debugErr) {
        console.error("\n=== Contract State Check Failed ===");
        console.error("Error:", debugErr);
        console.error("Error message:", debugErr.message);
        throw new Error(
          `Contract validation failed: ${debugErr.message}. The contract may not be deployed or initialized on this network.`,
        );
      }

      console.log("\n=== Transaction Parameters ===");
      console.log("To:", account);
      console.log("Collateral Token:", actualCollateralToken);
      console.log("Borrow Token:", actualBorrowToken);

      // Check if token pair is valid
      console.log("\n=== Validating Token Pair ===");
      let isTokenPairValid = false;
      try {
        console.log("Calling isTokenPairValid with:");
        console.log("  Collateral Token:", actualCollateralToken);
        console.log("  Borrow Token:", actualBorrowToken);

        isTokenPairValid = await nftContract.isTokenPairValid(
          actualCollateralToken,
          actualBorrowToken,
        );

        console.log(
          "Token pair validation result:",
          isTokenPairValid ? "✓ VALID" : "❌ INVALID",
        );

        if (!isTokenPairValid) {
          console.error("\n❌ TOKEN PAIR IS INVALID!");
          console.error("This is likely why minting is failing.");
          console.error("Collateral Token:", actualCollateralToken);
          console.error("Borrow Token:", actualBorrowToken);

          // Try to get token symbols for better error message
          const ERC20_ABI = [
            {
              inputs: [],
              name: "symbol",
              outputs: [{ type: "string" }],
              stateMutability: "view",
              type: "function",
            },
          ];

          let collateralSymbol = "Unknown";
          let borrowSymbol = "Unknown";

          try {
            const collateralContract = new ethers.Contract(
              actualCollateralToken,
              ERC20_ABI,
              provider,
            );
            collateralSymbol = await collateralContract.symbol();
          } catch (e) {
            console.log("Could not fetch collateral symbol");
          }

          try {
            const borrowContract = new ethers.Contract(
              actualBorrowToken,
              ERC20_ABI,
              provider,
            );
            borrowSymbol = await borrowContract.symbol();
          } catch (e) {
            console.log("Could not fetch borrow symbol");
          }

          throw new Error(
            `Invalid token pair: ${collateralSymbol} (collateral) and ${borrowSymbol} (borrow) is not a valid combination. The contract has rejected this token pair. Please ensure both tokens are whitelisted and the pair is supported.`,
          );
        }

        console.log("✓ Token pair is VALID - proceeding with mint");
      } catch (validationErr) {
        console.error("\n=== Token Pair Validation Failed ===");
        console.error("Error type:", validationErr.constructor.name);
        console.error("Error code:", validationErr.code);
        console.error("Error:", validationErr);

        // If it's a call error, the function doesn't exist
        if (
          validationErr.code === "CALL_EXCEPTION" ||
          validationErr.message?.includes("isTokenPairValid")
        ) {
          console.warn(
            "⚠️  isTokenPairValid function may not exist on this contract version",
          );
          console.warn("Skipping token pair validation...");
        } else {
          throw validationErr;
        }
      }

      // Prepare init params if opening immediately
      let initParams = {
        flashLoanAmount: 0,
        collateralAmount: 0,
        borrowAmount: 0,
        oneInchSwapData: "0x",
        minReturnAmount: 0,
      };

      if (openImmediately) {
        console.log("\n=== Preparing Init Params for Immediate Open ===");

        // Validate open params
        if (
          !openParams.collateralAmount ||
          parseFloat(openParams.collateralAmount) <= 0
        ) {
          throw new Error("Please enter a valid collateral amount");
        }

        // Get token info for decimals
        const collateralTokenSymbol = Object.entries(networkTokens).find(
          ([, addr]) =>
            addr.toLowerCase() === actualCollateralToken.toLowerCase(),
        )?.[0];
        const borrowTokenSymbol = Object.entries(networkTokens).find(
          ([, addr]) => addr.toLowerCase() === actualBorrowToken.toLowerCase(),
        )?.[0];

        if (!collateralTokenSymbol || !borrowTokenSymbol) {
          throw new Error("Unable to find token information");
        }

        const collateralDecimals =
          TOKEN_INFO[collateralTokenSymbol]?.decimals || 18;
        const collateralAmountWei = ethers.parseUnits(
          openParams.collateralAmount,
          collateralDecimals,
        );

        // Convert leverage to contract format (4 decimals)
        const leverageValue = parseFloat(openParams.desiredLeverage);
        const leverageWithPrecision = BigInt(
          Math.floor(leverageValue * LEVERAGE_PRECISION),
        );

        console.log(
          "Collateral Amount:",
          openParams.collateralAmount,
          collateralTokenSymbol,
        );
        console.log("Collateral Amount (wei):", collateralAmountWei.toString());
        console.log("Desired Leverage:", leverageValue + "x");
        console.log(
          "Leverage (with precision):",
          leverageWithPrecision.toString(),
        );

        // Call calculateInitOpenParams
        console.log("Calling calculateInitOpenParams...");
        const [flashLoanAmount, borrowAmount, strataxFee] =
          await nftContract.calculateInitOpenParams(
            actualCollateralToken,
            actualBorrowToken,
            collateralAmountWei,
            leverageWithPrecision,
          );

        console.log("Flash Loan Amount:", flashLoanAmount.toString());
        console.log("Borrow Amount:", borrowAmount.toString());
        console.log("Stratax Fee:", strataxFee.toString());

        // Predict the Stratax proxy address (needed for swap and approval)
        console.log("\n=== Predicting Stratax Proxy Address ===");
        const nextTokenId = await nftContract.currentTokenId();
        const predictedProxy = await nftContract.predictStrataxProxyAddress(
          account,
          nextTokenId,
          actualCollateralToken,
          actualBorrowToken,
        );
        console.log("Next Token ID:", nextTokenId.toString());
        console.log("Predicted Stratax Proxy:", predictedProxy);

        // Get 1inch swap data
        console.log("\n=== Getting 1inch Swap Data ===");
        const borrowDecimals = TOKEN_INFO[borrowTokenSymbol]?.decimals || 18;
        const swapAmount = borrowAmount.toString();

        console.log("Getting swap data for:", {
          from: actualBorrowToken,
          to: actualCollateralToken,
          amount: swapAmount,
          fromAddress: predictedProxy,
          slippage: openParams.slippage,
        });

        const swapData = await get1inchSwapData(
          networkId,
          actualBorrowToken,
          actualCollateralToken,
          swapAmount,
          predictedProxy,
          openParams.slippage,
        );

        if (!swapData || !swapData.tx || !swapData.tx.data) {
          throw new Error("Failed to get 1inch swap data");
        }

        console.log("Swap data obtained successfully");
        console.log("Expected return:", swapData.toAmount);

        initParams = {
          flashLoanAmount,
          collateralAmount: collateralAmountWei,
          borrowAmount,
          oneInchSwapData: swapData.tx.data,
          minReturnAmount: BigInt(swapData.toAmount),
        };

        console.log("Init params prepared:", {
          flashLoanAmount: initParams.flashLoanAmount.toString(),
          collateralAmount: initParams.collateralAmount.toString(),
          borrowAmount: initParams.borrowAmount.toString(),
          swapDataLength: initParams.oneInchSwapData.length,
          minReturnAmount: initParams.minReturnAmount.toString(),
        });

        // Check and handle token approval
        console.log("\n=== Checking Token Approval ===");
        const ERC20_ABI = [
          {
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "approve",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
          {
            inputs: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
            ],
            name: "allowance",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ];

        const signer = await provider.getSigner();
        const collateralTokenContract = new ethers.Contract(
          actualCollateralToken,
          ERC20_ABI,
          signer,
        );

        console.log("Checking allowance for predicted proxy:", predictedProxy);
        const allowance = await collateralTokenContract.allowance(
          account,
          predictedProxy,
        );

        console.log("Current allowance:", allowance.toString());
        console.log("Required amount:", collateralAmountWei.toString());

        if (allowance < collateralAmountWei) {
          console.log("Insufficient allowance, requesting approval...");
          const approveTx = await collateralTokenContract.approve(
            predictedProxy,
            collateralAmountWei,
          );
          console.log("Approval transaction sent:", approveTx.hash);

          await approveTx.wait();
          console.log("✓ Token approval confirmed");
        } else {
          console.log("✓ Sufficient allowance already exists");
        }
      }

      // Try to simulate the call first to get better error message
      console.log("\n=== Simulating Transaction ===");
      try {
        console.log("Running staticCall to test transaction...");
        console.log("Parameters:");
        console.log("  to:", account);
        console.log("  collateralToken:", actualCollateralToken);
        console.log("  borrowToken:", actualBorrowToken);
        console.log("  openImmediately:", openImmediately);
        if (openImmediately) {
          console.log("  initParams:", {
            flashLoanAmount: initParams.flashLoanAmount.toString(),
            collateralAmount: initParams.collateralAmount.toString(),
            borrowAmount: initParams.borrowAmount.toString(),
            swapDataLength: initParams.oneInchSwapData.length,
            minReturnAmount: initParams.minReturnAmount.toString(),
          });
        }

        const result = await nftContract.mintPositionNft.staticCall(
          account,
          actualCollateralToken,
          actualBorrowToken,
          openImmediately,
          initParams,
        );
        console.log("✓ Simulation successful!");
        console.log("Expected result:", result);
        console.log("Expected tokenId:", result[0]?.toString());
        console.log("Expected strataxProxy:", result[1]);
      } catch (simError) {
        console.error("\n=== Transaction Simulation Failed ===");
        console.error("Full error object:", simError);
        console.error("Error name:", simError.name);
        console.error("Error code:", simError.code);
        console.error("Error data:", simError.data);
        console.error("Error message:", simError.message);
        console.error("Error reason:", simError.reason);
        console.error("Error action:", simError.action);
        console.error("Error transaction:", simError.transaction);

        // Check if token pair validation passed
        if (!isTokenPairValid) {
          console.error("\n⚠️  Token pair was marked as INVALID");
          console.error(
            "The transaction is failing because the token pair is not supported.",
          );
        }

        // Try to provide helpful diagnostic info
        console.log("\n=== Diagnostic Information ===");
        console.log("1. Token pair valid:", isTokenPairValid ? "Yes" : "No");
        console.log("2. Contract initialized:", "Yes (checked earlier)");
        console.log("3. StrataxBeacon deployed:", "Yes (checked earlier)");

        // Try to extract more meaningful error
        let errorMessage = "Transaction would fail: ";

        if (simError.data === "0x" || !simError.data) {
          errorMessage +=
            "Contract reverted with no reason. Possible causes:\n";
          errorMessage += "  - Token pair is not whitelisted\n";
          errorMessage += "  - Required contract dependencies not set up\n";
          errorMessage += "  - Gas estimation failed\n";
          errorMessage += "  - Internal contract requirement not met\n";

          if (!isTokenPairValid) {
            errorMessage +=
              "\n⚠️  The isTokenPairValid check returned false - this is the most likely cause.";
          }
        } else if (simError.data) {
          errorMessage += `Contract error (${simError.data})`;
        } else if (simError.reason) {
          errorMessage += simError.reason;
        } else if (simError.message) {
          errorMessage += simError.message;
        } else {
          errorMessage +=
            "Unknown error - check that the contract is initialized and tokens are valid";
        }

        throw new Error(errorMessage);
      }

      // Call mintPositionNft
      console.log("\n=== Sending Transaction ===");
      const tx = await nftContract.mintPositionNft(
        account,
        actualCollateralToken,
        actualBorrowToken,
        openImmediately,
        initParams,
      );

      console.log("✓ Transaction sent!");
      console.log("Transaction hash:", tx.hash);

      console.log("\n=== Waiting for Confirmation ===");
      const receipt = await tx.wait();
      console.log("✓ Transaction confirmed!");
      console.log("Block number:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Status:", receipt.status === 1 ? "Success" : "Failed");

      // Extract tokenId and strataxProxy from events
      console.log("\n=== Parsing Events ===");
      console.log("Total logs:", receipt.logs.length);

      const mintEvent = receipt.logs.find((log) => {
        try {
          const parsed = nftContract.interface.parseLog(log);
          return parsed.name === "Transfer"; // NFT Transfer event
        } catch {
          return false;
        }
      });

      if (mintEvent) {
        const parsed = nftContract.interface.parseLog(mintEvent);
        const tokenId = parsed.args.tokenId || parsed.args[2];
        console.log("✓ Position NFT minted!");
        console.log("Token ID:", tokenId.toString());
        console.log("Event details:", parsed);
      } else {
        console.warn("⚠ Could not find Transfer event in receipt");
      }

      console.log("\n=== Mint Successful ===");
      if (openImmediately) {
        console.log("Position opened immediately\n");
      } else {
        console.log("NFT minted (position not opened)\n");
      }

      alert(
        openImmediately
          ? "Position NFT minted and leveraged position opened successfully!"
          : "Position NFT minted successfully! You can now open it with collateral.",
      );

      // Reset form
      setFormData({
        collateralToken: "",
        borrowToken: "",
        positionType: "long",
      });
      setOpenParams({
        collateralAmount: "",
        desiredLeverage: "2",
        slippage: "1",
      });
      setOpenImmediately(false);

      // Notify parent component
      if (onMintSuccess) {
        onMintSuccess();
      }
    } catch (err) {
      console.error("\n=== Mint Error ===");
      console.error("Error:", err);
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error code:", err.code);
      console.error("Error data:", err.data);
      console.error("Error stack:", err.stack);
      setError(err.message || "Failed to mint position NFT");
    } finally {
      setLoading(false);
    }
  };

  const networkTokens = TOKENS[networkId] || TOKENS[1] || {};
  const tokenOptions = Object.entries(networkTokens);

  return (
    <div className="mint-position">
      <h2>Mint Position NFT</h2>
      <p className="info-text">
        Create a position NFT by selecting your collateral and borrow tokens.
        Optionally open the position immediately with collateral in a single
        transaction, or mint the NFT and fund it later.
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Open Position Immediately Toggle */}
        <div className="form-group">
          <div className="position-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${!openImmediately ? "active" : ""}`}
              onClick={() => setOpenImmediately(false)}
            >
              <span className="direction-icon">🔖</span>
              Mint Only
            </button>
            <button
              type="button"
              className={`toggle-btn ${openImmediately ? "active" : ""}`}
              onClick={() => setOpenImmediately(true)}
            >
              <span className="direction-icon">⚡</span>
              Mint & Open
            </button>
          </div>
        </div>

        <div className="form-group">
          <div className="position-type-toggle">
            <button
              type="button"
              className={`toggle-btn ${formData.positionType === "long" ? "active" : ""}`}
              onClick={() =>
                setFormData((prev) => ({ ...prev, positionType: "long" }))
              }
            >
              <span className="direction-icon">📈</span>
              Long
            </button>
            <button
              type="button"
              className={`toggle-btn ${formData.positionType === "short" ? "active" : ""}`}
              onClick={() =>
                setFormData((prev) => ({ ...prev, positionType: "short" }))
              }
            >
              <span className="direction-icon">📉</span>
              Short
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="advanced-toggle">
            <div className="advanced-toggle-content">
              <span>Advanced Mode</span>
              <span className="advanced-toggle-hint">
                {showAdvanced
                  ? "Select both collateral and borrow tokens manually"
                  : "Simplified mode: USDC is auto-selected"}
              </span>
            </div>
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
            <div className="toggle-switch"></div>
          </label>
        </div>

        {/* Simple mode: Show only relevant token field */}
        {!showAdvanced && formData.positionType === "long" && (
          <div className="form-group">
            <label htmlFor="collateralToken">Asset to Long</label>
            <select
              id="collateralToken"
              name="collateralToken"
              value={formData.collateralToken}
              onChange={handleChange}
              required
            >
              <option value="">Select Asset</option>
              {tokenOptions
                .filter(([symbol]) => symbol !== "USDC")
                .map(([symbol, address]) => (
                  <option key={address} value={address}>
                    {symbol} - {TOKEN_INFO[symbol]?.name || symbol}
                  </option>
                ))}
            </select>
            <small className="form-hint">
              Select the asset you want to gain exposure to (Borrow Token: USDC)
            </small>
          </div>
        )}

        {!showAdvanced && formData.positionType === "short" && (
          <div className="form-group">
            <label htmlFor="borrowToken">Asset to Short</label>
            <select
              id="borrowToken"
              name="borrowToken"
              value={formData.borrowToken}
              onChange={handleChange}
              required
            >
              <option value="">Select Asset</option>
              {tokenOptions
                .filter(([symbol]) => symbol !== "USDC")
                .map(([symbol, address]) => (
                  <option key={address} value={address}>
                    {symbol} - {TOKEN_INFO[symbol]?.name || symbol}
                  </option>
                ))}
            </select>
            <small className="form-hint">
              Select the asset you want to short (Collateral Token: USDC)
            </small>
          </div>
        )}

        {/* Advanced mode: Show both token fields */}
        {showAdvanced && (
          <>
            <div className="form-group">
              <label htmlFor="collateralToken">Collateral Token</label>
              <select
                id="collateralToken"
                name="collateralToken"
                value={formData.collateralToken}
                onChange={handleChange}
                required
              >
                <option value="">Select Collateral Token</option>
                {tokenOptions.map(([symbol, address]) => (
                  <option key={address} value={address}>
                    {symbol} - {TOKEN_INFO[symbol]?.name || symbol}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                The token you will deposit as collateral
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="borrowToken">Borrow Token</label>
              <select
                id="borrowToken"
                name="borrowToken"
                value={formData.borrowToken}
                onChange={handleChange}
                required
              >
                <option value="">Select Borrow Token</option>
                {tokenOptions.map(([symbol, address]) => (
                  <option key={address} value={address}>
                    {symbol} - {TOKEN_INFO[symbol]?.name || symbol}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                The token you will borrow against your collateral
              </small>
            </div>
          </>
        )}

        {formData.positionType === "long" && (
          <div className="position-explanation">
            <strong>Long Position:</strong>{" "}
            {!showAdvanced ? (
              formData.collateralToken ? (
                <>
                  Deposit{" "}
                  {
                    Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.collateralToken,
                    )?.[0]
                  }{" "}
                  and borrow USDC to increase exposure to{" "}
                  {
                    Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.collateralToken,
                    )?.[0]
                  }
                  .
                </>
              ) : (
                "Select an asset to gain leveraged exposure"
              )
            ) : (
              <>
                Deposit{" "}
                {formData.collateralToken
                  ? Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.collateralToken,
                    )?.[0]
                  : "volatile asset"}{" "}
                and borrow{" "}
                {formData.borrowToken
                  ? Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.borrowToken,
                    )?.[0]
                  : "stablecoin"}{" "}
                to increase exposure to the collateral asset.
              </>
            )}
          </div>
        )}

        {formData.positionType === "short" && (
          <div className="position-explanation">
            <strong>Short Position:</strong>{" "}
            {!showAdvanced ? (
              formData.borrowToken ? (
                <>
                  Deposit USDC and borrow{" "}
                  {
                    Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.borrowToken,
                    )?.[0]
                  }{" "}
                  to profit from a decrease in{" "}
                  {
                    Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.borrowToken,
                    )?.[0]
                  }
                  's price.
                </>
              ) : (
                "Select an asset to short"
              )
            ) : (
              <>
                Deposit{" "}
                {formData.collateralToken
                  ? Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.collateralToken,
                    )?.[0]
                  : "stablecoin"}{" "}
                and borrow{" "}
                {formData.borrowToken
                  ? Object.entries(networkTokens).find(
                      ([, addr]) => addr === formData.borrowToken,
                    )?.[0]
                  : "volatile asset"}{" "}
                to profit from a decrease in the borrowed asset's price.
              </>
            )}
          </div>
        )}

        {/* Open Params - shown when openImmediately is true */}
        {openImmediately && (
          <>
            <div className="form-group">
              <label htmlFor="collateralAmount">Collateral Amount</label>
              <input
                type="number"
                id="collateralAmount"
                name="collateralAmount"
                value={openParams.collateralAmount}
                onChange={(e) =>
                  setOpenParams((prev) => ({
                    ...prev,
                    collateralAmount: e.target.value,
                  }))
                }
                placeholder="0.0"
                step="any"
                min="0"
                required={openImmediately}
              />
              <small className="form-hint">
                Amount of collateral to deposit
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="desiredLeverage">Leverage</label>
              <input
                type="number"
                id="desiredLeverage"
                name="desiredLeverage"
                value={openParams.desiredLeverage}
                onChange={(e) =>
                  setOpenParams((prev) => ({
                    ...prev,
                    desiredLeverage: e.target.value,
                  }))
                }
                placeholder="2.0"
                step="0.01"
                min="1.01"
                max="10"
                required={openImmediately}
              />
              <small className="form-hint">
                Leverage multiplier (e.g., 2 = 2x leverage)
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="slippage">Slippage Tolerance (%)</label>
              <input
                type="number"
                id="slippage"
                name="slippage"
                value={openParams.slippage}
                onChange={(e) =>
                  setOpenParams((prev) => ({
                    ...prev,
                    slippage: e.target.value,
                  }))
                }
                placeholder="1.0"
                step="0.1"
                min="0.1"
                max="50"
                required={openImmediately}
              />
              <small className="form-hint">
                Maximum slippage for 1inch swap (default: 1%)
              </small>
            </div>
          </>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={loading || !account}
        >
          {!account
            ? "Connect Wallet"
            : loading
              ? openImmediately
                ? "Minting & Opening Position..."
                : "Minting NFT..."
              : openImmediately
                ? "Mint & Open Position"
                : "Mint Position NFT"}
        </button>
      </form>
    </div>
  );
};

export default MintPosition;
