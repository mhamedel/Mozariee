import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'حدث خطأ غير متوقع في التطبيق.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#F5F7F5] text-[#0F1F18] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white border border-[#DCE3DD] rounded-2xl p-6 shadow-sm space-y-4">
            <h1 className="text-base font-bold text-[#0F1F18]">حدث خطأ أثناء تشغيل المنصة</h1>
            <p className="text-xs text-[#475569] leading-relaxed">
              يرجى إعادة تحميل الصفحة أو المحاولة مرة أخرى. تم تسجيل تفاصيل الخطأ للمراجعة.
            </p>
            {this.state.errorMessage && (
              <div className="p-3 rounded-lg bg-[#FAFBF9] border border-[#E2E7E3] text-[11px] font-mono-nums text-[#64748B] break-all" dir="ltr">
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
