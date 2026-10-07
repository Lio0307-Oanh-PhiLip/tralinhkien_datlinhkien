import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  isModal?: boolean;
  onReset?: () => void;
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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.reloadWindow) {
        (window as any).electronAPI.reloadWindow();
      } else {
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      const content = (
        <div className="p-6 bg-neutral-900 border border-rose-800/80 rounded-2xl shadow-xl text-neutral-100 max-w-xl w-full mx-auto text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-950 flex items-center justify-center text-rose-400 border border-rose-800">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {this.props.fallbackTitle || 'Đã xảy ra lỗi hiển thị tạm thời'}
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              Ứng dụng đã tự động ngăn chặn sự cố. Bạn có thể nhấn nút bên dưới để khôi phục lại giao diện.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] text-rose-300 truncate max-w-full">
                {this.state.error.message}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 cursor-pointer transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{this.props.onReset ? 'Đóng & Thử lại' : 'Tải lại trang & khôi phục'}</span>
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  if (typeof window !== 'undefined' && (window as any).electronAPI?.reloadWindow) {
                    (window as any).electronAPI.reloadWindow();
                  } else {
                    window.location.reload();
                  }
                }}
                className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                Tải lại toàn bộ trang
              </button>
            )}
          </div>
        </div>
      );

      if (this.props.isModal) {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            {content}
          </div>
        );
      }

      return <div className="p-4">{content}</div>;
    }

    return this.props.children;
  }
}
