import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../shared/api";
import "./Support.css";

function wsUrl() {
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
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function getInitials(name) {
  if (!name) return "KH";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SupportScreen() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("OPEN"); // "OPEN" | "PENDING" | "CLOSED" | ""
  const [searchQuery, setSearchQuery] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const endRef = useRef(null);
  const activeIdRef = useRef(null);
  const textareaRef = useRef(null);
  const activeId = active?.id;

  const load = useCallback(async () => {
    try {
      const result = await api.supportInbox(filter);
      setItems(result.conversations || []);
    } catch (err) {
      setError(err.message || "Không thể tải danh sách hội thoại.");
    }
  }, [filter]);

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const result = await api.supportMessages(conversationId);
      setActive(result.conversation);
      setMessages(result.messages || []);
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể tải tin nhắn.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl());
    ws.onmessage = () => {
      load().catch((err) => setError(err.message));
      if (activeIdRef.current) {
        loadMessages(activeIdRef.current).catch((err) => setError(err.message));
      }
    };
    return () => {
      ws.close();
    };
  }, [load, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Lọc theo từ khóa tìm kiếm
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        (item.customer_name || "").toLowerCase().includes(q) ||
        (item.subject || "").toLowerCase().includes(q) ||
        (item.preview || "").toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const send = async (event) => {
    if (event) event.preventDefault();
    if (!text.trim() || !activeId || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      setError("");
      const result = await api.sendSupportMessage(activeId, { body: content });
      setMessages((current) => [...current, result.message]);
      load(); // Cập nhật lại inbox status
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể gửi tin nhắn.");
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const draft = async () => {
    if (!activeId || drafting) return;
    setDrafting(true);
    try {
      setError("");
      const result = await api.supportAiDraft(activeId);
      setText(result.draft || "");
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể tạo gợi ý AI.");
    } finally {
      setDrafting(false);
    }
  };

  const toggleStatus = async (newStatus) => {
    if (!activeId) return;
    try {
      setError("");
      await api.updateSupportConversation(activeId, { status: newStatus });
      await load();
      if (newStatus === "CLOSED") {
        setActive(null);
        setMessages([]);
      } else {
        await loadMessages(activeId);
      }
    } catch (err) {
      setError(err.message || "Không thể cập nhật trạng thái cuộc trò chuyện.");
    }
  };

  const takeOver = async () => {
    if (!activeId) return;
    try {
      setError("");
      const result = await api.takeOverSupportConversation(activeId);
      setActive((current) => ({ ...current, ...result.conversation }));
      await load();
    } catch (err) {
      setError(err.message || "Không thể nhận hội thoại.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="op-support__div-1">
      {/* 1. Header & Segmented Tabs chuẩn Shadcn */}
      <header className="op-support__header-2">
        <div>
          <h1 className="op-support__text-3">
            Hỗ trợ khách hàng
          </h1>
          <p className="op-support__text-4">
            Tiếp nhận và phản hồi thắc mắc của khách hàng theo thời gian thực.
          </p>
        </div>

        {/* Tabs lọc trạng thái theo chuẩn Shadcn Tabs */}
        <div className="op-support__div-5 op-support__div-1">
          <button
            type="button"
            onClick={() => setFilter("OPEN")}
            className={`op-support__button-8   ${
              filter === "OPEN"
                ? "op-support__button-6--variant-2"
                : "op-support__button-7--variant-3"
            }`}
          >
            Đang chờ
          </button>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`op-support__button-11   ${
              filter === "PENDING"
                ? "op-support__button-9--variant-2"
                : "op-support__button-10--variant-3"
            }`}
          >
            Đã phản hồi
          </button>
          <button
            type="button"
            onClick={() => setFilter("CLOSED")}
            className={`op-support__button-14   ${
              filter === "CLOSED"
                ? "op-support__button-12--variant-2"
                : "op-support__button-13--variant-3"
            }`}
          >
            Đã đóng
          </button>
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`op-support__button-17   ${
              filter === ""
                ? "op-support__button-15--variant-1"
                : "op-support__button-16--variant-2"
            }`}
          >
            Tất cả
          </button>
        </div>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="op-support__div-18 op-support__div-2">
          <div className="op-support__div-19">
            <span className="material-symbols-outlined op-support__span-20 op-support__span-3">error</span>
            <span className="op-support__icon-21">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="op-support__button-22 op-support__button-4"
          >
            <span className="material-symbols-outlined op-support__span-23">close</span>
          </button>
        </div>
      )}

      {/* 2. Main Desk Card: Split 2 pane (Inbox list + Chat detail) */}
      <div className="op-support__div-24 op-support__div-5">
        {/* Cột trái: Inbox Danh sách cuộc trò chuyện */}
        <aside className="op-support__aside-25">
          {/* Search bar */}
          <div className="op-support__div-26">
            <div className="op-support__div-27">
              <span className="material-symbols-outlined op-support__span-28">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên khách hoặc chủ đề..."
                className="op-support__element-29 op-support__element-6"
              />
            </div>
          </div>

          {/* List items */}
          <div className="op-support__conversation-list op-support__div-30">
            {filteredItems.length === 0 ? (
              <div className="op-support__div-31">
                <span className="material-symbols-outlined op-support__span-32">
                  inbox
                </span>
                Không có cuộc hội thoại nào.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = activeId === item.id;
                const statusTone =
                  item.status === "OPEN"
                    ? "open"
                    : item.status === "PENDING"
                    ? "pending"
                    : "closed";

                const statusLabel =
                  item.status === "OPEN"
                    ? "Chờ trả lời"
                    : item.status === "PENDING"
                    ? "Đã phản hồi"
                    : "Đã đóng";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadMessages(item.id)}
                    className={`op-support__button-35 ${
                      isSelected
                        ? "op-support__button-33--variant-1"
                        : "op-support__button-34--variant-2"
                    }`}
                  >
                    {/* Avatar Initials */}
                    <div className="op-support__div-36 op-support__div-7">
                      {getInitials(item.customer_name)}
                    </div>

                    {/* Content */}
                    <div className="op-support__div-37">
                      <div className="op-support__div-38">
                        <strong className="op-support__text-39">
                          {item.customer_name || "Khách hàng"}
                        </strong>
                        <span className="op-support__span-40 op-support__span-8">
                          {formatDate(item.updated_at)}
                        </span>
                      </div>

                      <p className="op-support__text-41">
                        {item.subject}
                      </p>

                      <p className="op-support__text-42">
                        {item.preview || "Chưa có tin nhắn..."}
                      </p>

                      <div className="op-support__div-43">
                        <span className={`op-support__span-44 op-support__status op-support__status--${statusTone}`}>
                          {statusLabel}
                        </span>

                        {item.unread_count > 0 && (
                          <span className="op-support__span-45">
                            {item.unread_count} mới
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Cột phải: Chat Area chi tiết */}
        <main className="op-support__main-46">
          {active ? (
            <>
              {/* Header chi tiết khách hàng */}
              <div className="op-support__div-47">
                <div className="op-support__div-48">
                  <div className="op-support__div-49 op-support__div-10">
                    {getInitials(active.customer_name)}
                  </div>
                  <div className="op-support__div-50">
                    <div className="op-support__div-51">
                      <h2 className="op-support__text-52">
                        {active.customer_name}
                      </h2>
                      <span className="op-support__span-53 op-support__span-11">
                        {active.status}
                      </span>
                    </div>
                    <p className="op-support__text-54">
                      {active.customer_email || "Khách hàng"} • Vấn đề:{" "}
                      <strong className="op-support__text-55">{active.subject}</strong>
                    </p>
                  </div>
                </div>

                <div className="op-support__div-56 op-support__div-12">
                  {active.ai_auto_reply && (
                    <button
                      type="button"
                      onClick={takeOver}
                      className="op-support__button-57"
                      title="Nhận hội thoại và tắt AI trả lời tự động"
                    >
                      <span className="material-symbols-outlined op-support__span-58">front_hand</span>
                      <span>Nhận hội thoại</span>
                    </button>
                  )}
                  {active.status !== "CLOSED" ? (
                    <button
                      type="button"
                      onClick={() => toggleStatus("CLOSED")}
                      className="op-support__button-59 op-support__button-13"
                      title="Đóng phiên hỗ trợ này"
                    >
                      <span className="material-symbols-outlined op-support__span-60">check_circle</span>
                      <span>Đóng hội thoại</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleStatus("OPEN")}
                      className="op-support__button-61 op-support__button-14"
                    >
                      <span className="material-symbols-outlined op-support__span-62">replay</span>
                      <span>Mở lại hội thoại</span>
                    </button>
                  )}
                </div>
              </div>

              {active.ai_auto_reply && (
                <div className="op-support__div-63">
                  <span className="material-symbols-outlined op-support__span-64">smart_toy</span>
                  AI đang trả lời tự động. Bấm “Nhận hội thoại” để chuyển hẳn sang người trực.
                </div>
              )}

              {/* Danh sách tin nhắn */}
              <div className="op-support__div-65">
                {messages.length === 0 ? (
                  <div className="op-support__div-66">
                    Chưa có tin nhắn nào trong hội thoại này.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOperator = message.sender_role === "operator";
                    const isAssistant = message.sender_role === "assistant";
                    return (
                      <div
                        key={message.id}
                        className={`op-support__div-69   ${isOperator ? "op-support__div-67--variant-1" : "op-support__div-68--variant-2"}`}
                      >
                        <div className="op-support__div-70">
                          <span className="op-support__span-71">
                            {isOperator ? "Bạn (Điều hành)" : isAssistant ? "Trợ lý AI" : active.customer_name}
                          </span>
                          {message.created_at && (
                            <span className="op-support__span-72">
                              • {formatTime(message.created_at)}
                            </span>
                          )}
                        </div>

                        <div
                          className={`op-support__div-76   ${
                            isOperator
                              ? "op-support__div-73--variant-1"
                              : isAssistant
                              ? "op-support__div-74--variant-2 op-support__div-15--variant-2"
                              : "op-support__div-75--variant-3 op-support__div-16--variant-3"
                          }`}
                        >
                          {message.body}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Soạn thảo phản hồi */}
              <div className="op-support__div-77">
                <form onSubmit={send} className="op-support__form-78">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Nhập nội dung phản hồi khách hàng (Enter để gửi, Shift+Enter xuống dòng)..."
                    className="op-support__element-79 op-support__element-17"
                  />

                  <div className="op-support__div-80">
                    {/* Nút AI Draft gợi ý phản hồi */}
                    <button
                      type="button"
                      onClick={draft}
                      disabled={drafting}
                      className="op-support__button-81 op-support__button-18"
                      title="Sử dụng AI để tự động soạn câu trả lời mẫu dựa trên bối cảnh và lịch sử đặt tour của khách"
                    >
                      <span className="material-symbols-outlined op-support__span-82">
                        {drafting ? "progress_activity" : "auto_awesome"}
                      </span>
                      <span>{drafting ? "AI đang soạn..." : "AI gợi ý câu trả lời"}</span>
                    </button>

                    <div className="op-support__div-83">
                      <span className="op-support__span-84">
                        Nhấn <strong>Enter</strong> để gửi
                      </span>
                      <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className="op-support__button-85"
                      >
                        <span className="material-symbols-outlined op-support__span-86">send</span>
                        <span>{sending ? "Đang gửi..." : "Gửi phản hồi"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty state khi chưa chọn cuộc trò chuyện */
            <div className="op-support__div-87">
              <div className="op-support__div-88 op-support__div-19">
                <span className="material-symbols-outlined op-support__span-89">chat</span>
              </div>
              <h3 className="op-support__text-90">Chưa chọn cuộc hội thoại</h3>
              <p className="op-support__text-91">
                Chọn một khách hàng từ danh sách bên trái để xem nội dung và gửi phản hồi hỗ trợ.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
