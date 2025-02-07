import { configureStore } from "@reduxjs/toolkit";
import swapReducer from "./slices/swapSlice";

const store = configureStore({
  reducer: {
    swap: swapReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }), // disable serializable check for ease (if needed)
});

// Export types for usage in components (optional for TS convenience)
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
