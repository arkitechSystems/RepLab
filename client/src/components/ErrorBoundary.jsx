import { Component } from 'react';
import { Sentry } from '../sentry';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Report to Sentry with component stack when available, fall back to console
    if (Sentry?.captureException) {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: info?.componentStack } },
      });
    } else {
      console.error('App crash caught by ErrorBoundary:', error, info?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-6 relative">
          <div className="ambient-bg" />
          <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center relative z-10">
            <div className="w-16 h-16 rounded-full bg-wf-red/10 border border-wf-red/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Something broke</h2>
            <p className="text-sm text-wf-gray-400 mb-6 leading-relaxed">
              We hit an unexpected error. Your data is safe — try reloading, or head back home.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all"
              >
                Reload
              </button>
              <a
                href="/"
                onClick={() => this.setState({ hasError: false })}
                className="w-full text-wf-gray-400 hover:text-white text-sm font-medium py-2 transition-colors"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
