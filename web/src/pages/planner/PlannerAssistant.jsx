import { useMemo, useRef, useState } from "react";

import { api } from "../../api/client";
import { tenLoai } from "../../lib/loaiDiaDiem";
import "./PlannerAssistant.css";

function makeSuggestions(destination) {
  const where = destination ? ` ở ${destination.replace(/^(Thành phố|Tỉnh)\s+/i, "")}` : " gần đây";
  return [
    `Địa điểm tham quan nổi bật${where}`,
    `Quán ăn ngon${where}`,
    `Gợi ý lịch trình 1 ngày${where}`,
  ];
}

export default function PlannerAssistant({ destination, location, onResults, onAdd, onFocus }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestions = useMemo(() => makeSuggestions(destination), [destination]);

  function openAssistant() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function send(nextQuestion) {
    const text = (nextQuestion ?? question).trim();
    if (!text || loading) return;

    setQuestion("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    try {
      const response = await api.chat({
        question: text,
        user_lon: location?.lon,
        user_lat: location?.lat,
      });
      const results = response.results || [];
      if (results.length) onResults?.(results);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.explanation || "Tôi chưa tìm được địa điểm phù hợp.",
          results,
          candidates: response.candidates || [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: error.message || "Không thể kết nối với trợ lý lúc này.", error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`planner-assistant ${open ? "planner-assistant--open" : ""}`}>
      {open && (
        <section className="planner-assistant__panel" aria-label="Trợ lý lập kế hoạch">
          <header className="planner-assistant__header">
            <div>
              <span className="planner-assistant__eyebrow">Trợ lý chuyến đi</span>
              <h2>Hỏi để tìm nhanh</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
              <i className="fa-solid fa-minus" />
            </button>
          </header>

          <div className="planner-assistant__body">
            {messages.length === 0 ? (
              <div className="planner-assistant__welcome">
                <p>Tìm địa điểm thật trong dữ liệu bản đồ rồi thêm thẳng vào chuyến đi của bạn.</p>
                <div className="planner-assistant__suggestions">
                  {suggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => send(suggestion)}>
                      <i className="fa-solid fa-arrow-turn-down" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="planner-assistant__messages" aria-live="polite">
                {messages.map((message, index) => (
                  <article key={`${message.role}-${index}`} className={`planner-assistant__message planner-assistant__message--${message.role}`}>
                    <p>{message.text}</p>
                    {message.candidates?.length > 0 && (
                      <span className="planner-assistant__hint">Hãy ghi rõ tỉnh/thành để tìm chính xác hơn.</span>
                    )}
                    {message.results?.slice(0, 4).map((place) => (
                      <div key={`${place.type}-${place.id}`} className="planner-assistant__place">
                        <button type="button" onClick={() => onFocus?.(place)}>
                          <strong>{place.name}</strong>
                          <span>{tenLoai(place.category)}{place.met != null ? ` · ${(place.met / 1000).toFixed(1)} km` : ""}</span>
                        </button>
                        <button type="button" onClick={() => onAdd?.(place)} aria-label={`Thêm ${place.name} vào chuyến đi`} title="Thêm vào chuyến đi">
                          <i className="fa-solid fa-plus" />
                        </button>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form className="planner-assistant__composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ví dụ: quán cà phê gần hồ Hoàn Kiếm"
              aria-label="Câu hỏi cho trợ lý"
            />
            <button type="submit" disabled={!question.trim() || loading} aria-label="Gửi câu hỏi">
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-arrow-up" />}
            </button>
          </form>
          <p className="planner-assistant__disclaimer">Kết quả dựa trên dữ liệu địa điểm hiện có.</p>
        </section>
      )}

      <button type="button" className="planner-assistant__fab" onClick={open ? () => setOpen(false) : openAssistant} aria-label={open ? "Đóng trợ lý" : "Mở trợ lý"}>
        <i className={`fa-solid ${open ? "fa-xmark" : "fa-wand-magic-sparkles"}`} />
        <span>{open ? "Đóng" : "Trợ lý"}</span>
      </button>
    </div>
  );
}
