import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-2 h-2 rounded-full bg-primary animate-amber-pulse" />
          <div className="space-y-2">
            <h1 className="font-display text-2xl text-foreground">
              Something interrupted the workspace
            </h1>
            <p className="font-ui text-sm text-muted-foreground">
              An unexpected error stopped this view from loading. Your work is safe — try reloading to continue.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-muted-foreground bg-muted/40 border border-border rounded-md p-3 overflow-auto max-h-40">
              {error.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reset}
              className="px-4 py-2 text-sm font-ui rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-ui rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
