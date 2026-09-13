import React, { Component, ErrorInfo, ReactNode } from 'react';
import { strings } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('locateit_active_host_state');
      localStorage.removeItem('locateit_active_game_code');
      localStorage.removeItem('locateit_saved_guess');
      localStorage.removeItem('locateit_saved_round');
      localStorage.removeItem('locateit_join_intent');
    } catch {
      // ignore
    }
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f9fbfa] text-[#0f1a16] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-black/5 space-y-6">
            <div className="w-16 h-16 bg-[#7c2d12]/10 text-[#7c2d12] rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-[#0f1a16]">{strings.errorBoundary.title}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-[#2d4239]/60 mt-2">
                {strings.errorBoundary.desc}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-4 btn-sleek btn-sleek-pine !bg-[#2d4239] text-xs font-black uppercase tracking-widest shadow-lg"
            >
              {strings.errorBoundary.returnHome}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
