import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-bg-surface border border-border rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-coral text-xl">!</span>
              </div>
              <h2 className="font-sora font-semibold text-text-primary text-lg mb-2">
                Something went wrong
              </h2>
              <p className="text-text-muted font-sans text-sm mb-6">
                {this.state.error?.message ?? "An unexpected error occurred."}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-coral text-white rounded-lg font-sans text-sm font-medium hover:bg-coral-hover transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
