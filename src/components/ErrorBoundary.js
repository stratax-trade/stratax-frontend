import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "2rem",
            background: "rgba(220, 53, 69, 0.1)",
            border: "1px solid rgba(220, 53, 69, 0.3)",
            borderRadius: "12px",
            color: "#ff6b7a",
          }}
        >
          <h2>Something went wrong</h2>
          <p>
            The chart failed to load. Please refresh the page or try again
            later.
          </p>
          {this.state.error && (
            <details style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
              <summary>Error details</summary>
              <pre style={{ marginTop: "0.5rem", overflow: "auto" }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
