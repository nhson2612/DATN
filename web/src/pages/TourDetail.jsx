import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DetailSkeleton from "../components/skeletons/DetailSkeleton";
import TourBookingForm from "../components/modals/TourBookingForm";
import "./TourDetail.css";

export default function TourDetail({ user, onNeedAuth }) {
  const { slug } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [loi, setLoi] = useState("");
  const [dot, setDot] = useState(null);
  const [moForm, setMoForm] = useState(false);

  useEffect(() => {
    setT(null);
    api.tour(slug).then((d) => { setT(d.tour); setDot(d.tour.departures?.[0] || null); })
      .catch((e) => setLoi(e.message));
  }, [slug]);

  if (loi) return <main className="tour-detail-page text-red-500">{loi}</main>;
  if (!t) return <DetailSkeleton />;

  return (
    <main className="tour-detail-page">
      <button onClick={() => nav("/tour")} className="tour-detail-page__back-btn">
        <i className="fa-solid fa-arrow-left" /> Tất cả tour
      </button>

      <div className="tour-detail-page__grid">
        <div className="tour-detail-page__main">
          <div className="tour-detail-page__hero-banner">
            <p className="tour-detail-page__province">
              <i className="fa-solid fa-location-dot" /> {t.province_name}
            </p>
            <h1 className="tour-detail-page__title">{t.name}</h1>
            <p className="tour-detail-page__summary">{t.summary}</p>
          </div>

          {t.highlights?.length > 0 && (
            <section className="tour-detail-page__highlights-section">
              <h2 className="tour-detail-page__highlights-title">Điểm nhấn hành trình</h2>
              <div className="tour-detail-page__highlights-list">
                {t.highlights.map((h, i) => (
                  <span key={i} className="tour-detail-page__highlight-tag">
                    <i className="fa-solid fa-star text-accent-400" /> {h}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="tour-detail-page__itinerary-section">
            <h2 className="tour-detail-page__itinerary-title">Lịch trình chi tiết</h2>
            <div className="tour-detail-page__itinerary-list">
              {(t.itinerary || []).map((n) => (
                <div key={n.day} className="tour-detail-page__itinerary-day">
                  <div className="tour-detail-page__day-header">
                    <span className="tour-detail-page__day-badge">
                      Ngày {n.day}
                    </span>
                    <h3 className="tour-detail-page__day-title">{n.title}</h3>
                  </div>
                  <p className="tour-detail-page__day-desc">{n.description}</p>
                  {n.places?.length > 0 && (
                    <div className="tour-detail-page__day-places">
                      {n.places.map((p) => (
                        <button key={p.id} onClick={() => nav(`/dia-diem/poi/${p.id}`)}
                                className="tour-detail-page__place-tag">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="tour-detail-page__includes-grid">
            {t.included && (
              <section className="tour-detail-page__includes-card">
                <h3 className="tour-detail-page__includes-title">
                  <i className="fa-solid fa-circle-check" /> Giá bao gồm
                </h3>
                <p className="tour-detail-page__includes-text">{t.included}</p>
              </section>
            )}
            {t.excluded && (
              <section className="tour-detail-page__includes-card">
                <h3 className="tour-detail-page__excludes-title">
                  <i className="fa-solid fa-circle-xmark" /> Không bao gồm
                </h3>
                <p className="tour-detail-page__includes-text">{t.excluded}</p>
              </section>
            )}
          </div>
        </div>

        <aside className="tour-detail-page__sidebar">
          <div className="tour-detail-page__booking-card">
            <p className="tour-detail-page__price-label">Giá từ</p>
            <p className="tour-detail-page__price-value">
              {t.price_from?.toLocaleString("vi-VN")}
              <span className="text-sm font-normal text-zinc-500"> đ/khách</span>
            </p>

            <p className="tour-detail-page__select-label">Chọn ngày khởi hành</p>
            {t.departures?.length ? (
              <div className="tour-detail-page__departures-list">
                {t.departures.map((d) => (
                  <button key={d.id} onClick={() => setDot(d)}
                          className={`tour-detail-page__departure-btn ${
                            dot?.id === d.id ? "tour-detail-page__departure-btn--selected" : ""
                          }`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {new Date(d.depart_date).toLocaleDateString("vi-VN", {
                          weekday: "short", day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="text-accent-700 font-semibold">
                        {d.price?.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">còn {d.seats_left} chỗ</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mb-4">Hiện chưa mở đợt khởi hành mới.</p>
            )}

            <button onClick={() => (user ? setMoForm(true) : onNeedAuth())}
                    disabled={!dot}
                    className="tour-detail-page__book-btn">
              <i className="fa-solid fa-paper-plane" /> Đặt tour
            </button>
            <p className="tour-detail-page__disclaimer">
              Yêu cầu đặt chỗ, chưa thanh toán. Chúng tôi gọi lại xác nhận.
            </p>
          </div>
        </aside>
      </div>

      <TourBookingForm open={moForm} onClose={() => setMoForm(false)}
                       tour={t} departure={dot} />
    </main>
  );
}
