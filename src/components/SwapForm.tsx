import { useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui.js/client"; // Sui RPC client
import { getSwapQuote, buildSwapTransaction } from "../services/navi";
import QuoteDisplay from "./QuoteDisplay";

interface SwapFormProps {
  onNetworkError?: (msg: string | null) => void;
}

const SUI_COIN = "0x2::sui::SUI"; // SUI coin type
const USDC_COIN =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"; // Native USDC on Sui&#8203;:contentReference[oaicite:3]{index=3}
const CETUS_COIN =
  "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS"; // CETUS token on Sui&#8203;:contentReference[oaicite:4]{index=4}

// Predefined token options for the dropdown (label and coin type)
const tokenOptions = [
  { label: "SUI (Sui)", value: SUI_COIN },
  { label: "USDC (Circle)", value: USDC_COIN },
  { label: "CETUS (Cetus)", value: CETUS_COIN },
];

const defaultSlippage =
  parseFloat(import.meta.env.VITE_DEFAULT_SLIPPAGE) || 0.5;

const SwapForm: React.FC<SwapFormProps> = ({ onNetworkError }) => {
  const account = useCurrentAccount();
  const [fromCoin, setFromCoin] = useState<string>(SUI_COIN);
  const [toCoin, setToCoin] = useState<string>(USDC_COIN);
  const [amount, setAmount] = useState<string>(""); // amount input as string
  const [slippage, setSlippage] = useState<number>(defaultSlippage);
  const [quote, setQuote] = useState<{
    amountOut: string;
    amountOutFormatted: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(false);
  const [swapping, setSwapping] = useState<boolean>(false);

  // Sui wallet transaction signing hook
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  // Handler: Fetch swap quote using NAVI aggregator
  const handleGetQuote = async () => {
    setError(null);
    setQuote(null);
    // Basic validation
    if (!fromCoin || !toCoin) {
      setError("Please select both tokens.");
      return;
    }
    if (fromCoin === toCoin) {
      setError("Please select two different tokens for swap.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount to swap.");
      return;
    }

    setLoadingQuote(true);
    try {
      // Fetch quote from NAVI aggregator SDK
      const res = await getSwapQuote(fromCoin, toCoin, amount);
      if (res) {
        // Format the output for display (human-readable)
        setQuote({
          amountOut: res.amount_out,
          amountOutFormatted: res.amount_out_formatted,
        });
      } else {
        setError("No swap route found for the selected pair."); // handle if undefined
      }
    } catch (err: any) {
      console.error("Quote fetch error:", err);
      setError("Failed to fetch quote. Please try again.");
    } finally {
      setLoadingQuote(false);
    }
  };

  // Handler: Execute the swap transaction
  const handleSwap = async () => {
    setError(null);
    if (!account) {
      setError("Please connect your wallet before swapping.");
      return;
    }
    if (!fromCoin || !toCoin || !amount) {
      setError("Please enter swap details and fetch a quote first.");
      return;
    }
    if (fromCoin === toCoin) {
      setError("From and To tokens must be different.");
      return;
    }
    if (!quote) {
      setError("Please fetch a quote before executing the swap.");
      return;
    }

    setSwapping(true);
    try {
      // Build the transaction for the swap
      const client = new SuiClient({ url: import.meta.env.VITE_SUI_RPC_URL });
      const tx = await buildSwapTransaction(
        account.address,
        fromCoin,
        toCoin,
        amount,
        slippage,
        client
      );
      // Use wallet to sign & execute the transaction
      await signAndExecuteTransaction(
        { transaction: tx, chain: "sui:mainnet" },
        {
          onSuccess: (result) => {
            console.log("Swap transaction success:", result);
            // You could add any post-transaction logic here (e.g., refresh balances)
          },
          onError: (error) => {
            console.error("Swap transaction failed:", error);
            setError("Swap transaction failed: " + (error.message || error));
          },
        }
      );
    } catch (err: any) {
      console.error("Swap execution error:", err);
      setError(err.message || "Swap failed. Check console for details.");
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="bg-white shadow rounded p-4">
      {/* Token selection and amount input */}
      <div className="flex flex-col space-y-4">
        <div>
          <label className="block font-medium mb-1">From:</label>
          <div className="flex">
            <select
              className="flex-1 border border-gray-300 p-2 rounded-l"
              value={fromCoin}
              onChange={(e) => setFromCoin(e.target.value)}
            >
              {tokenOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              className="w-32 border-t border-b border-gray-300 p-2 rounded-r"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">To:</label>
          <select
            className="w-full border border-gray-300 p-2 rounded"
            value={toCoin}
            onChange={(e) => setToCoin(e.target.value)}
          >
            {tokenOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">
            Slippage Tolerance (%):
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="w-full border border-gray-300 p-2 rounded"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
          />
        </div>

        {/* Quote Display */}
        <QuoteDisplay
          quote={quote}
          loading={loadingQuote}
          error={error}
          fromCoin={fromCoin}
          toCoin={toCoin}
        />

        {/* Action buttons */}
        <div className="flex space-x-2 mt-2">
          <button
            type="button"
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
            onClick={handleGetQuote}
            disabled={loadingQuote || swapping}
          >
            {loadingQuote ? "Fetching..." : "Get Quote"}
          </button>
          <button
            type="button"
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded disabled:opacity-50"
            onClick={handleSwap}
            disabled={!account || swapping || !!error || !quote}
          >
            {swapping ? "Swapping..." : "Swap"}
          </button>
        </div>

        {/* If wallet not connected, hint to connect */}
        {!account && (
          <p className="text-red-600 text-sm mt-2 text-center">
            Connect your wallet to execute the swap.
          </p>
        )}
      </div>
    </div>
  );
};

export default SwapForm;
