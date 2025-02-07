import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

import store from "./store";
import App from "./App";
import "@mysten/dapp-kit/dist/index.css"; // Sui dApp Kit default styling (for ConnectButton, etc.)
import "./index.css"; // Tailwind CSS styles

// Configure Sui network (Mainnet only)
const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl("mainnet") },
});
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {/* Connect to Sui Mainnet via SuiClientProvider */}
        <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
          <WalletProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
