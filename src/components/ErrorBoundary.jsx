import React from 'react';

/**
 * App-level error boundary.
 *
 * Without this, any render-time exception (a malformed pick row, an
 * unexpected null from Supabase, a bad date) unmounts the whole React tree
 * and leaves users staring at a blank white screen with no way out but a
 * manual refresh. This catches the error, keeps the shell alive, and offers
 * a one-tap reload — important for an installed PWA where a white screen looks
 * like the app is simply broken.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface it for debugging; a real logging sink could hook in here.
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6">
        <div className="max-w-sm w-full text-center card p-6">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            The app hit an unexpected error. Reloading usually fixes it. If it
            keeps happening, let your commissioner know.
          </p>
          <button
            onClick={this.handleReload}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 transition-colors"
          >
            Reload
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 text-left text-[11px] text-red-500 dark:text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
