import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import DetailSkeleton from "../../components/skeletons/DetailSkeleton";
import ErrorBoundary from "../../components/common/ErrorBoundary";
import MiniMap from "../../components/map/MiniMap";
import BookingForm from "../../components/modals/BookingForm";
import PlaceGallery from "./PlaceGallery";
import EnrichmentContent from "./EnrichmentContent";
import { tenLoai } from "../../lib/loaiDiaDiem";
import "./PlaceDetail.css";

export default function PlaceDetail({ user, onNeedAuth }) {
  const { type, id } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);
  const [moForm, setMoForm] = useState(false);

  // Làm giàu web (Tavily) — tách khỏi fetch địa điểm để lỗi/thời gian chờ của
  // nó KHÔNG bao giờ làm chậm hay xoá nội dung cơ bản của trang.
  const [enrichment, setEnrichment] = useState(null);
  const [enrichmentState, setEnrichmentState] = useState("loading");
  const [enrichmentError, setEnrichmentError] = useState("");

  useEffect(() => {
    setP(null);
    setDaLuu(false);
    setLoi("");

    api
      .place(type, id)
      .then((d) => {
        if (d?.place) {
          setP(d.place);
        } else {
          setLoi("Không tìm thấy thông tin địa điểm.");
        }
      })
      .catch((e) => setLoi(e.message || "Lỗi khi tải thông tin địa điểm."));
  }, [type, id]);

  // Effect riêng, có thể huỷ: gọi POST /enrichment; 202 "fetching" thì poll
  // lại tối đa 3 lần × 2 giây. Lần thứ 4 vẫn fetching -> báo lỗi tạm thời,
  // lần mở sau tự thử lại (không đánh dấu thành công sai).
  useEffect(() => {
    let cancelled = false;
    const timers = [];

    async function load(attempt = 0) {
      try {
        const data = await api.enrichPlace(type, id);
        if (cancelled) return;
        if (data.status === "fetching" && attempt < 3) {
          timers.push(setTimeout(() => load(attempt + 1), 2000));
          return;
        }
        setEnrichment(data.enrichment || null);
        setEnrichmentState(
          data.status === "not_found" ? "not_found" : "success"
        );
      } catch (e) {
        if (!cancelled) {
          setEnrichmentState("error");
          setEnrichmentError(e.message || "");
        }
      }
    }

    setEnrichment(null);
    setEnrichmentState("loading");
    setEnrichmentError("");
    load();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [type, id]);

  async function luuYeuThich() {
    if (!user) return onNeedAuth();
    try {
      await api.addFavorite(type, Number(id));
      setDaLuu(true);
    } catch (e) {
      alert(e.message || "Không thể lưu vào danh sách yêu thích.");
    }
  }

  if (loi) {
    return (
      <main className="place-field-guide py-16 text-center">
        <div className="max-w-md mx-auto bg-rose-50 dark:bg-rose-950/40 p-6 rounded-3xl border border-rose-200 dark:border-rose-900">
          <i className="fa-solid fa-circle-exclamation text-3xl text-rose-500 mb-3 block" />
          <h2 className="text-lg font-bold text-rose-800 dark:text-rose-200 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-sm text-rose-600 dark:text-rose-300 mb-4">{loi}</p>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-5 py-2 rounded-full bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
          >
            Quay lại trang trước
          </button>
        </div>
      </main>
    );
  }

  if (!p) return <DetailSkeleton />;

  const categoryName = tenLoai(p.nhom) || tenLoai(p.category) || tenLoai(type);
  const diaChiDayDu = [p.dia_chi, p.thanh_pho].filter(Boolean).join(", ");

  const socialUrl = p.social || p.tags?.social;
  const emailVal = p.email || p.tags?.email;

  // Chỉ nhận http(s) ở href; thêm giao thức cho giá trị trần "sunworld.vn/…".
  const laHttp = (u) => /^https?:\/\//i.test(u);
  const webUrl = p.website ? (laHttp(p.website) ? p.website : `https://${p.website}`) : null;

  return (
    <main className="place-field-guide">
      <nav className="place-field-guide__nav" aria-label="Điều hướng địa điểm">
        <button type="button" onClick={() => nav(-1)} className="place-field-guide__quay-lai">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Quay lại
        </button>
        <Link to="/dia-diem" className="place-field-guide__crumb">Địa điểm</Link>
        <span aria-hidden="true">/</span>
        <span className="place-field-guide__crumb-here">{p.name}</span>
        <button
          type="button"
          onClick={luuYeuThich}
          disabled={daLuu}
          className={`place-field-guide__luu-btn ${daLuu ? "place-field-guide__luu-btn--saved" : ""}`}
        >
          <i className={`fa-${daLuu ? "solid" : "regular"} fa-heart`} aria-hidden="true" />
          {daLuu ? "Đã lưu" : "Lưu địa điểm"}
        </button>
      </nav>

      <header className="place-field-guide__header">
        <p className="place-field-guide__eyebrow">{categoryName}</p>
        <h1 className="place-field-guide__ten">{p.name}</h1>
        {diaChiDayDu && (
          <p className="place-field-guide__dia-chi">
            <i className="fa-solid fa-location-dot" aria-hidden="true" /> {diaChiDayDu}
          </p>
        )}
      </header>

      <PlaceGallery
        name={p.name}
        baseImage={p.anh}
        credit={p.anh_nguon}
        images={enrichment?.images}
        loading={enrichmentState === "loading"}
      />

      <EnrichmentContent
        enrichment={enrichment}
        state={enrichmentState}
        error={enrichmentError}
        mode="facts"
      />

      <div className="place-field-guide__columns">
        <article className="place-field-guide__article">
          {p.description && <p className="place-field-guide__mo-ta">{p.description}</p>}
          <EnrichmentContent
            enrichment={enrichment}
            state={enrichmentState}
            error={enrichmentError}
            mode="details"
          />
        </article>

        <aside className="place-field-guide__aside">
          {p.lon != null && p.lat != null && (
            <section className="place-field-guide__card" aria-labelledby="bd-title">
              <h2 className="place-field-guide__card-title" id="bd-title">
                <i className="fa-solid fa-map-location-dot" aria-hidden="true" /> Bản đồ
              </h2>
              <div className="place-field-guide__map">
                <ErrorBoundary ten="Bản đồ">
                  <MiniMap lon={p.lon} lat={p.lat} />
                </ErrorBoundary>
              </div>
            </section>
          )}

          <section className="place-field-guide__card" aria-labelledby="lh-title">
            <h2 className="place-field-guide__card-title" id="lh-title">
              <i className="fa-solid fa-address-book" aria-hidden="true" /> Liên hệ
            </h2>
            <dl className="place-field-guide__lien-he">
              {p.dien_thoai && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-solid fa-phone" aria-hidden="true" />Điện thoại</dt>
                  <dd>
                    <a href={`tel:${p.dien_thoai}`} className="place-field-guide__link">{p.dien_thoai}</a>
                  </dd>
                </div>
              )}
              {emailVal && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-solid fa-envelope" aria-hidden="true" />Email</dt>
                  <dd>
                    <a href={`mailto:${emailVal}`} className="place-field-guide__link">{emailVal}</a>
                  </dd>
                </div>
              )}
              {webUrl && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-solid fa-globe" aria-hidden="true" />Website</dt>
                  <dd>
                    <a href={webUrl} target="_blank" rel="noopener noreferrer" className="place-field-guide__link">
                      {p.website}
                    </a>
                  </dd>
                </div>
              )}
              {socialUrl && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-brands fa-facebook" aria-hidden="true" />Mạng xã hội</dt>
                  <dd>
                    <a
                      href={laHttp(socialUrl) ? socialUrl : `https://${socialUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="place-field-guide__link"
                    >
                      Trang Fanpage
                    </a>
                  </dd>
                </div>
              )}
              {p.stars && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-solid fa-hotel" aria-hidden="true" />Hạng sao</dt>
                  <dd>{p.stars} sao</dd>
                </div>
              )}
              {p.price_range && (
                <div className="place-field-guide__lh-item">
                  <dt><i className="fa-solid fa-tag" aria-hidden="true" />Mức giá</dt>
                  <dd>{p.price_range}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="place-field-guide__card place-field-guide__hanh-dong" aria-labelledby="hd-title">
            <h2 className="place-field-guide__card-title" id="hd-title">
              <i className="fa-solid fa-bolt" aria-hidden="true" /> Hành động
            </h2>
            {/* Website/Fanpage nằm ở thẻ Liên hệ bên trên — không lặp link. */}
            <button
              type="button"
              onClick={() => (user ? setMoForm(true) : onNeedAuth())}
              className="place-field-guide__btn-chinh"
            >
              <i className="fa-solid fa-paper-plane" aria-hidden="true" /> Gửi yêu cầu đặt chỗ
            </button>
          </section>
        </aside>
      </div>

      {p.nearby?.length > 0 && (
        <section className="place-field-guide__nearby" aria-labelledby="nearby-title">
          <h2 id="nearby-title" className="place-field-guide__card-title place-field-guide__nearby-title">
            <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> Gần đây
          </h2>
          <div className="place-field-guide__nearby-grid">
            {p.nearby.map((n) => (
              <article
                key={n.id}
                onClick={() => nav(`/dia-diem/poi/${n.id}`)}
                className="place-field-guide__nearby-card"
              >
                <h3 className="place-field-guide__nearby-name">{n.name}</h3>
                <p className="place-field-guide__nearby-dist">
                  <i className="fa-solid fa-route" aria-hidden="true" />
                  cách {n.met < 1000 ? `${n.met} m` : `${(n.met / 1000).toFixed(1)} km`}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <BookingForm
        open={moForm}
        onClose={() => setMoForm(false)}
        placeType={type}
        placeId={Number(id)}
        placeName={p.name}
      />
    </main>
  );
}
