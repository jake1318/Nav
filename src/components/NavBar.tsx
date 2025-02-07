import { ConnectButton } from "@mysten/dapp-kit";

function NavBar() {
  return (
    <header className="bg-gray-800 text-white p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold">SUI Swap</h1>
      {/* Wallet Connect/Disconnect button (automatically manages state) */}
      <ConnectButton connectText="Connect Wallet" />
    </header>
  );
}

export default NavBar;
