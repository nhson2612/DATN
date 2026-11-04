import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function formatChatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = dayNames[d.getDay()];
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day} ${hours}:${minutes} ${ampm}`;
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

// Nhận diện nhanh cảm xúc tin nhắn khách hàng (Giai đoạn 4 - Sentiment Analysis)
function detectCustomerSentiment(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const neg = ["tệ", "kém", "chậm", "trễ", "bực", "thất vọng", "không hài lòng", "khiếu nại", "phàn nàn", "đắt", "nguội", "bẩn", "hoàn tiền"];
  const pos = ["tuyệt vời", "hài lòng", "rất vui", "nhiệt tình", "chu đáo", "đẹp lắm", "ngon", "cảm ơn", "khen", "5 sao"];
  if (neg.some((w) => t.includes(w))) {
    return { type: "negative", label: "Khiếu nại / Cần chú ý" };
  }
  if (pos.some((w) => t.includes(w))) {
    return { type: "positive", label: "Phản hồi tích cực" };
  }
  return null;
}

// Phân tích dòng văn bản (hỗ trợ [Tên tour](url) inline link và **in đậm**) đồng bộ với SupportWidget
function renderInlineTokens(text, onNavigate, keyPrefix = "op-inline") {
  if (!text) return null;

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  const parts = [];
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "link", text: match[1], url: match[2] });
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  const tokens = [];
  parts.forEach((part, idx) => {
    if (part.type === "link") {
      tokens.push({ ...part, key: `${keyPrefix}-link-${idx}` });
    } else {
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let bLast = 0;
      let bMatch;
      while ((bMatch = boldRegex.exec(part.content)) !== null) {
        if (bMatch.index > bLast) {
          tokens.push({
            type: "text",
            content: part.content.slice(bLast, bMatch.index),
            key: `${keyPrefix}-text-${idx}-${bLast}`,
          });
        }
        tokens.push({
          type: "bold",
          content: bMatch[1],
          key: `${keyPrefix}-bold-${idx}-${bMatch.index}`,
        });
        bLast = boldRegex.lastIndex;
      }
      if (bLast < part.content.length) {
        tokens.push({
          type: "text",
          content: part.content.slice(bLast),
          key: `${keyPrefix}-text-${idx}-${bLast}`,
        });
      }
    }
  });

  return tokens.map((token) => {
    if (token.type === "link") {
      const isInternal = token.url.startsWith("/");
      return (
        <a
          key={token.key}
          href={token.url}
          className="op-gpt-tour-link"
          onClick={(e) => {
            if (isInternal && onNavigate) {
              e.preventDefault();
              onNavigate(token.url);
            }
          }}
          title={`Xem chi tiết ${token.text}`}
        >
          {token.text}
        </a>
      );
    }
    if (token.type === "bold") {
      return <strong key={token.key}>{token.content}</strong>;
    }
    return <span key={token.key}>{token.content}</span>;
  });
}

// Render nội dung tin nhắn có hỗ trợ Checklist tương tác - [ ], inline link và in đậm
function renderFormattedMessage(text, onNavigate, checkedItems = {}, onToggleCheck = null, msgId = "op-msg") {
  if (!text) return null;

  const lines = text.split("\n");
  const hasChecklist = lines.some((l) => /^\s*-\s*\[([ xX])\]\s+/.test(l));
  if (!hasChecklist) {
    return renderInlineTokens(text, onNavigate, `${msgId}-full`);
  }

  return lines.map((line, idx) => {
    const checkMatch = line.match(/^\s*-\s*\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      const defaultChecked = checkMatch[1].toLowerCase() === "x";
      const itemKey = `${msgId}-chk-${idx}`;
      const isChecked = checkedItems[itemKey] !== undefined ? checkedItems[itemKey] : defaultChecked;
      return (
        <label
          key={itemKey}
          className={`op-gpt-checklist-item ${isChecked ? "op-gpt-checklist-item--checked" : ""}`}
        >
          <input
            type="checkbox"
            className="op-gpt-checklist-box"
            checked={isChecked}
            onChange={() => onToggleCheck && onToggleCheck(itemKey, !isChecked)}
          />
          <span className="op-gpt-checklist-text">
            {renderInlineTokens(checkMatch[2], onNavigate, itemKey)}
          </span>
        </label>
      );
    }
    return (
      <span key={`${msgId}-line-${idx}`}>
        {renderInlineTokens(line, onNavigate, `${msgId}-l-${idx}`)}
        {idx < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

export default function SupportScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("OPEN"); // "OPEN" | "PENDING" | "CLOSED" | ""
  const [searchQuery, setSearchQuery] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [chatTheme, setChatTheme] = useState(() => localStorage.getItem("sp_chat_theme") || "light");

  const streamRef = useRef(null);
  const activeIdRef = useRef(null);
  const textareaRef = useRef(null);
  const isDraftingRef = useRef(false);
  const activeId = active?.id;

  const scrollToBottom = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, []);

  const toggleChatTheme = () => {
    setChatTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("sp_chat_theme", next);
      return next;
    });
  };

  const toggleThought = (id) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCheckItem = (key, nextVal) => {
    setCheckedItems((prev) => ({ ...prev, [key]: nextVal }));
  };

  const handleCopy = (id, body) => {
    if (!body) return;
    navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id, body) => {
    if (!("speechSynthesis" in window) || !body) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(body);
    utterance.lang = "vi-VN";
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const result = await api.supportMessages(conversationId);
      setActive(result.conversation);
      setMessages(result.messages || []);
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể tải tin nhắn.");
    }
  }, [scrollToBottom]);

  const load = useCallback(async () => {
    try {
      const result = await api.supportInbox(filter);
      const list = result.conversations || [];
      setItems(list);
      if (!activeIdRef.current && list.length > 0) {
        loadMessages(list[0].id);
      }
    } catch (err) {
      setError(err.message || "Không thể tải danh sách hội thoại.");
    }
  }, [filter, loadMessages]);

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
      if (activeIdRef.current && !isDraftingRef.current) {
        loadMessages(activeIdRef.current).catch((err) => setError(err.message));
      }
    };
    return () => {
      ws.close();
    };
  }, [load, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      load();
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể gửi tin nhắn.");
      setText(content);
    } finally {
      setSending(false);
    }
  };

  // Streaming gợi ý câu trả lời từ Aura AI trực tiếp vào ô nhập
  const draft = async () => {
    if (!activeId || drafting) return;
    setDrafting(true);
    isDraftingRef.current = true;
    setText("");
    try {
      setError("");
      if (api.streamSupportAiDraft) {
        await api.streamSupportAiDraft(activeId, {
          onChunk: (chunk) => {
            setText((prev) => prev + chunk);
          },
          onDone: (evt) => {
            if (evt.draft) {
              setText(evt.draft);
            }
          },
        });
      } else {
        const result = await api.supportAiDraft(activeId);
        setText(result.draft || "");
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (err) {
      setError(err.message || "Không thể tạo gợi ý AI.");
    } finally {
      setDrafting(false);
      isDraftingRef.current = false;
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
            Trung tâm Hỗ trợ &amp; Aura AI
          </h1>
          <p className="op-support__text-4">
            Đồng bộ thời gian thực với Widget Chat khách hàng • Tích hợp AI tư vấn 4 giai đoạn hành trình tour.
          </p>
        </div>

        {/* Tabs lọc trạng thái phẳng đều chuẩn Segmented Control */}
        <div className="op-support-tabs">
          <button
            type="button"
            onClick={() => setFilter("OPEN")}
            className={`op-support-tabs__btn ${filter === "OPEN" ? "op-support-tabs__btn--active" : ""}`}
          >
            Đang chờ
          </button>
          <button
            type="button"
            onClick={() => setFilter("PENDING")}
            className={`op-support-tabs__btn ${filter === "PENDING" ? "op-support-tabs__btn--active" : ""}`}
          >
            Đã phản hồi
          </button>
          <button
            type="button"
            onClick={() => setFilter("CLOSED")}
            className={`op-support-tabs__btn ${filter === "CLOSED" ? "op-support-tabs__btn--active" : ""}`}
          >
            Đã đóng
          </button>
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`op-support-tabs__btn ${filter === "" ? "op-support-tabs__btn--active" : ""}`}
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

      {/* 2. Main Desk Card: Split 2 pane (Inbox list + ChatGPT-style Chat Detail) */}
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

                const previewSentiment = detectCustomerSentiment(item.preview);

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
                    <div className="op-support__div-36 op-support__div-7">
                      {getInitials(item.customer_name)}
                    </div>

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

                        {item.ai_auto_reply && (
                          <span className="op-gpt-badge-ai">
                            Aura AI
                          </span>
                        )}

                        {previewSentiment?.type === "negative" && (
                          <span className="op-gpt-badge-sentiment op-gpt-badge-sentiment--neg">
                            ⚠️ Khiếu nại
                          </span>
                        )}

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

        {/* Cột phải: Khung Chat đồng bộ chuẩn giao diện ChatGPT của Widget */}
        <main className={`op-support__main-46 op-gpt-pane op-gpt-pane--${chatTheme}`}>
          {active ? (
            <>
              {/* Header chi tiết khách hàng + Điều khiển AI / Giao diện */}
              <div className="op-support__div-47 op-gpt-header">
                <div className="op-support__div-48">
                  <div className="op-support__div-49 op-support__div-10">
                    {getInitials(active.customer_name)}
                  </div>
                  <div className="op-support__div-50">
                    <div className="op-support__div-51">
                      <h2 className="op-support__text-52 op-gpt-header__name">
                        {active.customer_name}
                      </h2>
                      <span className="op-support__span-53 op-support__span-11">
                        {active.status}
                      </span>
                      <span className={`op-gpt-mode-pill ${active.ai_auto_reply ? "op-gpt-mode-pill--ai" : "op-gpt-mode-pill--human"}`}>
                        {active.ai_auto_reply ? "Aura AI đang trực" : "Điều hành viên trực"}
                      </span>
                    </div>
                    <p className="op-support__text-54 op-gpt-header__sub">
                      {active.customer_email || "Khách hàng"} • Chủ đề:{" "}
                      <strong className="op-support__text-55 op-gpt-header__subject">{active.subject}</strong>
                    </p>
                  </div>
                </div>

                <div className="op-support__div-56 op-support__div-12">
                  {/* Nút chuyển chế độ Sáng / Tối đồng bộ với Widget */}
                  <button
                    type="button"
                    onClick={toggleChatTheme}
                    className="op-gpt-theme-btn"
                    title={chatTheme === "dark" ? "Chuyển khung chat sang nền Sáng" : "Chuyển khung chat sang nền Tối"}
                  >
                    {chatTheme === "dark" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </button>

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
                <div className="op-support__div-63 op-gpt-ai-banner">
                  <span className="material-symbols-outlined op-support__span-64">smart_toy</span>
                  <span>
                    <strong>Aura AI</strong> đang tự động tư vấn và gợi ý tour cho khách. Bấm <strong>“Nhận hội thoại”</strong> nếu bạn muốn trực tiếp phản hồi.
                  </span>
                </div>
              )}

              {/* Luồng tin nhắn chuẩn phong cách ChatGPT đồng bộ với SupportWidget */}
              <div ref={streamRef} className="op-gpt-stream">
                {messages.length > 0 && messages[0].created_at && (
                  <div className="op-gpt-timestamp">
                    {formatChatDate(messages[0].created_at)}
                  </div>
                )}

                {messages.length === 0 ? (
                  <div className="op-support__div-66">
                    Chưa có tin nhắn nào trong hội thoại này.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOperator = message.sender_role === "operator";
                    const isAssistant = message.sender_role === "assistant";
                    const isCustomer = message.sender_role === "customer";

                    // 1. Tin nhắn của Điều hành viên (Operator): Viên thuốc xanh bên phải giống Widget
                    if (isOperator) {
                      return (
                        <div key={message.id} className="op-gpt-msg op-gpt-msg--right">
                          <div className="op-gpt-meta">
                            <span>Bạn (Điều hành viên)</span>
                            {message.created_at && <span>• {formatTime(message.created_at)}</span>}
                          </div>
                          <div className="op-gpt-pill op-gpt-pill--operator">
                            {renderFormattedMessage(
                              message.body,
                              navigate,
                              checkedItems,
                              toggleCheckItem,
                              `op-${message.id}`
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 2. Tin nhắn của Khách hàng: Viên thuốc bo tròn gọn gàng kèm nhãn cảm xúc
                    if (isCustomer) {
                      const sentiment = detectCustomerSentiment(message.body);
                      return (
                        <div key={message.id} className="op-gpt-msg op-gpt-msg--customer">
                          <div className="op-gpt-meta">
                            <strong>{active.customer_name || "Khách hàng"}</strong>
                            {message.created_at && <span>• {formatTime(message.created_at)}</span>}
                            {sentiment && (
                              <span className={`op-gpt-badge-sentiment op-gpt-badge-sentiment--${sentiment.type === "negative" ? "neg" : "pos"}`}>
                                {sentiment.type === "negative" ? "⚠️ " : "✨ "}
                                {sentiment.label}
                              </span>
                            )}
                          </div>
                          <div className="op-gpt-pill op-gpt-pill--customer">
                            {message.body}
                          </div>
                        </div>
                      );
                    }

                    // 3. Tin nhắn của Aura AI: Chuẩn ChatGPT không bong bóng, có Worked for 11s >, đường kẻ ngang, link tour inline & thanh công cụ
                    if (isAssistant) {
                      return (
                        <div key={message.id} className="op-gpt-msg op-gpt-msg--ai">
                          <div className="op-gpt-thought">
                            <button
                              type="button"
                              className="op-gpt-thought__btn"
                              onClick={() => toggleThought(message.id)}
                              aria-expanded={Boolean(expandedThoughts[message.id])}
                            >
                              <span className="op-gpt-thought__label">
                                Aura AI • Worked for 11s
                              </span>
                              <svg
                                className={`op-gpt-thought__chevron ${expandedThoughts[message.id] ? "op-gpt-thought__chevron--open" : ""}`}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              {message.created_at && (
                                <span className="op-gpt-thought__time">
                                  {formatTime(message.created_at)}
                                </span>
                              )}
                            </button>
                            <div className="op-gpt-thought__divider" />

                            {expandedThoughts[message.id] && (
                              <div className="op-gpt-thought__details">
                                <div className="op-gpt-thought__step">
                                  <span className="op-gpt-thought__check">✓</span>
                                  <span>Truy vấn dữ liệu Tour, So sánh lịch trình &amp; Dự báo thời tiết</span>
                                </div>
                                <div className="op-gpt-thought__step">
                                  <span className="op-gpt-thought__check">✓</span>
                                  <span>Kiểm tra đơn Booking, Nhắc lịch khởi hành &amp; Checklist hành lý</span>
                                </div>
                                <div className="op-gpt-thought__step">
                                  <span className="op-gpt-thought__check">✓</span>
                                  <span>Tra cứu quán ngon giờ tự do, Thuyết minh điểm đến &amp; Ưu đãi tri ân</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="op-gpt-ai-content">
                            {renderFormattedMessage(
                              message.body,
                              navigate,
                              checkedItems,
                              toggleCheckItem,
                              `ai-${message.id}`
                            )}
                          </div>

                          {/* Thanh hành động chuẩn ChatGPT bên dưới câu trả lời AI */}
                          <div className="op-gpt-ai-actions">
                            <button
                              type="button"
                              className="op-gpt-action-btn"
                              onClick={() => handleCopy(message.id, message.body)}
                              title={copiedId === message.id ? "Đã sao chép!" : "Sao chép câu trả lời"}
                            >
                              {copiedId === message.id ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              )}
                            </button>

                            <button
                              type="button"
                              className={`op-gpt-action-btn ${speakingId === message.id ? "op-gpt-action-btn--active" : ""}`}
                              onClick={() => handleSpeak(message.id, message.body)}
                              title={speakingId === message.id ? "Dừng đọc" : "Đọc to câu trả lời"}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="op-gpt-action-btn op-gpt-action-btn--text"
                              onClick={() => {
                                setText(message.body);
                                textareaRef.current?.focus();
                              }}
                              title="Chèn nội dung này vào khung nhập để chỉnh sửa & gửi lại"
                            >
                              <span>Chèn vào ô trả lời</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })
                )}
              </div>

              {/* Khung nhập phản hồi chuẩn phong cách ChatGPT đồng bộ với Widget */}
              <div className="op-gpt-composer-wrap">
                <form onSubmit={send} className="op-gpt-composer">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder="Nhắn tin phản hồi cho khách hàng (Enter để gửi, Shift+Enter xuống dòng)..."
                    className="op-gpt-composer__input"
                  />

                  <div className="op-gpt-composer__footer">
                    {/* Nút AI Draft streaming thời gian thực */}
                    <button
                      type="button"
                      onClick={draft}
                      disabled={drafting}
                      className="op-gpt-draft-btn"
                      title="Sử dụng Aura AI để soạn câu trả lời mẫu theo thời gian thực"
                    >
                      <span className="material-symbols-outlined op-gpt-draft-btn__icon">
                        {drafting ? "progress_activity" : "auto_awesome"}
                      </span>
                      <span>{drafting ? "Aura AI đang soạn từng chữ..." : "AI gợi ý câu trả lời"}</span>
                    </button>

                    <div className="op-gpt-composer__right">
                      <span className="op-gpt-composer__hint">
                        Nhấn <strong>Enter</strong> để gửi
                      </span>
                      <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className={`op-gpt-send-btn ${text.trim() && !sending ? "op-gpt-send-btn--active" : ""}`}
                        title="Gửi phản hồi"
                        aria-label="Gửi phản hồi"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
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
                Chọn một khách hàng từ danh sách bên trái để theo dõi cuộc trò chuyện của Aura AI hoặc trực tiếp phản hồi.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
