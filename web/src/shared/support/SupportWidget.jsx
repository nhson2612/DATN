import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./SupportWidget.css";

// Phân tích dòng văn bản (hỗ trợ [Tên tour](url) inline link và **in đậm**)
function renderInlineTokens(text, onNavigate, keyPrefix = "inline") {
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
          className="sp-gpt-tour-link"
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

// Phân tích văn bản markdown từ AI (hỗ trợ Checklist tương tác - [ ], [Tên tour](url) và **in đậm**)
function renderFormattedMessage(text, onNavigate, checkedItems = {}, onToggleCheck = null, msgId = "msg") {
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
          className={`sp-gpt-checklist-item ${isChecked ? "sp-gpt-checklist-item--checked" : ""}`}
        >
          <input
            type="checkbox"
            className="sp-gpt-checklist-box"
            checked={isChecked}
            onChange={() => onToggleCheck && onToggleCheck(itemKey, !isChecked)}
          />
          <span className="sp-gpt-checklist-text">
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

function socketUrl() {
  const base = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000/api`;
  return `${base.replace(/^http/, "ws").replace(/\/api$/, "")}/ws/support?token=${encodeURIComponent(localStorage.getItem("token") || "")}`;
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

function formatTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Linh vật Aura Explorer vector 2D chính thức, tự do không đóng khung tròn
function AuraFabMascot() {
  return (
    <div className="sp-fab__mascot-stage">
      <img
        src="/images/mascot-support.png"
        alt="Aura Explorer Mascot"
        className="sp-fab__mascot-img"
        width="82"
        height="115"
        loading="eager"
        draggable={false}
      />
      {/* Tia sóng vẫy chào vui vẻ khi hover */}
      <svg
        className="sp-fab__wave-lines"
        width="26"
        height="32"
        viewBox="0 0 26 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 8 C14 12 14 20 6 24"
          stroke="#f59e0b"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M15 4 C25 10 25 22 15 28"
          stroke="#f59e0b"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>
      {/* Đổ bóng tự nhiên dưới chân */}
      <div className="sp-fab__ground-shadow" aria-hidden="true" />
    </div>
  );
}

const QUICK_PROMPTS = [
  "⚖️ So sánh tour Sapa và tour Hạ Long giúp tôi",
  "🎒 Cho xin checklist chuẩn bị đồ đi tour Sapa",
  "🍜 Tối nay rảnh ở Đà Nẵng thì ăn chơi ở đâu?",
  "📦 Kiểm tra đơn đặt tour & lịch khởi hành của tôi"
];

export default function SupportWidget({ user, onNeedAuth }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [sharedId, setSharedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem("sp_chat_theme") || "light");

  const toggleCheckItem = (key, nextVal) => {
    setCheckedItems((prev) => ({ ...prev, [key]: nextVal }));
  };

  const endRef = useRef(null);
  const activeIdRef = useRef(null);
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("sp_chat_theme", next);
      return next;
    });
  };

  const toggleThought = (id) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleShare = async (id, body) => {
    if (!body) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Aura AI Chat",
          text: body,
        });
      } else {
        await navigator.clipboard.writeText(body);
        setSharedId(id);
        setTimeout(() => setSharedId(null), 2000);
      }
    } catch {
      // Bỏ qua nếu user hủy dialog share
    }
  };

  const load = useCallback(async () => {
    if (user?.role !== "user") return;
    try {
      const result = await api.supportConversations();
      const list = result.conversations || [];
      setItems(list);
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
      // Không ghi đè danh sách tin nhắn khi AI đang trong quá trình streaming
      if (activeIdRef.current && !isSubmittingRef.current) {
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

  // Gửi tin nhắn kiểu ChatGPT: Streaming từng token theo thời gian thực
  const handleSendMessage = async (overrideText) => {
    const messageContent = (overrideText || text).trim();
    if (!messageContent || isSubmitting) return;

    if (!overrideText) {
      setText("");
    }
    setIsSubmitting(true);
    setError("");

    const startTime = Date.now();

    // Tin nhắn tạm thời của user
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const userMsg = {
      id: tempUserMsgId,
      sender_role: "customer",
      body: messageContent,
      created_at: new Date().toISOString(),
    };

    // Tin nhắn streaming tạm thời của AI
    const streamingAssistantId = `streaming-${Date.now()}`;
    const streamingMsg = {
      id: streamingAssistantId,
      sender_role: "assistant",
      body: "",
      isStreaming: true,
      thoughtDuration: 0,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, streamingMsg]);
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    try {
      if (!active) {
        // Cuộc hội thoại mới: Streaming tạo và phản hồi
        const subject = messageContent.length > 40
          ? `${messageContent.slice(0, 40)}...`
          : messageContent;

        await api.streamSupportConversation(
          { subject, message: messageContent },
          {
            onInit: (evt) => {
              if (evt.conversation) {
                setActive(evt.conversation);
                setItems((prev) => [evt.conversation, ...prev]);
              }
              if (evt.message) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempUserMsgId ? evt.message : m))
                );
              }
            },
            onChunk: (chunk) => {
              setMessages((prev) => {
                const found = prev.some((m) => m.id === streamingAssistantId);
                if (!found) {
                  return [
                    ...prev,
                    {
                      id: streamingAssistantId,
                      sender_role: "assistant",
                      body: chunk,
                      isStreaming: true,
                      thoughtDuration: 0,
                      created_at: new Date().toISOString(),
                    },
                  ];
                }
                return prev.map((m) =>
                  m.id === streamingAssistantId ? { ...m, body: (m.body || "") + chunk } : m
                );
              });
              endRef.current?.scrollIntoView({ behavior: "smooth" });
            },
            onDone: (evt) => {
              const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
              if (evt.assistant_message) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingAssistantId
                      ? { ...evt.assistant_message, thoughtDuration: duration }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingAssistantId
                      ? { ...m, isStreaming: false, thoughtDuration: duration }
                      : m
                  )
                );
              }
              setIsSubmitting(false);
            },
          }
        );
      } else {
        // Cuộc hội thoại đã có: Streaming tin nhắn tiếp theo
        await api.streamSupportMessage(
          active.id,
          { body: messageContent },
          {
            onInit: (evt) => {
              if (evt.message) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempUserMsgId ? evt.message : m))
                );
              }
            },
            onChunk: (chunk) => {
              setMessages((prev) => {
                const found = prev.some((m) => m.id === streamingAssistantId);
                if (!found) {
                  return [
                    ...prev,
                    {
                      id: streamingAssistantId,
                      sender_role: "assistant",
                      body: chunk,
                      isStreaming: true,
                      thoughtDuration: 0,
                      created_at: new Date().toISOString(),
                    },
                  ];
                }
                return prev.map((m) =>
                  m.id === streamingAssistantId ? { ...m, body: (m.body || "") + chunk } : m
                );
              });
              endRef.current?.scrollIntoView({ behavior: "smooth" });
            },
            onDone: (evt) => {
              const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
              if (evt.assistant_message) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingAssistantId
                      ? { ...evt.assistant_message, thoughtDuration: duration }
                      : m
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingAssistantId
                      ? { ...m, isStreaming: false, thoughtDuration: duration }
                      : m
                  )
                );
              }
              setIsSubmitting(false);
            },
          }
        );
      }
    } catch (err) {
      console.error("Lỗi khi stream tin nhắn:", err);
      setError(err.message || "Không thể gửi tin nhắn.");
      setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
      if (!overrideText) {
        setText(messageContent);
      }
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setActive(null);
    setMessages([]);
    setText("");
    setShowHistory(false);
    setError("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const handleCopy = (id, body) => {
    if (!body) return;
    navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Không hiển thị widget cho Operator hoặc Admin vì họ có trang quản trị riêng
  if (user?.role === "operator" || user?.role === "admin") return null;

  return (
    <>
      {/* 1. Nút nổi mở Widget (Linh vật đứng tự do, ẩn hoàn toàn khi đang mở chat) */}
      {!open && (
        <button
          type="button"
          className="sp-fab"
          onClick={() => (user ? setOpen(true) : onNeedAuth())}
          aria-label="Trò chuyện cùng Aura"
          title="Hỗ trợ 24/7 • Chat với Aura"
        >
          <div className="sp-fab__icon-wrap">
            <AuraFabMascot />
          </div>
          <span className="sp-fab__mascot-bubble">Em có thể giúp gì ạ? 👋</span>
        </button>
      )}

      {/* 2. Cửa sổ chat Widget phong cách ChatGPT */}
      {open && (
        <section className={`sp-window sp-window--${theme}`} aria-label="Aura AI Chat">
          {/* Header ChatGPT */}
          <header className="sp-gpt-header">
            <div className="sp-gpt-header__left">
              <span className="sp-gpt-header__title">Aura AI</span>
              <span className="sp-gpt-header__badge">Du lịch thông minh</span>
            </div>

            <div className="sp-gpt-header__actions">
              {/* Nút Chuyển đổi giao diện Sáng / Tối */}
              <button
                type="button"
                className="sp-gpt-icon-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}
                aria-label="Đổi giao diện"
              >
                {theme === "dark" ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Nút Đoạn chat mới */}
              <button
                type="button"
                className="sp-gpt-icon-btn"
                onClick={handleNewChat}
                title="Đoạn chat mới"
                aria-label="Đoạn chat mới"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* Nút Lịch sử */}
              <button
                type="button"
                className={`sp-gpt-icon-btn ${showHistory ? "sp-gpt-icon-btn--active" : ""}`}
                onClick={() => setShowHistory((prev) => !prev)}
                title="Lịch sử đoạn chat"
                aria-label="Lịch sử đoạn chat"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>

              {/* Nút Đóng widget */}
              <button
                type="button"
                className="sp-gpt-icon-btn sp-gpt-icon-btn--close"
                onClick={() => setOpen(false)}
                title="Đóng chat"
                aria-label="Đóng chat"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          {/* Lỗi nếu có */}
          {error && (
            <div className="sp-gpt-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} className="sp-gpt-error__close">
                ×
              </button>
            </div>
          )}

          {/* Lịch sử trò chuyện dạng danh sách (khi bấm nút lịch sử) */}
          {showHistory ? (
            <div className="sp-gpt-history">
              <div className="sp-gpt-history__header">
                <h4>Lịch sử trò chuyện</h4>
                <button
                  type="button"
                  className="sp-gpt-history__back-btn"
                  onClick={() => setShowHistory(false)}
                >
                  Quay lại chat
                </button>
              </div>

              {items.length === 0 ? (
                <div className="sp-gpt-history__empty">
                  Chưa có lịch sử trò chuyện nào.
                </div>
              ) : (
                <div className="sp-gpt-history__list">
                  {items.map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      className={`sp-gpt-history__item ${active?.id === conv.id ? "sp-gpt-history__item--active" : ""}`}
                      onClick={() => {
                        setActive(conv);
                        setShowHistory(false);
                      }}
                    >
                      <div className="sp-gpt-history__item-title truncate">
                        {conv.subject || "Yêu cầu tư vấn tour"}
                      </div>
                      <div className="sp-gpt-history__item-preview truncate">
                        {conv.preview || "Xem lại nội dung..."}
                      </div>
                      <div className="sp-gpt-history__item-time">
                        {formatTime(conv.updated_at || conv.created_at)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Luồng Chat chính chuẩn phong cách ChatGPT */
            <div className="sp-gpt-chat">
              <div className="sp-gpt-stream">
                {/* Ngày giờ tin nhắn kiểu ChatGPT */}
                {messages.length > 0 && messages[0].created_at && (
                  <div className="sp-gpt-timestamp">
                    {formatChatDate(messages[0].created_at)}
                  </div>
                )}

                {/* Trạng thái trống (Welcome Screen) khi bắt đầu */}
                {messages.length === 0 && (
                  <div className="sp-gpt-welcome">
                    <div className="sp-gpt-welcome__icon">
                      <img
                        src="/images/mascot-support.png"
                        alt="Aura Mascot"
                        width="54"
                        height="76"
                        draggable={false}
                      />
                    </div>
                    <h3 className="sp-gpt-welcome__title">
                      Tôi có thể giúp gì cho chuyến đi của bạn?
                    </h3>
                    <p className="sp-gpt-welcome__subtitle">
                      Hỏi tôi bất cứ điều gì về lịch trình tour, giá cả hoặc chính sách đặt tour.
                    </p>

                    <div className="sp-gpt-prompts">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="sp-gpt-prompt-chip"
                          onClick={() => handleSendMessage(prompt)}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh sách tin nhắn theo phong cách ChatGPT */}
                {messages.map((message) => {
                  const isCustomer = message.sender_role === "customer";

                  if (isCustomer) {
                    /* Tin nhắn Người dùng: Viên thuốc xanh bo cong bên phải */
                    return (
                      <div key={message.id} className="sp-gpt-msg sp-gpt-msg--user">
                        <div className="sp-gpt-pill">
                          {message.body}
                        </div>
                      </div>
                    );
                  }

                  /* Tin nhắn AI / Nhân viên: KHÔNG avatar, KHÔNG bubble nền, văn bản thanh thoát */
                  return (
                    <div key={message.id} className="sp-gpt-msg sp-gpt-msg--ai">
                      {/* Accordion 'Worked for ...s >' chuẩn phong cách ChatGPT o1/reasoning */}
                      <div className="sp-gpt-thought">
                        <button
                          type="button"
                          className="sp-gpt-thought__btn"
                          onClick={() => toggleThought(message.id)}
                          aria-expanded={Boolean(expandedThoughts[message.id])}
                          title="Xem chi tiết quá trình suy nghĩ & tìm kiếm"
                        >
                          <span className="sp-gpt-thought__label">
                            {message.isStreaming
                              ? "Working..."
                              : `Worked for ${message.thoughtDuration || 11}s`}
                          </span>
                          <svg
                            className={`sp-gpt-thought__chevron ${expandedThoughts[message.id] ? "sp-gpt-thought__chevron--open" : ""}`}
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
                        </button>
                        <div className="sp-gpt-thought__divider" />

                        {expandedThoughts[message.id] && (
                          <div className="sp-gpt-thought__details">
                            <div className="sp-gpt-thought__step">
                              <span className="sp-gpt-thought__check">✓</span>
                              <span>Truy vấn dữ liệu Tour, So sánh lịch trình &amp; Dự báo thời tiết</span>
                            </div>
                            <div className="sp-gpt-thought__step">
                              <span className="sp-gpt-thought__check">✓</span>
                              <span>Kiểm tra đơn Booking, Nhắc lịch khởi hành &amp; Checklist hành lý</span>
                            </div>
                            <div className="sp-gpt-thought__step">
                              <span className="sp-gpt-thought__check">✓</span>
                              <span>Tra cứu quán ngon giờ tự do, Thuyết minh điểm đến &amp; Ưu đãi tri ân</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Nội dung tin nhắn trực tiếp không bong bóng kèm con trỏ streaming */}
                      <div className="sp-gpt-ai-content">
                        {message.body ? (
                          <>
                            {renderFormattedMessage(
                              message.body,
                              navigate,
                              checkedItems,
                              toggleCheckItem,
                              String(message.id)
                            )}
                            {message.isStreaming && <span className="sp-gpt-cursor" />}
                          </>
                        ) : (
                          <div className="sp-gpt-thinking">
                            <span className="sp-gpt-thinking__dot" />
                            <span className="sp-gpt-thinking__text">Aura đang suy nghĩ...</span>
                          </div>
                        )}
                      </div>

                      {/* Thanh công cụ hành động chuẩn ChatGPT: Copy, Thumbs Down, Speaker, Share, More */}
                      {!message.isStreaming && Boolean(message.body) && (
                        <div className="sp-gpt-ai-actions">
                          {/* 1. Nút Copy */}
                          <button
                            type="button"
                            className="sp-gpt-action-btn"
                            onClick={() => handleCopy(message.id, message.body)}
                            title={copiedId === message.id ? "Đã sao chép!" : "Sao chép"}
                            aria-label="Sao chép"
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

                          {/* 2. Nút Thumbs Down */}
                          <button
                            type="button"
                            className="sp-gpt-action-btn"
                            title="Chưa hài lòng"
                            aria-label="Chưa hài lòng"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                            </svg>
                          </button>

                          {/* 3. Nút Đọc to (Speaker / Text to Speech) */}
                          <button
                            type="button"
                            className={`sp-gpt-action-btn ${speakingId === message.id ? "sp-gpt-action-btn--active" : ""}`}
                            onClick={() => handleSpeak(message.id, message.body)}
                            title={speakingId === message.id ? "Dừng đọc" : "Đọc to câu trả lời"}
                            aria-label="Đọc câu trả lời"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            </svg>
                          </button>

                          {/* 4. Nút Chia sẻ (Share) */}
                          <button
                            type="button"
                            className="sp-gpt-action-btn"
                            onClick={() => handleShare(message.id, message.body)}
                            title={sharedId === message.id ? "Đã sao chép liên kết!" : "Chia sẻ"}
                            aria-label="Chia sẻ"
                          >
                            {sharedId === message.id ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                              </svg>
                            )}
                          </button>

                          {/* 5. Nút More (...) */}
                          <button
                            type="button"
                            className="sp-gpt-action-btn"
                            title="Thêm tùy chọn"
                            aria-label="Thêm tùy chọn"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="1.8" />
                              <circle cx="19" cy="12" r="1.8" />
                              <circle cx="5" cy="12" r="1.8" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Trạng thái suy nghĩ khi đang chờ câu trả lời */}
                {isSubmitting && (
                  <div className="sp-gpt-thinking">
                    <span className="sp-gpt-thinking__dot" />
                    <span className="sp-gpt-thinking__text">Aura đang suy nghĩ...</span>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* Khung nhập liệu kiểu ChatGPT */}
              <div className="sp-gpt-input-area">
                <form
                  className="sp-gpt-input-capsule"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhắn tin cho Aura..."
                    className="sp-gpt-input-field"
                    disabled={isSubmitting}
                  />

                  <button
                    type="submit"
                    disabled={!text.trim() || isSubmitting}
                    className={`sp-gpt-send-btn ${text.trim() ? "sp-gpt-send-btn--active" : ""}`}
                    aria-label="Gửi tin nhắn"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </form>

                <p className="sp-gpt-disclaimer">
                  Aura AI có thể đưa ra câu trả lời chưa hoàn hảo. Hãy kiểm tra các thông tin quan trọng.
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
