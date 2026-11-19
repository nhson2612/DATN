import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../shared/api";
import { tenLoai } from "../../../shared/lib/loaiDiaDiem";
import "./PlannerAssistant.css";

function buildContextualSuggestions({ destination, soNgay, unscheduledCount, emptyDays }) {
  const cleanDest = destination ? destination.replace(/^(Thành phố|Tỉnh)\s+/i, "") : "";
  const suffix = cleanDest ? ` tại ${cleanDest}` : "";
  const list = [];

  if (emptyDays.length === soNgay) {
    list.push({
      icon: "fa-wand-magic-sparkles",
      label: `Lên lịch trình ${soNgay} ngày${suffix}`,
      prompt: `Gợi ý lịch trình ${soNgay} ngày chi tiết (Sáng, Trưa, Chiều, Tối và chỗ nghỉ)${suffix} cho chuyến đi này`,
    });
  } else if (emptyDays.length > 0) {
    list.push({
      icon: "fa-calendar-plus",
      label: `Lên lịch cho Ngày ${emptyDays.join(", ")} đang trống`,
      prompt: `Ngày ${emptyDays.join(", ")} trong chuyến đi đang trống, hãy gợi ý lịch trình chi tiết cho các ngày này${suffix}`,
    });
  } else {
    list.push({
      icon: "fa-clipboard-check",
      label: "Nhận xét & tối ưu lịch trình hiện tại",
      prompt: "Xem giúp lịch trình các ngày hiện tại của tôi đã hợp lý chưa và gợi ý tối ưu hoặc bổ sung địa điểm còn thiếu",
    });
  }

  list.push({
    icon: "fa-compass",
    label: `Điểm tham quan nổi bật${suffix}`,
    prompt: `Gợi ý các địa điểm tham quan nổi bật${suffix} phù hợp để thêm vào lịch trình`,
  });

  list.push({
    icon: "fa-utensils",
    label: `Quán ăn & đặc sản${suffix}`,
    prompt: `Gợi ý các quán ăn ngon, nhà hàng đặc sản${suffix} cho các ngày trong lịch trình`,
  });

  list.push({
    icon: "fa-bed",
    label: `Tìm khách sạn / chỗ nghỉ${suffix}`,
    prompt: `Gợi ý khách sạn hoặc homestay tiện di chuyển${suffix} để đặt làm chỗ nghỉ cho chuyến đi`,
  });

  if (unscheduledCount > 0) {
    list.push({
      icon: "fa-route",
      label: `Phân bổ ${unscheduledCount} điểm chờ xếp`,
      prompt: `Tôi đang có ${unscheduledCount} địa điểm lưu chờ xếp lịch, hãy tư vấn cách sắp xếp vào ${soNgay} ngày`,
    });
  } else {
    list.push({
      icon: "fa-list-check",
      label: "Gợi ý checklist & ngân sách",
      prompt: `Gợi ý checklist đồ cần chuẩn bị và ngân sách dự kiến cho chuyến đi ${soNgay} ngày${suffix}`,
    });
  }

  return list;
}

function metaPlace(r) {
  const parts = [];
  if (r.category) parts.push(tenLoai(r.category));
  if (r.dia_chi) parts.push(r.dia_chi);
  if (r.met != null) {
    parts.push(r.met < 1000 ? `${Math.round(r.met)}m` : `${(r.met / 1000).toFixed(1)}km`);
  }
  return parts.join(" · ") || "Địa điểm trên bản đồ";
}

