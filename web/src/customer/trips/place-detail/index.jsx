import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../shared/api";
import DetailSkeleton from "../../../shared/skeletons/DetailSkeleton";
import ErrorBoundary from "../../../shared/common/ErrorBoundary";
import MiniMap from "../../../shared/map/MiniMap";
import PlaceGallery from "./PlaceGallery";
import EnrichmentContent from "./EnrichmentContent";
import { tenLoai } from "../../../shared/lib/loaiDiaDiem";
import AppNavbar from "../../../shared/layout/AppNavbar";
import Footer from "../../../shared/layout/Footer";
import "./PlaceDetail.css";

export default function PlaceDetail({ user, onNeedAuth, onLogout }) {
  const { type, id } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);

  // Làm giàu web (Serper) — tách khỏi fetch địa điểm để lỗi/thời gian chờ của
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
      await api.addFavorite(type, id);
      setDaLuu(true);
    } catch (e) {
      alert(e.message || "Không thể lưu vào danh sách yêu thích.");
    }
  }

  if (loi) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
        <main className="flex-1 flex items-center justify-center py-16 text-center px-4">
          <div className="max-w-md w-full mx-auto bg-white p-8 rounded-3xl border border-rose-200 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-rose-500 mb-3 block">error</span>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Đã xảy ra lỗi</h2>
            <p className="text-sm text-slate-600 mb-6">{loi}</p>
            <button
              type="button"
              onClick={() => nav(-1)}
              className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-sm"
            >
              Quay lại trang trước
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
          <DetailSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  const categoryName = tenLoai(p.nhom) || tenLoai(p.category) || tenLoai(type);
  const diaChiDayDu = [p.dia_chi, p.thanh_pho].filter(Boolean).join(", ");

  const socialUrl = p.social || p.tags?.social;
  const emailVal = p.email || p.tags?.email;

  // Chỉ nhận http(s) ở href; thêm giao thức cho giá trị trần "sunworld.vn/…".
  const laHttp = (u) => /^https?:\/\//i.test(u);
  const contact = enrichment?.contact || {};
  const phone = p.dien_thoai || contact.phone || "";
  const website = p.website || contact.website || "";
  const webUrl = website ? (laHttp(website) ? website : `https://${website}`) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <nav className="place-field-guide__nav" aria-label="Điều hướng địa điểm">
          <button type="button" onClick={() => nav(-1)} className="place-field-guide__quay-lai">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Quay lại</span>
          </button>
          <div className="place-field-guide__crumbs-wrap">
            <Link to="/" className="place-field-guide__crumb">Trang chủ</Link>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <span className="place-field-guide__crumb-here">{p.name}</span>
          </div>
          <button
            type="button"
            onClick={luuYeuThich}
            disabled={daLuu}
            className={`place-field-guide__luu-btn ${daLuu ? "place-field-guide__luu-btn--saved" : ""}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {daLuu ? "favorite" : "favorite_border"}
            </span>
            <span>{daLuu ? "Đã lưu" : "Lưu địa điểm"}</span>
          </button>
        </nav>

        <header className="place-field-guide__header">
          <p className="place-field-guide__eyebrow">{categoryName}</p>
          <h1 className="place-field-guide__ten">{p.name}</h1>
          {diaChiDayDu && (
            <p className="place-field-guide__dia-chi">
              <span className="material-symbols-outlined text-[18px] text-teal-600">location_on</span>
              <span>{diaChiDayDu}</span>
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
                  <span className="material-symbols-outlined text-[20px] text-teal-600">map</span>
                  <span>Bản đồ</span>
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
                <span className="material-symbols-outlined text-[20px] text-teal-600">contact_phone</span>
                <span>Liên hệ</span>
              </h2>
              <dl className="place-field-guide__lien-he">
                {phone && (
                  <div className="place-field-guide__lh-item">
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-slate-500">call</span>
                      <span>Điện thoại</span>
                    </dt>
                    <dd>
                      <a href={`tel:${phone}`} className="place-field-guide__link">{phone}</a>
                    </dd>
                  </div>
                )}
                {emailVal && (
                  <div className="place-field-guide__lh-item">
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                      <span>Email</span>
                    </dt>
                    <dd>
                      <a href={`mailto:${emailVal}`} className="place-field-guide__link">{emailVal}</a>
                    </dd>
                  </div>
                )}
                {webUrl && (
                  <div className="place-field-guide__lh-item">
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-slate-500">language</span>
                      <span>Website</span>
                    </dt>
                    <dd>
                      <a href={webUrl} target="_blank" rel="noopener noreferrer" className="place-field-guide__link">
                        {website}
                      </a>
                    </dd>
                  </div>
                )}
                {socialUrl && (
                  <div className="place-field-guide__lh-item">
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-slate-500">share</span>
                      <span>Mạng xã hội</span>
                    </dt>
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
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-amber-500">hotel</span>
                      <span>Hạng sao</span>
                    </dt>
                    <dd>{p.stars} sao</dd>
                  </div>
                )}
                {p.price_range && (
                  <div className="place-field-guide__lh-item">
                    <dt>
                      <span className="material-symbols-outlined text-[16px] text-slate-500">sell</span>
                      <span>Mức giá</span>
                    </dt>
                    <dd>{p.price_range}</dd>
                  </div>
                )}
              </dl>
            </section>
          </aside>
        </div>

        {p.nearby?.length > 0 && (
          <section className="place-field-guide__nearby" aria-labelledby="nearby-title">
            <div className="place-field-guide__nearby-header">
              <h2 id="nearby-title" className="place-field-guide__nearby-heading">
                <span className="material-symbols-outlined text-[24px] text-teal-600">near_me</span>
                <span>Địa điểm lân cận</span>
              </h2>
            </div>

            <div className="place-field-guide__nearby-grid">
              {p.nearby.map((n) => {
                const distStr = n.met < 1000 ? `${n.met} m` : `${(n.met / 1000).toFixed(1)} km`;
                const catStr = n.category || (Array.isArray(n.types) ? n.types[0] : null) || "Điểm đến";
                return (
                  <article
                    key={n.id}
                    onClick={() => nav(`/dia-diem/${n.type || "serper"}/${encodeURIComponent(n.id)}`)}
                    className="place-field-guide__nearby-card"
                  >
                    <div className="place-field-guide__nearby-thumb">
                      {n.anh ? (
                        <img
                          src={n.anh}
                          alt={n.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="place-field-guide__nearby-thumb-img"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="place-field-guide__nearby-thumb-empty"
                        style={{ display: n.anh ? "none" : "flex" }}
                      >
                        <span className="material-symbols-outlined text-3xl text-slate-300">location_on</span>
                      </div>
                      <div className="place-field-guide__nearby-dist-tag">
                        <span className="material-symbols-outlined text-[13px]">near_me</span>
                        <span>{distStr}</span>
                      </div>
                    </div>

                    <div className="place-field-guide__nearby-info">
                      <div className="place-field-guide__nearby-cat-row">
                        <span className="place-field-guide__nearby-category">{catStr}</span>
                        {n.rating ? (
                          <span className="place-field-guide__nearby-star">
                            <span className="material-symbols-outlined text-[14px] text-amber-500 fill-1">star</span>
                            <span>{Number(n.rating).toFixed(1)}</span>
                          </span>
                        ) : null}
                      </div>

                      <h3 className="place-field-guide__nearby-name" title={n.name}>
                        {n.name}
                      </h3>

                      {n.dia_chi && (
                        <p className="place-field-guide__nearby-address" title={n.dia_chi}>
                          <span className="material-symbols-outlined text-[13px] text-slate-400">pin_drop</span>
                          <span>{n.dia_chi}</span>
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
