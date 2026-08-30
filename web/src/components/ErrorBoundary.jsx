import { Component } from "react";

/* Một lỗi trong bản đồ không được phép xoá trắng cả trang.
 *
 * React gỡ toàn bộ cây khi một component ném lỗi mà không ai bắt. Đã xảy ra
 * thật: `fitBounds` với vùng nhìn rỗng ném lỗi từ trong maplibre, và người dùng
 * mất luôn danh sách lịch trình đang soạn dở chứ không chỉ mất bản đồ. */
export default class ErrorBoundary extends Component {
  state = { loi: null };

  static getDerivedStateFromError(loi) {
    return { loi };
  }

  componentDidCatch(loi, info) {
    // Vẫn phải in ra console: nuốt lỗi thì lần sau không lần được nguyên nhân.
    console.error("Lỗi trong", this.props.ten || "một phần giao diện", loi, info);
  }

  render() {
    if (!this.state.loi) return this.props.children;
    return (
      <div className="ui-card bg-white dark:bg-zinc-900 h-full grid place-items-center p-6">
        <div className="text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {this.props.ten || "Phần này"} gặp lỗi nên tạm không hiển thị được.
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Phần còn lại của trang vẫn dùng bình thường.
          </p>
          <button onClick={() => this.setState({ loi: null })} className="btn-ghost mt-4">
            Thử lại
          </button>
        </div>
      </div>
    );
  }
}
