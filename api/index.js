const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all origins (adjust in production as needed)

const NAVI_API_BASE = "https://open-aggregator-api.naviprotocol.io";
const API_KEY = process.env.NAVI_API_KEY; // NAVI API key from environment (for authenticated requests)

// Endpoint: GET /api/quote
// Fetch swap quote from NAVI aggregator (via NAVI open API)
app.get("/api/quote", async (req, res) => {
  const { from, to, amount } = req.query;
  if (!from || !to || !amount) {
    return res
      .status(400)
      .json({ error: "Missing required query parameters: from, to, amount" });
  }
  try {
    // Build request to NAVI aggregator API /find_routes
    const url = `${NAVI_API_BASE}/find_routes?from=${encodeURIComponent(
      from
    )}&target=${encodeURIComponent(to)}&amount=${encodeURIComponent(
      amount
    )}&by_amount_in=true&depth=3`;
    const headers = {};
    if (API_KEY) {
      headers["x-navi-token"] = API_KEY; // include API key if available (optional for NAVI API)
    }
    console.log(
      `Fetching quote from NAVI for swap ${from} -> ${to}, amount: ${amount}`
    );
    const response = await axios.get(url, { headers });
    // Forward the entire response data from NAVI
    res.json(response.data);
  } catch (error) {
    console.error(
      "NAVI quote fetch error:",
      error.response ? error.response.data : error.message
    );
    // Handle errors and respond with a message
    const status = error.response ? error.response.status : 500;
    const message =
      error.response && error.response.data && error.response.data.error
        ? error.response.data.error
        : "Failed to fetch quote from NAVI";
    res.status(status).json({ message });
  }
});

// Endpoint: POST /api/swap
// Facilitate executing a swap via NAVI (this could prepare or log a swap request)
// (Optional enhancement: This could initiate on-chain swap or record the request)
app.post("/api/swap", async (req, res) => {
  try {
    // In this architecture, the actual swap is executed on the frontend via the user's wallet.
    // This endpoint could be used for logging or additional verification if needed.
    console.log("Swap execution requested:", req.body);
    // For demonstration, simply return success.
    return res.json({
      success: true,
      message: "Swap transaction sent to network.",
    });
  } catch (error) {
    console.error("Swap execution error:", error.message);
    res.status(500).json({ message: "Swap execution failed" });
  }
});

// Health check (optional)
app.get("/api/health", (req, res) => {
  res.send("Backend is running");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Express server running on port ${PORT}`);
});
