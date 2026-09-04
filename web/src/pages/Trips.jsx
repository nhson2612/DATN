import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/skeletons/CardSkeleton";
import "./Trips.css";

const XEM_TRUOC = 3;

const isoNgay = (d) => d.toISOString().slice(0, 10);

function khoiTaoForm() {
  const batDau = new Date();
  batDau.setDate(batDau.getDate() + 7);
  const ketThuc = new Date(batDau);
  ketThuc.setDate(ketThuc.getDate() + 2);
  return { name: "", start_date: isoNgay(batDau), end_date: isoNgay(ketThuc) };
}

/* Lưu start_date + duration_days chứ không lưu end_date: hai giá trị cùng mô tả
 * một thứ thì sớm muộn cũng đá nhau. Ngày kết thúc tính lại khi hiển thị. */
function soNgay(start, end) {
  if (!start || !end) return 1;
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export default function Trips({ user, onNeedAuth }) {
  const [ds, setDs] = useState(null);
  const [dangTao, setDangTao] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(() => khoiTaoForm());
  const nav = useNavigate();

  useEffect(() => {
    if (!user) {
      onNeedAuth();
      setDs([]);
      return;
    }
    api.itineraries().then((d) => setDs(d.itineraries)).catch(() => setDs([]));
    api.destinations(50)
      .then((res) => setDestinations(res?.destinations || (Array.isArray(res) ? res : [])))
      .catch(() => setDestinations([]));
  }, [user]);

  function startCreateTrip() {
    if (!user) {
      onNeedAuth();
      return;
    }
    setDangTao(true);
    setSearchQuery("");
    setForm(khoiTaoForm());
  }

  function handleSelectDestination(destName) {
    const cleanName = destName.replace(/^(Thành phố|Tỉnh)\s+/i, "");
    setForm((cu) => ({ ...cu, name: `Du lịch ${cleanName}` }));
    setSearchQuery(destName);
  }

  async function tao(e) {
    e?.preventDefault();
    if (!form.name.trim()) return;
    const dest = searchQuery.trim();
    const d = await api.saveItinerary({
      name: form.name.trim(),
      description: "",
      destination: dest || null,
      start_date: form.start_date || null,
      duration_days: soNgay(form.start_date, form.end_date),
      // Mục mặc định; người dùng thêm "Nhà hàng", "Quán cà phê"... trong trình soạn.
      sections: [{ key: "muon-di", name: "Địa điểm muốn đi" }],
      stops: [],
    });
    nav(`/chuyen-di/${d.id}`);
  }

  async function xoa(id, e) {
    e.stopPropagation();
    if (!confirm("Xoá chuyến đi này?")) return;
    await api.deleteItinerary(id);
    setDs((cu) => cu.filter((x) => x.id !== id));
  }

  const filteredDestinations = destinations.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const soChuyen = ds?.length || 0;

  return (
    <main className="trips-page">
      <div className="trips-page__header">
        <div>
          <h1 className="trips-page__title">Chuyến đi của bạn</h1>
          <p className="trips-page__subtitle">
            {!user
              ? "Đăng nhập để tạo và lưu lịch trình của riêng bạn."
              : ds === null
                ? "Đang tải..."
                : soChuyen === 0
                  ? "Chưa có chuyến nào được lưu."
                  : `${soChuyen} chuyến đang lên lịch.`}
          </p>
        </div>
        <button onClick={startCreateTrip} className="trips-page__create-btn">
          <i className="fa-solid fa-plus text-xs" /> Tạo chuyến mới
        </button>
      </div>

      {dangTao && (
        <div className="trips-modal-overlay" onClick={() => setDangTao(false)}>
          <div className="trips-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="trips-modal-header">
              <h2 className="trips-modal-heading">Tạo chuyến đi</h2>
              <button onClick={() => setDangTao(false)} className="trips-modal-close" title="Đóng">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={tao} className="trips-modal-body space-y-5">
              <div className="relative">
                <label className="trips-form-label">Điểm đến</label>
                <div className="relative">
                  <i className="fa-solid fa-location-dot trips-modal-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên thành phố (Hà Nội, Sa Pa, Đà Nẵng)..."
                    className="trips-modal-input trips-modal-input--with-icon"
                  />
                </div>

                {filteredDestinations.length > 0 && searchQuery !== form.name.replace("Du lịch ", "") && (
                  <div className="trips-dropdown-list">
                    {filteredDestinations.slice(0, 6).map((d) => (
                      <button
                        key={d.slug}
                        type="button"
                        onClick={() => handleSelectDestination(d.name)}
                        className="trips-dropdown-item"
                      >
                        <i className="fa-solid fa-location-dot text-zinc-400 text-xs" />
                        <span>{d.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="trips-form-label">Tên chuyến đi</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Du lịch Hà Nội"
                  className="trips-modal-input"
                />
              </div>

              <div className="trips-modal-dates">
                <div>
                  <label className="trips-form-label">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => {
                      const start = e.target.value;
                      // Kéo ngày kết thúc theo nếu người dùng chọn ngày bắt đầu
                      // muộn hơn, thay vì để lại một khoảng âm.
                      setForm((cu) => ({
                        ...cu, start_date: start,
                        end_date: cu.end_date && cu.end_date < start ? start : cu.end_date,
                      }));
                    }}
                    className="trips-modal-input"
                  />
                </div>
                <div>
                  <label className="trips-form-label">Ngày kết thúc</label>
                  <input
                    type="date"
                    min={form.start_date}
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="trips-modal-input"
                  />
                </div>
              </div>

              <p className="trips-modal-hint">
                Chuyến đi {soNgay(form.start_date, form.end_date)} ngày.
              </p>

              <div className="trips-modal-footer">
                <button type="button" onClick={() => setDangTao(false)} className="btn-ghost">
                  Huỷ
                </button>
                <button type="submit" disabled={!form.name.trim()} className="btn-primary">
                  Tạo chuyến đi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!user && (
        <div className="trips-empty">
          <span className="trips-empty__icon"><i className="fa-solid fa-route" /></span>
          <h2 className="trips-empty__title">Chuyến đi được lưu theo tài khoản</h2>
          <p className="trips-empty__desc">
            Đăng nhập để lịch trình của bạn còn nguyên khi mở lại trên máy khác.
          </p>
          <button onClick={onNeedAuth} className="trips-empty__btn">Đăng nhập</button>
        </div>
      )}

      {user && ds === null && (
        <div className="trips-page__grid"><CardSkeleton count={3} /></div>
      )}

      {user && ds?.length === 0 && (
        <div className="trips-empty">
          <span className="trips-empty__icon"><i className="fa-solid fa-map-location-dot" /></span>
          <h2 className="trips-empty__title">Chưa có chuyến nào</h2>
          <p className="trips-empty__desc">
            Tạo một chuyến, gom địa điểm bạn thích rồi xếp chúng vào từng ngày trên bản đồ.
          </p>
          <button onClick={startCreateTrip} className="trips-empty__btn">
            <i className="fa-solid fa-plus text-xs" /> Tạo chuyến đầu tiên
          </button>
        </div>
      )}

      {!!ds?.length && (
        <div className="trips-page__grid">
          {ds.map((t) => <TheChuyen key={t.id} t={t} nav={nav} xoa={xoa} />)}
        </div>
      )}
    </main>
  );
}

function TheChuyen({ t, nav, xoa }) {
  // day === -1 là khách sạn neo, không phải điểm tham quan nên không tính vào
  // số địa điểm; day === 0 là đã lưu nhưng chưa xếp vào ngày nào.
  const diem = (t.stops_details || []).filter((s) => s.day !== -1);
  const daXep = diem.filter((s) => s.day > 0).length;
  const xemTruoc = diem.slice(0, XEM_TRUOC);
  const conLai = diem.length - xemTruoc.length;
  // Chuyến cũ nhét điểm đến vào description; chuyến mới có cột riêng.
  const diemDen = (t.destination || (t.description || "").replace(/^Điểm đến:\s*/, "")).trim();

  return (
    <article onClick={() => nav(`/chuyen-di/${t.id}`)} className="trips-card">
      <div className="trips-card__header">
        <h3 className="trips-card__title">{t.name}</h3>
        <button onClick={(e) => xoa(t.id, e)} title="Xoá chuyến đi"
          aria-label={`Xoá ${t.name}`} className="trips-card__delete-btn">
          <i className="fa-solid fa-trash-can text-sm" />
        </button>
      </div>

      {diemDen && (
        <span className="trips-card__dest">
          <i className="fa-solid fa-location-dot text-[10px]" />
          {diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")}
        </span>
      )}

      {xemTruoc.length ? (
        <div className="trips-card__preview">
          {xemTruoc.map((s) => (
            <p key={`${s.type}-${s.id}`} className="trips-card__preview-item">
              <i className="fa-solid fa-location-dot trips-card__preview-icon" />
              <span className="trips-card__preview-name">{s.name}</span>
            </p>
          ))}
          {conLai > 0 && (
            <p className="trips-card__preview-more">và {conLai} địa điểm nữa</p>
          )}
        </div>
      ) : (
        <p className="trips-card__empty">Chưa thêm địa điểm nào.</p>
      )}

      <div className="trips-card__footer">
        <span className="trips-card__stat">
          <i className="fa-regular fa-calendar trips-card__stat-icon" />
          {t.duration_days} ngày
        </span>
        <span className="trips-card__stat">
          <i className="fa-solid fa-location-dot trips-card__stat-icon" />
          {diem.length} địa điểm
        </span>
        {diem.length > 0 && (
          <span className="trips-card__progress">{daXep}/{diem.length} đã xếp</span>
        )}
      </div>
    </article>
  );
}
