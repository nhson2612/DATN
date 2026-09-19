import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import "./SupportWidget.css";

function socketUrl() {
  const base = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000/api`;
  return `${base.replace(/^http/, "ws").replace(/\/api$/, "")}/ws/support?token=${encodeURIComponent(localStorage.getItem("token") || "")}`;
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}`;
  } catch {
    return "";
  }
}

export default function SupportWidget({ user, onNeedAuth }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("new"); // "new" hoặc "history"
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endRef = useRef(null);
  const activeIdRef = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (user?.role !== "user") return;
    try {
      const result = await api.supportConversations();
      const list = result.conversations || [];
      setItems(list);
      // Nếu đã có lịch sử hội thoại thì mặc định hiển thị tab lịch sử
      if (list.length > 0) {
        setActiveTab("history");
      }
    } catch (err) {
      setError(err.message || "Không thể tải danh sách cuộc trò chuyện.");
    }
  }, [user?.role]);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const result = await api.supportMessages(conversationId);
      setMessages(result.messages || []);
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể tải tin nhắn.");
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  useEffect(() => {
    activeIdRef.current = active?.id || null;
  }, [active?.id]);

  useEffect(() => {
    if (user?.role !== "user") return undefined;
    const ws = new WebSocket(socketUrl());
    ws.onmessage = () => {
      load().catch((err) => setError(err.message));
      if (activeIdRef.current) {
        loadMessages(activeIdRef.current).catch((err) => setError(err.message));
      }
    };
    return () => {
      ws.close();
    };
  }, [user?.role, load, loadMessages]);

  useEffect(() => {
    if (active?.id) {
      loadMessages(active.id);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [active?.id, loadMessages]);

  const start = async (event) => {
    event.preventDefault();
    if (!subject.trim() || !text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      setError("");
      const result = await api.createSupportConversation({ subject: subject.trim(), message: text.trim() });
      setItems((current) => [result.conversation, ...current]);
      setActive(result.conversation);
      setMessages([result.message, result.assistant_message].filter(Boolean));
      setSubject("");
      setText("");
    } catch (err) {
      setError(err.message || "Không thể gửi yêu cầu hỗ trợ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const send = async (event) => {
    if (event) event.preventDefault();
    if (!active || !text.trim() || isSubmitting) return;
    const messageContent = text.trim();
    setText("");
    setIsSubmitting(true);
    try {
      setError("");
      const result = await api.sendSupportMessage(active.id, { body: messageContent });
      setMessages((current) => [...current, result.message, result.assistant_message].filter(Boolean));
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể gửi tin nhắn.");
      setText(messageContent); // khôi phục lại nội dung nếu lỗi
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Không hiển thị widget cho Operator hoặc Admin vì họ có trang quản trị riêng
  if (user?.role === "operator" || user?.role === "admin") return null;

  return (
    <>
      {/* 1. Nút nổi mở Widget (Floating Action Button - Nút tròn tối giản) */}
      <button
        type="button"
        className={`sp-fab ${open ? "sp-fab--open" : ""}`}
        onClick={() => (user ? setOpen((prev) => !prev) : onNeedAuth())}
        aria-label={open ? "Đóng hỗ trợ" : "Mở hỗ trợ"}
        title={open ? "Đóng hỗ trợ" : "Hỗ trợ trực tuyến"}
      >
        <div className="sp-fab__icon-wrap">
          <span className="material-symbols-outlined sp-fab__icon sp-fab__icon--chat">
            support_agent
          </span>
          <span className="material-symbols-outlined sp-fab__icon sp-fab__icon--close">
            close
          </span>
        </div>
        {!open && <span className="sp-fab__badge-dot" />}
      </button>

      {/* 2. Cửa sổ chat Widget */}
      {open && (
        <section className="sp-window" aria-label="Hỗ trợ khách hàng">
          {/* Header */}
          <header className="sp-header">
            <div className="sp-header__main">
              {active ? (
                <button
                  type="button"
                  className="sp-header__back-btn"
                  onClick={() => setActive(null)}
                  title="Quay lại danh sách"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
              ) : (
                <div className="sp-header__avatar">
                  <span className="material-symbols-outlined text-white text-xl">headset_mic</span>
                </div>
              )}

              <div className="sp-header__info">
                {active ? (
                  <>
                    <h3 className="sp-header__title truncate" title={active.subject}>
                      {active.subject}
                    </h3>
                    <p className="sp-header__subtitle truncate">
                      {active.company_name ? `Nhà tổ chức: ${active.company_name}` : "Chuyên viên hỗ trợ"}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="sp-header__title">Trung tâm Hỗ trợ</h3>
                    <p className="sp-header__subtitle flex items-center gap-1">
                      <span className="sp-header__pulse-dot" />
                      Trực tuyến • Sẵn sàng phản hồi
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              className="sp-header__close-btn"
              onClick={() => setOpen(false)}
              aria-label="Thu nhỏ"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </header>

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="sp-error" role="alert">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError("")} className="text-rose-500 hover:text-rose-700">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Nội dung bên trong */}
          {!active ? (
            <div className="sp-body">
              {/* Lời chào mở đầu */}
              <div className="sp-welcome-card">
                <h4 className="text-sm font-bold text-zinc-900">Xin chào Quý khách! 👋</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Đội ngũ chăm sóc khách hàng của Đi Đâu luôn sẵn sàng giải đáp thắc mắc và hỗ trợ bạn đặt tour nhanh chóng.
                </p>
              </div>

              {/* Thanh chuyển tab: Lịch sử chat vs Yêu cầu mới */}
              {items.length > 0 && (
                <div className="sp-tabs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={`sp-tabs__btn ${activeTab === "history" ? "sp-tabs__btn--active" : ""}`}
                  >
                    Cuộc trò chuyện ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("new")}
                    className={`sp-tabs__btn ${activeTab === "new" ? "sp-tabs__btn--active" : ""}`}
                  >
                    + Yêu cầu mới
                  </button>
                </div>
              )}

              {/* Tab 1: Danh sách cuộc trò chuyện trước đây */}
              {activeTab === "history" && items.length > 0 ? (
                <div className="sp-conversations">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="sp-conversation-card"
                      onClick={() => setActive(item)}
                    >
                      <div className="sp-conversation-card__main min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="sp-conversation-card__subject truncate">
                            {item.subject}
                          </strong>
                          {item.updated_at && (
                            <span className="sp-conversation-card__date">
                              {formatDate(item.updated_at)}
                            </span>
                          )}
                        </div>
                        <p className="sp-conversation-card__preview truncate">
                          {item.preview || "Chưa có tin nhắn nào"}
                        </p>
                        <div className="sp-conversation-card__footer">
                          <span className="sp-conversation-card__tag">
                            {item.company_name || "Hỗ trợ khách hàng"}
                          </span>
                          <span className="material-symbols-outlined sp-conversation-card__arrow" aria-hidden="true">
                            arrow_forward
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Tab 2: Form gửi yêu cầu mới */
                <form className="sp-form" onSubmit={start}>
                  <div className="sp-form__field">
                    <label className="sp-form__label" htmlFor="supportSubject">
                      Vấn đề bạn cần hỗ trợ <span className="text-rose-500">*</span>
                    </label>
                    <div className="sp-form__input-wrap">
                      <span className="material-symbols-outlined sp-form__field-icon">help_outline</span>
                      <input
                        id="supportSubject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ví dụ: Tư vấn lịch trình, đổi ngày khởi hành..."
                        required
                        className="sp-form__input"
                      />
                    </div>
                  </div>

                  <div className="sp-form__field">
                    <label className="sp-form__label" htmlFor="supportMessage">
                      Nội dung chi tiết <span className="text-rose-500">*</span>
                    </label>
                    <div className="sp-form__input-wrap">
                      <textarea
                        id="supportMessage"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Mô tả cụ thể thắc mắc hoặc yêu cầu của bạn..."
                        required
                        rows={3}
                        className="sp-form__textarea"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !subject.trim() || !text.trim()}
                    className="sp-btn-submit"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    <span>{isSubmitting ? "Đang kết nối..." : "Bắt đầu trò chuyện"}</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* 3. Giao diện Chat trực tiếp khi đã chọn cuộc trò chuyện */
            <div className="sp-chat">
              {/* Danh sách tin nhắn */}
              <div className="sp-messages">
                {messages.length === 0 ? (
                  <div className="sp-messages__empty">
                    <span className="material-symbols-outlined text-3xl text-zinc-300">chat</span>
                    <p>Hãy để lại tin nhắn, nhân viên hỗ trợ sẽ phản hồi trong giây lát.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isCustomer = message.sender_role === "customer";
                    const isAssistant = message.sender_role === "assistant";
                    return (
                      <div
                        key={message.id}
                        className={`sp-bubble-wrap ${isCustomer ? "sp-bubble-wrap--customer" : "sp-bubble-wrap--operator"}`}
                      >
                        {!isCustomer && (
                          <div className="sp-bubble__avatar">
                            <span className="material-symbols-outlined text-sm text-zinc-600">{isAssistant ? "smart_toy" : "support_agent"}</span>
                          </div>
                        )}
                        <div className="sp-bubble-content">
                          <div className={`sp-bubble ${isCustomer ? "sp-bubble--customer" : "sp-bubble--operator"} ${isAssistant ? "sp-bubble--assistant" : ""}`}>
                            {message.body}
                          </div>
                          {message.created_at && (
                            <span className="sp-bubble__time">
                              {formatTime(message.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Thanh soạn tin nhắn */}
              <form className="sp-compose" onSubmit={send}>
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn..."
                  className="sp-compose__input"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || isSubmitting}
                  className="sp-compose__send-btn"
                  aria-label="Gửi tin nhắn"
                >
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </form>
            </div>
          )}
        </section>
      )}
    </>
  );
}
