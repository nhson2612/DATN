/* Trình bày dữ liệu web (Tavily) đã qua chuẩn hoá có bằng chứng.

Hai chế độ dùng chung MỘT nguồn trạng thái:
- mode="facts":  dải rating · số đánh giá · giờ mở cửa (hoặc skeleton).
- mode="details": tóm tắt, giờ mở cửa kèm nguồn, nhận xét, danh sách Nguồn
  thông tin và trạng thái rỗng/lỗi — đặt trong cột nội dung chính.

Mọi link nguồn đều target="_blank" rel="noopener noreferrer" và chỉ nhận
URL http(s) — backend đã lọc, đây là lớp chặn cuối. Không dùng
dangerouslySetInnerHTML: dữ liệu web luôn render dạng text.
*/

const NOI_DUNG_THUONG = new Set(["http:", "https:"]);

function anToan(url) {
  try {
    const u = new URL(url);
    return NOI_DUNG_THUONG.has(u.protocol) ? url : null;
  } catch {
    return null;
  }
}

function tenMien(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
}

function LinkNguon({ url, children, className = "" }) {
  const u = anToan(url);
  if (!u) return <span className={className}>{children}</span>;
  return (
    <a
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      className={`place-field-guide__link-nguon ${className}`.trim()}
    >
      {children}
    </a>
  );
}

function ngayViet(v) {
  if (!v) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
      new Date(v)
    );
  } catch {
    return String(v);
  }
}

function SaoXep(rating) {
  if (!rating) return null;
  const dem = rating.review_count
    ? `${rating.review_count.toLocaleString("vi-VN")} đánh giá`
    : "điểm";
  return (
    <div className="place-field-guide__fact">
      <i className="fa-solid fa-star place-field-guide__fact-icon" aria-hidden="true" />
      <span className="place-field-guide__fact-value">
        {Number(rating.value).toFixed(1)}
      </span>
      <span className="place-field-guide__fact-label">{dem}</span>
    </div>
  );
}

function GioFact(hours) {
  if (!hours?.display) return null;
  return (
    <div className="place-field-guide__fact place-field-guide__fact--gio">
      <i className="fa-solid fa-clock place-field-guide__fact-icon" aria-hidden="true" />
      <span className="place-field-guide__fact-value">{hours.display}</span>
    </div>
  );
}

function SkeletonO({ rong = "" }) {
  return <div className={`place-field-guide__skeleton ${rong}`.trim()} />;
}

function FactsStrip({ enrichment, state }) {
  if (state === "loading") {
    return (
      <div className="place-field-guide__facts" aria-busy="true">
        <SkeletonO />
        <SkeletonO />
        <SkeletonO rong="place-field-guide__skeleton--rong" />
      </div>
    );
  }
  const rating = SaoXep(enrichment?.rating);
  const gio = GioFact(enrichment?.opening_hours);
  if (!rating && !gio) return null;
  return (
    <div className="place-field-guide__facts" aria-label="Đánh giá và giờ mở cửa">
      {rating}
      {gio}
    </div>
  );
}

function ChiTiet({ enrichment }) {
  const { summary, opening_hours: hours, review_highlights: highlights, sources } =
    enrichment || {};

  return (
    <div className="place-field-guide__chi-tiet">
      {summary && (
        <section className="place-field-guide__doan">
          <h3 className="place-field-guide__tieu-de-doan">Giới thiệu</h3>
          <p className="place-field-guide__summary">{summary}</p>
        </section>
      )}

      {hours?.display && (
        <section className="place-field-guide__doan">
          <h3 className="place-field-guide__tieu-de-doan">Giờ mở cửa</h3>
          <p className="place-field-guide__gio">
            {hours.display}
            {hours.source_url && (
              <LinkNguon url={hours.source_url} className="place-field-guide__link-nguon--noi-dong">
                {" "}
                · nguồn {tenMien(hours.source_url)}
              </LinkNguon>
            )}
          </p>
        </section>
      )}

      {highlights?.length > 0 && (
        <section className="place-field-guide__doan">
          <h3 className="place-field-guide__tieu-de-doan">Khách đã nói gì</h3>
          <ul className="place-field-guide__nhan-xet">
            {highlights.map((h, i) => (
              <li key={`${h.text}-${i}`} className="place-field-guide__nhan-xet-item">
                <i className="fa-solid fa-quote-left" aria-hidden="true" />
                <blockquote className="place-field-guide__nhan-xet-text">
                  {h.text}
                </blockquote>
                <LinkNguon url={h.source_url} className="place-field-guide__nhan-xet-nguon">
                  {h.source_title || tenMien(h.source_url)}
                </LinkNguon>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="place-field-guide__doan">
        <h3 className="place-field-guide__tieu-de-doan">Nguồn thông tin</h3>
        {sources?.length > 0 ? (
          <ul className="place-field-guide__nguon">
            {sources.map((s, i) => (
              <li key={`${s.url}-${i}`}>
                <LinkNguon url={s.url}>
                  <span className="place-field-guide__nguon-mien">{tenMien(s.url)}</span>
                  {s.title && <span className="place-field-guide__nguon-tua"> — {s.title}</span>}
                </LinkNguon>
              </li>
            ))}
          </ul>
        ) : (
          <p className="place-field-guide__trong">Chưa có nguồn trích dẫn.</p>
        )}
      </section>
    </div>
  );
}

export default function EnrichmentContent({ enrichment, state, error, mode = "details" }) {
  if (mode === "facts") {
    return <FactsStrip enrichment={enrichment} state={state} />;
  }

  // mode="details" — luôn hiện tiêu đề (kể cả lúc đang tải) để trang không
  // nhảy chiều cao và thông tin cơ bản không bao giờ bị xoá bởi lỗi web.
  return (
    <section
      className="place-field-guide__web-info"
      aria-busy={state === "loading"}
      aria-label="Thông tin cập nhật từ web"
    >
      <h2 className="place-field-guide__tieu-de">
        <i className="fa-solid fa-globe" aria-hidden="true" />
        Thông tin cập nhật từ web
      </h2>

      {state === "loading" && (
        <div className="place-field-guide__chi-tiet" data-testid="enrichment-skeleton">
          <SkeletonO />
          <SkeletonO rong="place-field-guide__skeleton--rong" />
        </div>
      )}

      {state === "error" && (
        // Mọi đường lỗi của luồng này đều là tạm thời (timeout/429/5xx hoặc
        // poll hết lượt khi người khác đang fetch) — hiện đúng copy đã duyệt,
        // không lộ chuỗi lỗi kỹ thuật của fetch ra giao diện.
        <p
          className="place-field-guide__thong-bao"
          role="status"
          data-loi={error || ""}
        >
          Chưa tải được dữ liệu web; ứng dụng sẽ thử lại ở lần mở sau.
        </p>
      )}

      {state === "not_found" && (
        <p className="place-field-guide__thong-bao" role="status">
          Chưa tìm thấy thông tin công khai bổ sung.
        </p>
      )}

      {state === "success" && enrichment && (
        <>
          <ChiTiet enrichment={enrichment} />
          {enrichment.fetched_at && (
            <p className="place-field-guide__ngay-luu">
              Thông tin công khai được lưu ngày {ngayViet(enrichment.fetched_at)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
