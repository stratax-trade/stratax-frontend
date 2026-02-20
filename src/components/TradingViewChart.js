import React, { useEffect, useRef, memo, useState } from "react";
import "./TradingViewChart.css";

const TradingViewChart = ({ symbol = "BINANCE:BTCUSDT" }) => {
  const container = useRef();
  const [containerId] = useState(
    `tradingview_${Math.random().toString(36).substring(7)}`,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    // Clear any existing widget
    if (container.current) {
      container.current.innerHTML = "";
    }

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mounted || !container.current) return;

      try {
        const script = document.createElement("script");
        script.src =
          "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;

        // Add crossorigin attribute
        script.crossOrigin = "anonymous";

        script.innerHTML = JSON.stringify({
          autosize: true,
          symbol: symbol,
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          backgroundColor: "rgba(10, 14, 39, 1)",
          gridColor: "rgba(255, 255, 255, 0.06)",
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          toolbar_bg: "#0a0e27",
          withdateranges: true,
          allow_symbol_change: true,
          studies: [],
        });

        script.onload = () => {
          if (mounted) {
            setIsLoading(false);
          }
        };

        script.onerror = (e) => {
          console.error("Failed to load TradingView widget script", e);
          if (mounted) {
            setHasError(true);
            setIsLoading(false);
          }
        };

        if (container.current) {
          container.current.appendChild(script);
        }
      } catch (error) {
        console.error("Error loading TradingView chart:", error);
        if (mounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (container.current) {
        try {
          container.current.innerHTML = "";
        } catch (error) {
          // Silently fail on cleanup
        }
      }
    };
  }, [symbol, containerId]);

  if (hasError) {
    return (
      <div className="tradingview-widget-container">
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#a8b3cf",
          }}
        >
          <p>Chart temporarily unavailable</p>
          <small>Unable to load TradingView widget</small>
        </div>
      </div>
    );
  }

  return (
    <div className="tradingview-widget-container">
      {isLoading && (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "#a8b3cf",
          }}
        >
          Loading chart...
        </div>
      )}
      <div
        id={containerId}
        className="tradingview-widget-container__widget"
        ref={container}
        style={{ display: isLoading ? "none" : "block" }}
      />
    </div>
  );
};

export default memo(TradingViewChart);