export default function PlannerAssistant({
  trip,
  stops = [],
  sections = [],
  reservations = [],
  cacNgay = [1],
  theoNgay = {},
  destination,
  location,
  open: externalOpen,
  onOpenChange,
  onResults,
  onFocus,
  onAdd,
  onXep,
  onDatChoNgu,
  onToiUu,
  onAutoAssign,
  onApplyPlan,
  onExecuteToolAction,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (val) => {
    const next = typeof val === "function" ? val(isOpen) : val;
    setInternalOpen(next);
    if (onOpenChange) onOpenChange(next);
  };

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState({});

  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const timerRef = useRef(null);

  const soNgay = cacNgay.length || Math.max(Number(trip?.duration_days) || 1, 1);
  const scheduledPlaces = useMemo(
    () => stops.filter((s) => s.day && s.role !== "note" && s.role !== "checklist" && s.role !== "expense"),
    [stops]
  );
  const unscheduledPlaces = useMemo(
    () => stops.filter((s) => !s.day && s.role !== "note" && s.role !== "checklist" && s.role !== "expense"),
    [stops]
  );
  const emptyDays = useMemo(
    () => cacNgay.filter((d) => !(theoNgay[d] && theoNgay[d].length > 0)),
    [cacNgay, theoNgay]
  );

  const suggestions = useMemo(
    () =>
      buildContextualSuggestions({
        destination,
        soNgay,
        unscheduledCount: unscheduledPlaces.length,
        emptyDays,
      }),
    [destination, soNgay, unscheduledPlaces.length, emptyDays]
  );

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, isOpen]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const markApplied = (key) => {
    setAppliedKeys((prev) => ({ ...prev, [key]: true }));
  };

  const ask = async (rawQuestion, resolvedAdmin = null) => {
    const text = (rawQuestion ?? input).trim();
    if (!text || busy || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setInput("");
    setBusy(true);

    const userMsgId = `u_${Date.now()}`;
    const aiMsgId = `a_${Date.now() + 1}`;
    const startMs = Date.now();

    const historyForApi = messages
      .filter((m) => m.text && !m.isThinking)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [
      ...prev,
      ...(resolvedAdmin ? [] : [{ id: userMsgId, role: "user", text }]),
      {
        id: aiMsgId,
        role: "assistant",
        text: "",
        isThinking: true,
        thoughtSeconds: 0,
        results: [],
        proposedPlan: [],
        toolActions: [],
        candidates: [],
        sources: [],
      },
    ]);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.max(1, Math.floor((Date.now() - startMs) / 1000));
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId && m.isThinking ? { ...m, thoughtSeconds: elapsed } : m))
      );
    }, 1000);

    try {
      const tripContext = {
        id: trip?.id,
        name: trip?.name,
        destination: destination || trip?.destination || null,
        duration_days: soNgay,
        start_date: trip?.start_date || null,
        budget: Number(trip?.budget || 0),
        stops: stops.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          day: s.day,
          section: s.section,
          role: s.role,
          category: s.category,
          dia_chi: s.dia_chi,
          lon: s.lon,
          lat: s.lat,
          cost: s.cost,
          text: s.text,
          done: s.done,
          items: s.items,
        })),
        sections,
        reservations,
      };

      const res = await api.chat({
        question: text,
        user_lon: location?.lon,
        user_lat: location?.lat,
        resolved_admin: resolvedAdmin,
        itinerary_id: trip?.id ? Number(trip.id) : null,
        trip_context: tripContext,
        history: historyForApi,
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const finalDuration = Math.max(1, Math.round((Date.now() - startMs) / 1000));
      const results = res.results || [];
      if (results.length) onResults?.(results);
      if (results[0]?.lon && results[0]?.lat) onFocus?.(results[0]);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                isThinking: false,
                thoughtDuration: finalDuration,
                question: text,
                text: res.explanation || `Tìm thấy ${results.length} địa điểm phù hợp.`,
                results,
                proposedPlan: res.proposed_plan || [],
                toolActions: res.tool_actions || [],
                effectiveDestination: res.effective_destination || null,
                candidates: res.candidates || [],
                sources: res.sources || [],
              }
            : m
        )
      );
    } catch (err) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const finalDuration = Math.max(1, Math.round((Date.now() - startMs) / 1000));
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                isThinking: false,
                thoughtDuration: finalDuration,
                text: err.message || "Không thể kết nối trợ lý AI.",
              }
            : m
        )
      );
    } finally {
      setBusy(false);
      isSubmittingRef.current = false;
    }
  };

  const handleApplyPlan = (msgId, daysPlan, effectiveDestination, targetDay = null) => {
    const filteredDays = targetDay ? daysPlan.filter((d) => d.day === targetDay) : daysPlan;
    if (!filteredDays.length) return;
    onApplyPlan?.(filteredDays, effectiveDestination);
    markApplied(targetDay ? `plan_${msgId}_d${targetDay}` : `plan_${msgId}_all`);
  };

  const handleToolAction = (msgId, idx, action) => {
    const key = `tool_${msgId}_${idx}`;
    if (action.type === "optimize_day") {
      onToiUu?.(action.day || 1);
    } else if (action.type === "auto_assign") {
      onAutoAssign?.();
    } else {
      onExecuteToolAction?.(action);
    }
    markApplied(key);
  };

  return (
    <div className={`planner-assistant ${isOpen ? "planner-assistant--open" : ""}`}>
      {isOpen && (
        <section className="planner-assistant__panel" aria-label="Trợ lý lập kế hoạch">
          <header className="planner-assistant__header">
            <div>
              <span className="planner-assistant__eyebrow">Trợ lý Lập lịch trình AI · DeepSeek</span>
              <h2>{trip?.name || "Chuyến đi của bạn"}</h2>
            </div>
            <div className="planner-assistant__header-actions">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  title="Làm mới cuộc trò chuyện"
                  aria-label="Làm mới cuộc trò chuyện"
                >
                  <i className="fa-solid fa-rotate-right" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý">
                <i className="fa-solid fa-minus" />
              </button>
            </div>
          </header>

          {/* Thanh trạng thái ngữ cảnh chuyến đi */}
          <div className="planner-assistant__ctx-bar">
            <span className="planner-assistant__ctx-pill">
              <i className="fa-solid fa-location-dot" />
              {destination || "Chưa cố định điểm đến"}
            </span>
            <span className="planner-assistant__ctx-pill">
              <i className="fa-regular fa-calendar" />
              {soNgay} ngày
            </span>
            <span className="planner-assistant__ctx-pill">
              <i className="fa-solid fa-map-pin" />
              {scheduledPlaces.length} đã xếp · {unscheduledPlaces.length} chờ xếp
            </span>
            {Number(trip?.budget) > 0 && (
              <span className="planner-assistant__ctx-pill">
                <i className="fa-solid fa-wallet" />
                {Number(trip.budget).toLocaleString("vi-VN")}đ
              </span>
            )}
          </div>

          <div ref={bodyRef} className="planner-assistant__body">
            {messages.length === 0 ? (
              <div className="planner-assistant__welcome">
                <p>
                  Trợ lý đã nắm rõ ngữ cảnh chuyến đi <strong>{trip?.name || "hiện tại"}</strong> ({soNgay} ngày
                  {emptyDays.length > 0 ? `, đang trống Ngày ${emptyDays.join(", ")}` : ""}). Chọn nhanh công cụ bên dưới hoặc nhập yêu cầu của bạn:
                </p>
                <div className="planner-assistant__suggestions">
                  {suggestions.map((s) => (
                    <button key={s.label} type="button" onClick={() => ask(s.prompt)}>
                      <i className={`fa-solid ${s.icon}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="planner-assistant__messages" aria-live="polite">
                {messages.map((m) => (
                  <article key={m.id} className={`planner-assistant__message planner-assistant__message--${m.role}`}>
                    {m.role === "assistant" && (m.isThinking || m.thoughtDuration) && (
                      <div className="planner-assistant__thinking">
                        <span className="planner-assistant__thinking-label">
                          {m.isThinking
                            ? `Working...${m.thoughtSeconds > 0 ? ` (${m.thoughtSeconds}s)` : ""}`
                            : `Worked for ${m.thoughtDuration}s`}
                        </span>
                        <i className="fa-solid fa-chevron-right planner-assistant__thinking-chevron" />
                      </div>
                    )}

                    {!m.isThinking && m.text && <p>{m.text}</p>}

                    {/* Lịch trình đề xuất theo từng ngày (Tool: Apply Plan) */}
                    {!m.isThinking && m.proposedPlan?.length > 0 && (
                      <div className="planner-assistant__plan-box">
                        <div className="planner-assistant__plan-head">
                          <span>
                            <i className="fa-solid fa-wand-magic-sparkles" /> Đề xuất lịch trình ({m.proposedPlan.length} ngày)
                          </span>
                          <button
                            type="button"
                            className={`planner-assistant__apply-all ${appliedKeys[`plan_${m.id}_all`] ? "is-applied" : ""}`}
                            onClick={() => handleApplyPlan(m.id, m.proposedPlan, m.effectiveDestination, null)}
                          >
                            {appliedKeys[`plan_${m.id}_all`] ? (
                              <>
                                <i className="fa-solid fa-check" /> Đã áp dụng vào chuyến đi
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-bolt" /> Áp dụng toàn bộ vào chuyến đi
                              </>
                            )}
                          </button>
                        </div>

                        {m.proposedPlan.map((d) => {
                          const dayKey = `plan_${m.id}_d${d.day}`;
                          const isDayApplied = appliedKeys[dayKey] || appliedKeys[`plan_${m.id}_all`];
                          return (
                            <div key={d.day} className="planner-assistant__plan-day">
                              <div className="planner-assistant__plan-day-head">
                                <strong>{d.title || `Ngày ${d.day}`}</strong>
                                <button
                                  type="button"
                                  className={`planner-assistant__apply-day ${isDayApplied ? "is-applied" : ""}`}
                                  onClick={() => handleApplyPlan(m.id, m.proposedPlan, m.effectiveDestination, d.day)}
                                >
                                  {isDayApplied ? `Đã xếp Ngày ${d.day} ✓` : `+ Áp dụng Ngày ${d.day}`}
                                </button>
                              </div>
                              <div className="planner-assistant__plan-acts">
                                {(d.activities || []).map((act, idx) => (
                                  <div
                                    key={`${d.day}_${idx}`}
                                    className="planner-assistant__plan-act"
                                    onClick={() => act.place && onFocus?.(act.place)}
                                  >
                                    <span className="planner-assistant__plan-time">{act.time}</span>
                                    <div className="planner-assistant__plan-act-body">
                                      <strong>
                                        {act.role === "lodging" ? "🏨 " : ""}
                                        {act.place?.name}
                                      </strong>
                                      {act.description && <span>{act.description}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Các nút công cụ hành động 1 chạm (Tool Actions) */}
                    {!m.isThinking && m.toolActions?.length > 0 && (
                      <div className="planner-assistant__tools">
                        {m.toolActions.map((act, idx) => {
                          const key = `tool_${m.id}_${idx}`;
                          const done = appliedKeys[key];
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`planner-assistant__tool-btn ${done ? "is-applied" : ""}`}
                              onClick={() => handleToolAction(m.id, idx, act)}
                            >
                              <i
                                className={`fa-solid ${
                                  done
                                    ? "fa-check"
                                    : act.type === "optimize_day"
                                    ? "fa-route"
                                    : act.type === "auto_assign"
                                    ? "fa-layer-group"
                                    : act.type === "add_checklists"
                                    ? "fa-list-check"
                                    : act.type === "update_budget"
                                    ? "fa-wallet"
                                    : act.type === "update_destination"
                                    ? "fa-location-dot"
                                    : "fa-note-sticky"
                                }`}
                              />
                              <span>{done ? `${act.label} (Đã thực hiện)` : act.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Nguồn tham khảo từ Tavily */}
                    {!m.isThinking && m.sources?.length > 0 && (
                      <div className="planner-assistant__sources">
                        <span className="planner-assistant__sources-title">
                          <i className="fa-solid fa-earth-americas" /> Nguồn tham khảo:
                        </span>
                        <div className="planner-assistant__sources-list">
                          {m.sources.slice(0, 3).map((src, idx) => (
                            <a
                              key={idx}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="planner-assistant__source-item"
                              title={src.title}
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square" />
                              <span>{src.title || src.url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chọn tỉnh/thành phố nếu câu hỏi nhập nhằng */}
                    {!m.isThinking && m.candidates?.length > 0 && (
                      <div className="planner-assistant__suggestions">
                        {m.candidates.map((c) => (
                          <button key={c.name} type="button" onClick={() => ask(m.question, c.name)}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Danh sách địa điểm kèm nút xếp trực tiếp vào Ngày 1..N hoặc Chỗ nghỉ */}
                    {!m.isThinking && m.results?.length > 0 && (
                      <div className="planner-assistant__places-list">
                        {m.results.slice(0, 6).map((r) => {
                          const isLodging = r.suggested_role === "lodging" || r.type === "accommodation";
                          const defaultDay = r.suggested_day || emptyDays[0] || 1;
                          const addDayKey = `add_${m.id}_${r.id}_d${defaultDay}`;
                          const addListKey = `add_${m.id}_${r.id}_list`;

                          return (
                            <div key={`${r.type}-${r.id}`} className="planner-assistant__place">
                              <button type="button" onClick={() => onFocus?.(r)}>
                                <strong>
                                  {r.name}
                                  {r.in_trip_status && (
                                    <em className="planner-assistant__place-badge">{r.in_trip_status}</em>
                                  )}
                                </strong>
                                <span>{r.ai_reason ? `${r.ai_reason} · ${metaPlace(r)}` : metaPlace(r)}</span>
                              </button>
                              <div className="planner-assistant__place-actions">
                                {isLodging ? (
                                  <button
                                    type="button"
                                    className={`planner-assistant__place-btn ${appliedKeys[addDayKey] ? "is-applied" : ""}`}
                                    onClick={() => {
                                      onDatChoNgu ? onDatChoNgu(r, defaultDay) : onAdd?.(r);
                                      markApplied(addDayKey);
                                    }}
                                    title={`Đặt ${r.name} làm chỗ nghỉ Ngày ${defaultDay}`}
                                  >
                                    {appliedKeys[addDayKey] ? "Đã đặt ✓" : `🏨 Ngày ${defaultDay}`}
                                  </button>
                                ) : (
                                  cacNgay.slice(0, 3).map((d) => {
                                    const dKey = `add_${m.id}_${r.id}_d${d}`;
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        className={`planner-assistant__place-btn ${
                                          d === defaultDay ? "is-primary" : ""
                                        } ${appliedKeys[dKey] ? "is-applied" : ""}`}
                                        onClick={() => {
                                          onXep ? onXep(r, d) : onAdd?.(r);
                                          markApplied(dKey);
                                        }}
                                        title={`Xếp ${r.name} vào Ngày ${d}`}
                                      >
                                        {appliedKeys[dKey] ? `Ngày ${d} ✓` : `+N${d}`}
                                      </button>
                                    );
                                  })
                                )}
                                <button
                                  type="button"
                                  className={`planner-assistant__place-icon-btn ${appliedKeys[addListKey] ? "is-applied" : ""}`}
                                  onClick={() => {
                                    onAdd?.(r);
                                    markApplied(addListKey);
                                  }}
                                  title={`Lưu ${r.name} vào danh sách muốn đi`}
                                >
                                  <i className={`fa-solid ${appliedKeys[addListKey] ? "fa-check" : "fa-bookmark"}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <form
            className="planner-assistant__composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Hỏi lịch trình ${soNgay} ngày, tìm quán ăn, khách sạn, tối ưu đường đi...`}
              disabled={busy}
              aria-label="Câu hỏi cho trợ lý"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi câu hỏi">
              {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-arrow-up" />}
            </button>
          </form>
          <p className="planner-assistant__disclaimer">
            Trợ lý AI nắm rõ ngữ cảnh chuyến đi và xếp địa điểm trực tiếp vào các ngày của bạn.
          </p>
        </section>
      )}

      <button
        type="button"
        className="planner-assistant__fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={isOpen ? "Đóng trợ lý" : "Mở trợ lý"}
      >
        <i className={`fa-solid ${isOpen ? "fa-xmark" : "fa-wand-magic-sparkles"}`} />
        <span>{isOpen ? "Đóng" : "Trợ lý AI"}</span>
      </button>
    </div>
  );
}
