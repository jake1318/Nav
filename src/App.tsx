import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import SwapForm from "./components/SwapForm";
import { useState } from "react";

function App() {
  const account = useCurrentAccount();
  const [networkError, setNetworkError] = useState<string | null>(null);

  // Check if connected wallet is on Sui mainnet:
  if (account && account.chains && !account.chains.includes("sui:mainnet")) {
    // If the connected wallet is not on mainnet, set an error message.
    setNetworkError("Please connect to a Sui wallet on Mainnet.");
  }

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">SUI Swap App</h1>
        <ConnectButton connectText="Connect Wallet" />
      </header>

      {/* Network error message (if any) */}
      {networkError && (
        <div className="bg-yellow-100 text-yellow-800 p-2 mb-4 text-center rounded">
          {networkError}
        </div>
      )}

      {/* Swap interface */}
      <SwapForm onNetworkError={setNetworkError} />
    </div>
  );
}

export default App;
