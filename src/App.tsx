import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import NavBar from "./components/NavBar";

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation bar with Connect Wallet button */}
      <NavBar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Additional routes can be added here for future expansion */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
