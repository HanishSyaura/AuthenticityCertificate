import React from 'react';

const isDev = import.meta.env.DEV;

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error('Unknown error') };
  }

  componentDidCatch(error, info) {
    try {
      console.error(error, info);
    } catch {
      void 0;
    }
  }

  render() {
    const error = this.state?.error;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-zinc-100">
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="text-sm font-semibold text-zinc-900">Something went wrong</div>
            <div className="mt-1 text-sm text-zinc-600">Try reloading the page. If this keeps happening, contact your administrator.</div>
            {isDev ? (
              <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
                {String(error?.stack || error?.message || error)}
              </pre>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                type="button"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => this.setState({ error: null })}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
