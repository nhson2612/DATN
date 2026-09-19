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
    <div className="space-y-4 font-sans text-zinc-900">
      {/* 1. Header & Segmented Tabs chuẩn Shadcn */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Hỗ trợ khách hàng
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Tiếp nhận và phản hồi thắc mắc của khách hàng theo thời gian thực.
          </p>
        </div>

        {/* Tabs lọc trạng thái theo chuẩn Shadcn Tabs */}
        <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-zinc-200 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setFilter("OPEN")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filter === "OPEN"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Đang chờ
          </button>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filter === "PENDING"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Đã phản hồi
          </button>
          <button
            type="button"
            onClick={() => setFilter("CLOSED")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filter === "CLOSED"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Đã đóng
          </button>
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filter === ""
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Tất cả
          </button>
        </div>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="flex items-center justify-between gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-rose-500 hover:text-rose-800 p-0.5 rounded cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* 2. Main Desk Card: Split 2 pane (Inbox list + Chat detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border border-zinc-200 rounded-xl bg-white shadow-xs overflow-hidden h-[calc(100vh-210px)] min-h-[580px]">
        {/* Cột trái: Inbox Danh sách cuộc trò chuyện */}
        <aside className="lg:col-span-4 xl:col-span-4 border-b lg:border-b-0 lg:border-r border-zinc-200 flex flex-col bg-zinc-50/50">
          {/* Search bar */}
          <div className="p-3 border-b border-zinc-200 bg-white">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-zinc-400 text-lg pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên khách hoặc chủ đề..."
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors"
              />
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                <span className="material-symbols-outlined text-2xl text-zinc-300 block mb-1">
                  inbox
                </span>
                Không có cuộc hội thoại nào.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = activeId === item.id;
                const statusColor =
                  item.status === "OPEN"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : item.status === "PENDING"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-zinc-100 text-zinc-600 border-zinc-200";

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
                    className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer group ${
                      isSelected
                        ? "bg-zinc-100/90 border-l-3 border-zinc-900"
                        : "hover:bg-zinc-100/50 bg-white"
                    }`}
                  >
                    {/* Avatar Initials */}
                    <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-white transition-colors">
                      {getInitials(item.customer_name)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <strong className="text-xs font-bold text-zinc-900 truncate">
                          {item.customer_name || "Khách hàng"}
                        </strong>
                        <span className="text-[10px] text-zinc-400 shrink-0 tabular-nums">
                          {formatDate(item.updated_at)}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-zinc-700 truncate mt-0.5">
                        {item.subject}
                      </p>

                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {item.preview || "Chưa có tin nhắn..."}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColor}`}>
                          {statusLabel}
                        </span>

                        {item.unread_count > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-white text-[10px] font-bold">
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
        <main className="lg:col-span-8 xl:col-span-8 flex flex-col bg-white">
          {active ? (
            <>
              {/* Header chi tiết khách hàng */}
              <div className="p-3.5 sm:px-5 border-b border-zinc-200 flex items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {getInitials(active.customer_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-zinc-900 truncate">
                        {active.customer_name}
                      </h2>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {active.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {active.customer_email || "Khách hàng"} • Vấn đề:{" "}
                      <strong className="text-zinc-700">{active.subject}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {active.ai_auto_reply && (
                    <button
                      type="button"
                      onClick={takeOver}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                      title="Nhận hội thoại và tắt AI trả lời tự động"
                    >
                      <span className="material-symbols-outlined text-sm">front_hand</span>
                      <span>Nhận hội thoại</span>
                    </button>
                  )}
                  {active.status !== "CLOSED" ? (
                    <button
                      type="button"
                      onClick={() => toggleStatus("CLOSED")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-zinc-700 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-xs"
                      title="Đóng phiên hỗ trợ này"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>Đóng hội thoại</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleStatus("OPEN")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm">replay</span>
                      <span>Mở lại hội thoại</span>
                    </button>
                  )}
                </div>
              </div>

              {active.ai_auto_reply && (
                <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-800">
                  <span className="material-symbols-outlined text-base">smart_toy</span>
                  AI đang trả lời tự động. Bấm “Nhận hội thoại” để chuyển hẳn sang người trực.
                </div>
              )}

              {/* Danh sách tin nhắn */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-zinc-50/40">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    Chưa có tin nhắn nào trong hội thoại này.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOperator = message.sender_role === "operator";
                    const isAssistant = message.sender_role === "assistant";
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col ${isOperator ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-semibold text-zinc-400">
                            {isOperator ? "Bạn (Điều hành)" : isAssistant ? "Trợ lý AI" : active.customer_name}
                          </span>
                          {message.created_at && (
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              • {formatTime(message.created_at)}
                            </span>
                          )}
                        </div>

                        <div
                          className={`max-w-[82%] sm:max-w-[70%] p-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                            isOperator
                              ? "bg-zinc-900 text-white rounded-2xl rounded-tr-xs shadow-xs"
                              : isAssistant
                              ? "bg-emerald-50 text-emerald-950 border border-emerald-200 rounded-2xl rounded-tl-xs shadow-xs"
                              : "bg-white text-zinc-900 border border-zinc-200/80 rounded-2xl rounded-tl-xs shadow-xs"
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
              <div className="p-3 sm:p-4 border-t border-zinc-200 bg-white">
                <form onSubmit={send} className="space-y-2.5">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Nhập nội dung phản hồi khách hàng (Enter để gửi, Shift+Enter xuống dòng)..."
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-colors resize-none"
                  />

                  <div className="flex items-center justify-between gap-2">
                    {/* Nút AI Draft gợi ý phản hồi */}
                    <button
                      type="button"
                      onClick={draft}
                      disabled={drafting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer disabled:opacity-50"
                      title="Sử dụng AI để tự động soạn câu trả lời mẫu dựa trên bối cảnh và lịch sử đặt tour của khách"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {drafting ? "progress_activity" : "auto_awesome"}
                      </span>
                      <span>{drafting ? "AI đang soạn..." : "AI gợi ý câu trả lời"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-[11px] text-zinc-400">
                        Nhấn <strong>Enter</strong> để gửi
                      </span>
                      <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        <span>{sending ? "Đang gửi..." : "Gửi phản hồi"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          ) : (
            /* Empty state khi chưa chọn cuộc trò chuyện */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-400 flex items-center justify-center mb-3 shadow-xs">
                <span className="material-symbols-outlined text-2xl">chat</span>
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Chưa chọn cuộc hội thoại</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Chọn một khách hàng từ danh sách bên trái để xem nội dung và gửi phản hồi hỗ trợ.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
