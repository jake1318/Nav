import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider, SuiClientProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

import App from "./App";
import "./index.css"; // Import Tailwind CSS

// Set up React Query client (for dApp kit internal usage)
const queryClient = new QueryClient();

// Configure Sui networks for SuiClientProvider (mainnet only for this app)
const networks = {
  mainnet: {
    url: import.meta.env.VITE_SUI_RPC_URL || getFullnodeUrl("mainnet"),
  },
  // (We could include devnet/testnet for development, but this app is mainnet-only)
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Provide Sui RPC client (defaulting to mainnet) */}
      <SuiClientProvider networks={networks} defaultNetwork="mainnet">
        {/* Provide wallet context for all wallet adapters */}
        <WalletProvider>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
