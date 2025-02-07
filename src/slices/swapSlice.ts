import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

// Define TypeScript types for our state
interface QuoteData {
  amount_in: string;
  amount_out: string;
  routes: any[];
}
interface SwapState {
  quote: QuoteData | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: SwapState = {
  quote: null,
  loading: false,
  error: null,
};

// Async thunk to fetch swap quote from backend (NAVI aggregator)
export const fetchQuoteThunk = createAsyncThunk<
  QuoteData,
  { from: string; to: string; amount: string },
  { rejectValue: string }
>("swap/fetchQuote", async ({ from, to, amount }, thunkAPI) => {
  try {
    const baseURL = import.meta.env.VITE_BACKEND_URL || "";
    const response = await axios.get(`${baseURL}/api/quote`, {
      params: { from, to, amount },
    });
    const data = response.data;
    // The backend returns data from NAVI; ensure we extract the quote object
    const quote: QuoteData = data.data ? data.data : data;
    console.log("Fetched quote data:", quote);
    return quote;
  } catch (err: any) {
    console.error("Error fetching quote:", err);
    // Determine error message
    let message = "Failed to fetch quote";
    if (err.response && err.response.data) {
      message = err.response.data.message || message;
    } else if (err.message) {
      message = err.message;
    }
    return thunkAPI.rejectWithValue(message);
  }
});

// Create Redux slice
const swapSlice = createSlice({
  name: "swap",
  initialState,
  reducers: {
    // (We could add reducers for setting input values if we stored them in state)
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuoteThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.quote = null;
      })
      .addCase(
        fetchQuoteThunk.fulfilled,
        (state, action: PayloadAction<QuoteData>) => {
          state.loading = false;
          state.quote = action.payload;
          state.error = null;
        }
      )
      .addCase(fetchQuoteThunk.rejected, (state, action) => {
        state.loading = false;
        state.quote = null;
        state.error =
          action.payload || action.error.message || "Quote fetch failed";
      });
  },
});

export default swapSlice.reducer;
