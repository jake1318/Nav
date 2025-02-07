import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { fetchQuoteThunk } from "../slices/swapSlice";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

const SUI_TYPE = "0x2::sui::SUI";
// USDC (Wormhole) on Sui Mainnet (example address, ensure this is correct for mainnet)
const USDC_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

// Optional: known decimals for certain token types (for converting human amounts to base units)
const DECIMALS: Record<string, number> = {
  [SUI_TYPE]: 9,
  [USDC_TYPE]: 6,
};

function SwapForm() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    quote,
    loading: quoteLoading,
    error: quoteError,
  } = useSelector((state: RootState) => state.swap);
  const currentAccount = useCurrentAccount();

  // Local component state for form inputs
  const [fromCoin, setFromCoin] = useState<string>(SUI_TYPE);
  const [toCoin, setToCoin] = useState<string>(USDC_TYPE);
  const [amount, setAmount] = useState<string>(""); // amount in human-readable (e.g., "1" for 1 coin)
  const [coinObjectId, setCoinObjectId] = useState<string>(""); // optional: coin object ID if fromCoin is not SUI

  // State for swap execution result
  const [txDigest, setTxDigest] = useState<string>("");
  const [swapError, setSwapError] = useState<string>("");

  // Hook for signing and executing the transaction with the connected wallet
  const { mutate: signAndExecuteTransaction, isLoading: isSigning } =
    useSignAndExecuteTransaction({
      onSuccess: (result: any) => {
        console.log("Swap transaction executed:", result);
        setTxDigest(result.digest);
        setSwapError("");
      },
      onError: (error: any) => {
        console.error("Swap transaction failed:", error);
        setTxDigest("");
        setSwapError(error.message || "Transaction failed");
      },
    });

  // Fetch swap quote from backend (NAVI aggregator) when user clicks "Get Quote"
  const handleGetQuote = () => {
    setTxDigest("");
    setSwapError("");
    if (!fromCoin || !toCoin || !amount) {
      return;
    }
    // Convert human-readable amount to base units (if known decimals)
    let amountToSend = amount;
    const dec = DECIMALS[fromCoin];
    if (dec !== undefined) {
      // Parse input as float and convert to integer string of base units
      const num = parseFloat(amount);
      if (isNaN(num)) {
        setSwapError("Invalid amount");
        return;
      }
      // Multiply by 10^dec and round down
      amountToSend = Math.floor(num * 10 ** dec).toString();
    }
    console.log(
      `Requesting quote for ${amountToSend} (base units of ${fromCoin})`
    );
    dispatch(
      fetchQuoteThunk({ from: fromCoin, to: toCoin, amount: amountToSend })
    );
  };

  // Sign and execute the swap transaction via Sui wallet
  const handleSwap = () => {
    setTxDigest("");
    setSwapError("");
    if (!currentAccount) {
      setSwapError("Wallet not connected");
      return;
    }
    if (!quote || !quote.routes || quote.routes.length === 0) {
      setSwapError("No quote available. Fetch a quote first.");
      return;
    }
    // Build the transaction using the quote route information
    try {
      const tx = new Transaction();
      const route = quote.routes[0]; // use the first (optimal) route
      let coinInput;

      // Prepare input coin for the swap:
      if (fromCoin === SUI_TYPE) {
        // Use SUI gas coin for input by splitting off the amount from the gas object
        const amountIn = BigInt(quote.amount_in);
        coinInput = tx.splitCoins(tx.gas, [amountIn]);
      } else {
        if (!coinObjectId) {
          throw new Error(
            "For non-SUI tokens, please provide a Coin Object ID from your wallet."
          );
        }
        const amountIn = BigInt(quote.amount_in);
        coinInput = tx.splitCoins(tx.object(coinObjectId), [amountIn]);
      }

      let currentCoin = coinInput;
      // Iterate through each swap step in the route
      route.path.forEach((step: any, index: number) => {
        const isLastStep = index === route.path.length - 1;
        const fnInfo = step.info_for_ptb;
        if (!fnInfo) {
          throw new Error("Missing function info for transaction building");
        }
        const { packageId, moduleName, functionName, typeArguments } = fnInfo;
        const args: any[] = [];
        // Pool object argument (by ID) for the swap function
        args.push(tx.object(step.id));
        // Coin to swap in
        args.push(currentCoin);
        // Slippage: set min_amount_out for last step to enforce minimum output, or 0 for intermediate steps
        if (isLastStep) {
          // Set minimum acceptable output (e.g., 98% of expected output to account for slippage)
          const expectedOut = BigInt(step.amount_out || quote.amount_out);
          const minOut = (expectedOut * 98n) / 100n; // allow 2% slippage
          args.push(tx.pure(minOut.toString(), "u64"));
        } else {
          // For intermediate swaps, no min output constraint (or could set a tiny amount as safeguard)
          args.push(tx.pure("0", "u64"));
        }
        // Build the Move call for this swap step
        const resultCoin = tx.moveCall({
          target: `${packageId}::${moduleName}::${functionName}`,
          typeArguments: fnInfo.typeArguments,
          arguments: args,
        });
        currentCoin = resultCoin;
      });

      // Ensure the final output coin is sent to the user's address (as the transaction result)
      if (currentCoin) {
        const userAddress = currentAccount.address;
        tx.transferObjects([currentCoin], tx.pure(userAddress, "address"));
      }

      console.log("Signing and executing transaction...");
      // Prompt wallet to sign and execute the transaction on Sui mainnet
      signAndExecuteTransaction({
        transaction: tx,
        chain: "sui:mainnet",
      });
    } catch (err: any) {
      console.error("Error building or executing swap transaction:", err);
      setSwapError(err.message || "Failed to build transaction");
    }
  };

  // If user disconnects or changes wallet, clear any previous quote and results
  useEffect(() => {
    if (!currentAccount) {
      setTxDigest("");
      setSwapError("");
    }
  }, [currentAccount]);

  // Determine if the swap button should be enabled
  const canSwap =
    currentAccount &&
    quote &&
    quote.routes &&
    quote.routes.length > 0 &&
    !quoteLoading &&
    !isSigning;

  // Convert quote output to human-readable format if possible
  let displayedOutput: string | null = null;
  if (quote && quote.amount_out) {
    const dec = DECIMALS[toCoin];
    if (dec !== undefined) {
      const outNum = Number(quote.amount_out) / 10 ** dec;
      displayedOutput = outNum.toFixed(dec >= 6 ? 6 : dec); // show up to 6 decimal places (or full if fewer)
    } else {
      displayedOutput = quote.amount_out;
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white shadow-md rounded p-6 mt-6">
      {/* Swap Inputs */}
      <div className="mb-4">
        <label className="block font-medium mb-1">From (Coin Type)</label>
        <input
          type="text"
          className="w-full border-gray-300 border rounded px-3 py-2 text-sm"
          value={fromCoin}
          onChange={(e) => setFromCoin(e.target.value)}
          placeholder="From coin type address (e.g., 0x2::sui::SUI)"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">To (Coin Type)</label>
        <input
          type="text"
          className="w-full border-gray-300 border rounded px-3 py-2 text-sm"
          value={toCoin}
          onChange={(e) => setToCoin(e.target.value)}
          placeholder="To coin type address"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">
          Amount ({fromCoin === SUI_TYPE ? "SUI" : "Coin"} to Swap)
        </label>
        <input
          type="text"
          className="w-full border-gray-300 border rounded px-3 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount to swap"
        />
      </div>
      {fromCoin !== SUI_TYPE && (
        <div className="mb-4">
          <label className="block font-medium mb-1">
            Coin Object ID (for input token)
          </label>
          <input
            type="text"
            className="w-full border-gray-300 border rounded px-3 py-2 text-sm"
            value={coinObjectId}
            onChange={(e) => setCoinObjectId(e.target.value)}
            placeholder="Object ID of your input coin"
          />
          <p className="text-xs text-gray-600 mt-1">
            * Required for non-SUI tokens: provide an object ID of a coin of
            type {fromCoin} in your wallet to spend.
          </p>
        </div>
      )}
      {/* Quote and Swap Actions */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleGetQuote}
          disabled={quoteLoading || !fromCoin || !toCoin || !amount}
          className={`mr-2 px-4 py-2 rounded text-white ${
            quoteLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {quoteLoading ? "Fetching Quote..." : "Get Quote"}
        </button>
        <button
          type="button"
          onClick={handleSwap}
          disabled={!canSwap}
          className={`px-4 py-2 rounded text-white ${
            canSwap ? "bg-green-600 hover:bg-green-700" : "bg-gray-400"
          }`}
        >
          {isSigning ? "Signing..." : "Swap"}
        </button>
      </div>
      {/* Display Quote Output */}
      {quote && !quoteLoading && (
        <div className="mb-4 p-3 bg-gray-50 border rounded text-sm">
          <div>
            <strong>Estimated Output:</strong>{" "}
            {displayedOutput ? `${displayedOutput} (of ${toCoin})` : "N/A"}
          </div>
          <div className="text-xs text-gray-600">
            Route via {quote.routes.length > 0 && quote.routes[0].path.length}{" "}
            pool(s) obtained from NAVI.
          </div>
        </div>
      )}
      {/* Display Success or Error Messages */}
      {txDigest && (
        <div className="mb-4 text-sm text-green-600">
          ✅ Swap successful! Transaction Digest: <code>{txDigest}</code>
        </div>
      )}
      {(quoteError || swapError) && (
        <div className="mb-4 text-sm text-red-500">
          ⚠️ {quoteError || swapError}
        </div>
      )}
      {!currentAccount && (
        <div className="text-sm text-gray-500">
          Connect your wallet to execute the swap.
        </div>
      )}
    </div>
  );
}

export default SwapForm;
