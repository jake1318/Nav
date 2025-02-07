import React from "react";

interface QuoteDisplayProps {
  quote: { amountOut: string; amountOutFormatted: string } | null;
  loading: boolean;
  error: string | null;
  fromCoin: string;
  toCoin: string;
}

const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  loading,
  error,
  fromCoin,
  toCoin,
}) => {
  if (error) {
    // Display error messages (e.g., no route, fetch fail, swap fail)
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  if (loading) {
    return <p className="text-gray-600 text-sm">Fetching quote...</p>;
  }

  if (quote) {
    return (
      <div className="bg-gray-100 p-2 rounded text-sm">
        {/* Display the quote results */}
        <p>
          Estimated Output: <strong>{quote.amountOutFormatted}</strong>
        </p>
        <p className="text-gray-600">
          (For your input, you could receive approximately this many of the
          target token.)
        </p>
      </div>
    );
  }

  // Default message when no quote fetched yet
  return (
    <p className="text-gray-500 text-sm">
      Enter an amount and click "Get Quote" to see the expected output.
    </p>
  );
};

export default QuoteDisplay;
