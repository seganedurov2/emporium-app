import { Component, type ReactNode, type ErrorInfo } from 'react';
import { t } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    info: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ info: errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4" role="alert" aria-live="assertive">
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 shadow-2xl max-w-md text-left">
            <h3 className="text-sm font-bold text-red-400 mb-1">{t('error.title')}</h3>
            <p className="text-xs text-slate-300 mb-3">{this.state.error?.message || t('error.unknown')}</p>
            <button
              onClick={this.reset}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded border border-slate-700 transition cursor-pointer"
            >
              {t('error.retry')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  opts?: { fallback?: ReactNode; onError?: (error: Error, info: ErrorInfo) => void }
): React.ComponentType<P> {
  return class extends Component<P> {
    render() {
      return (
        <ErrorBoundary {...(opts as { fallback?: ReactNode; onError?: (error: Error, info: ErrorInfo) => void })}>
          <WrappedComponent {...(this.props as P)} />
        </ErrorBoundary>
      );
    }
  };
}
