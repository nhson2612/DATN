import { Component } from "react";

export default class ErrorBoundary extends Component {
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
        <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl mx-auto">
            <i className="fa-solid fa-triangle-exclamation" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Có lỗi xảy ra</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {this.state.error?.message || "Ứng dụng gặp sự cố ngoài dự kiến."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-xs !py-2 !px-4"
          >
            Thử tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
