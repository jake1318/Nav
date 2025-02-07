import { getRoute, swapPTB } from "navi-aggregator-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui.js/client";

// Helper: Map of token decimals for formatting (could be expanded or fetched dynamically)
const TOKEN_DECIMALS: Record<string, number> = {
  "0x2::sui::SUI": 9,
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": 6,
  "0x6864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS": 9,
};

/**
 * Fetch the best swap quote from NAVI Aggregator.
 * @param fromCoin Coin type of input token (full type string)
 * @param toCoin Coin type of output token (full type string)
 * @param amount Input amount (in human-readable units, e.g., "1.5" for 1.5 tokens)
 */
export async function getSwapQuote(
  fromCoin: string,
  toCoin: string,
  amount: string
) {
  // Convert amount to number or bigint if needed
  let amountIn: number | bigint;
  if (amount.includes(".") || Number(amount) % 1 !== 0) {
    // If amount is non-integer, use Number (SDK will handle conversion to atomic units if needed)
    amountIn = parseFloat(amount);
  } else {
    // If integer, use BigInt to avoid precision issues for very large values
    amountIn = BigInt(amount);
  }

  // Call NAVI SDK to get the quote
  const quote = await getRoute(fromCoin, toCoin, amountIn);
  // The quote object contains amount_in, amount_out, and route details&#8203;:contentReference[oaicite:8]{index=8}.
  // If no route is found, quote may be undefined or have amount_out = 0.
  if (!quote || !quote.amount_out) {
    return null;
  }

  // Format the output amount for display (using known decimals if available)
  const toDecimals = TOKEN_DECIMALS[toCoin] || 9; // default to 9 if unknown
  let amountOutFormatted: string;
  try {
    // Try to format using BigInt to avoid precision issues
    const amountOutBn = BigInt(quote.amount_out);
    const divisor = BigInt(10) ** BigInt(toDecimals);
    const whole = amountOutBn / divisor;
    const fraction = amountOutBn % divisor;
    // Pad fraction to the correct number of decimals
    const fractionStr = fraction
      .toString()
      .padStart(toDecimals, "0")
      .replace(/0+$/, "");
    amountOutFormatted = fractionStr
      ? `${whole.toString()}.${fractionStr}`
      : whole.toString();
  } catch {
    // Fallback: format as float if BigInt fails (e.g., if amount_out is not a pure number string)
    const raw = parseFloat(quote.amount_out);
    amountOutFormatted = raw
      ? (raw / Math.pow(10, toDecimals)).toFixed(Math.min(6, toDecimals))
      : quote.amount_out.toString();
  }

  // Append token symbol or name for clarity in UI (optional enhancement)
  // e.g., we could map coin types to symbols like "USDC", "SUI", etc., but for simplicity we skip that here.

  return {
    amount_in: quote.amount_in,
    amount_out: quote.amount_out,
    amount_out_formatted: amountOutFormatted,
    routes: quote.routes, // This could be used to show which DEX route was chosen (not displayed in UI now)
  };
}

/**
 * Build a Sui Transaction for swapping tokens via NAVI Aggregator.
 * This uses the NAVI SDK to construct the transaction block with the appropriate calls.
 *
 * @param userAddress The Sui address of the user initiating the swap.
 * @param fromCoin Coin type of input token.
 * @param toCoin Coin type of output token.
 * @param amount Input amount (human-readable units, same as passed to getSwapQuote).
 * @param slippage Slippage tolerance in percent (e.g., 0.5 for 0.5%).
 * @param suiClient An instance of SuiClient connected to Sui mainnet.
 * @returns A Transaction object representing the swap transaction.
 */
export async function buildSwapTransaction(
  userAddress: string,
  fromCoin: string,
  toCoin: string,
  amount: string,
  slippage: number,
  suiClient: SuiClient
) {
  // Convert amount to number or bigint (same approach as above)
  let amountIn: number | bigint;
  if (amount.includes(".") || Number(amount) % 1 !== 0) {
    amountIn = parseFloat(amount);
  } else {
    amountIn = BigInt(amount);
  }

  // Get a fresh quote to determine minimum acceptable output after slippage
  const quote = await getSwapQuote(fromCoin, toCoin, amount);
  if (!quote) {
    throw new Error("No route found for the swap. Aborting transaction.");
  }
  // Calculate minimum amount out based on slippage tolerance
  const amountOutNum = BigInt(quote.amount_out);
  const slippageBps = Math.round(slippage * 100); // convert % to basis points (1% = 100 bps)
  const minAmountOut =
    (amountOutNum * BigInt(10000 - slippageBps)) / BigInt(10000);

  // Create a new programmable transaction (Transaction Block)
  const tx = new Transaction();
  let coinIn;
  if (fromCoin === "0x2::sui::SUI") {
    // If swapping SUI itself, split off the required amount from the gas coin
    coinIn = tx.splitCoins(tx.gas, [tx.pure(amountIn)]);
  } else {
    // For other tokens, fetch an owned coin object of that type to use as input
    const coins = await suiClient.getCoins({
      owner: userAddress,
      coinType: fromCoin,
    });
    if (!coins.data || coins.data.length === 0) {
      throw new Error("No coins of the source token found in your wallet.");
    }
    // Find a coin with sufficient balance
    const coin = coins.data.find(
      (c) => BigInt(c.balance) >= BigInt(quote.amount_in)
    );
    if (!coin) {
      throw new Error("Insufficient balance for the swap amount.");
    }
    // Use this coin object as the input coin
    coinIn = tx.object(coin.coinObjectId);
  }

  // Use NAVI's SDK to append the swap operations to the transaction block.
  const coinOut = await swapPTB(
    userAddress,
    tx,
    fromCoin,
    toCoin,
    coinIn,
    amountIn,
    Number(minAmountOut), // minAmountOut as number (SDK expects number for this parameter)
    {
      referer: "sui-swap-app", // referer for tracking (optional)
      byAmountIn: true, // we are specifying input amount
      // other options like dexList or depth can use defaults
    }
  );

  // The swapPTB returns the output coin object in the transaction context.
  // We need to transfer this coin to the user's address as the final step of the transaction.
  tx.transferObjects([coinOut], tx.pure(userAddress));

  // (Optional) Set a gas budget for the transaction.
  // This is optional because the wallet or RPC may estimate gas. We'll set a reasonable budget.
  tx.setGasBudget(100_000_000n); // 0.1 SUI budget (just an estimate)

  return tx;
}
