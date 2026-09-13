import { useRef, useState } from "react";

import { api } from "../../../shared/api";
import FieldError from "../components/FieldError";
import "./ImagesStep.css";

const docAnh = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Không đọc được ảnh."));
  reader.readAsDataURL(file);
});

function PreviewAnh({ src, alt, className }) {
  return src ? <img className={className} src={src} alt={alt} /> : <span className={`${className} op-media-step__empty`}><span className="material-symbols-outlined">add_photo_alternate</span></span>;
}

export default function ImagesStep({ form, setForm, loi = {}, hienLoi = false }) {
  const oFile = useRef(null);
  const [dich, setDich] = useState("cover");
  const [dangTai, setDangTai] = useState(false);
  const [loiTai, setLoiTai] = useState("");
  const [dangKeoAnhBia, setDangKeoAnhBia] = useState(false);
  const [urlAnhBia, setUrlAnhBia] = useState("");
  const images = (form.images || []).filter(Boolean);
  const thieuAnh = hienLoi ? loi.cover_url : "";

  const moFile = (muc) => {
    setDich(muc);
    oFile.current?.click();
  };

  const taiAnh = async (files, muc = dich) => {
    const danhSach = [...files].filter((file) => file?.type?.startsWith("image/"));
    if (!danhSach.length) {
      setLoiTai("Chọn tệp ảnh JPG, PNG hoặc WebP.");
      return;
    }
    setLoiTai("");
    setDangTai(true);
    try {
      const urls = await Promise.all(
        danhSach.map(async (file) => {
          const { url } = await api.uploadOperatorTourMedia(await docAnh(file));
          return url;
        })
      );
      setForm(
        muc === "cover"
          ? { ...form, cover_url: urls[0] }
          : { ...form, images: [...images, ...urls] }
      );
    } catch (error) {
      setLoiTai(error.message);
    } finally {
      setDangTai(false);
    }
  };

  const thaAnhBia = (event) => {
    event.preventDefault();
    setDangKeoAnhBia(false);
    taiAnh(event.dataTransfer.files || [], "cover");
  };

  const thaAnhThuVien = (event) => {
    event.preventDefault();
    taiAnh(event.dataTransfer.files || [], "gallery");
  };

  const danAnh = (event, muc) => {
    const files = [...(event.clipboardData?.files || [])].filter((item) =>
      item.type.startsWith("image/")
    );
    if (files.length) {
      event.preventDefault();
      taiAnh(files, muc);
    }
  };

  const danAnhTuClipboard = async () => {
    setLoiTai("");
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            files.push(new File([blob], "clipboard-cover.png", { type: imageType }));
          }
        }
        if (files.length) {
          await taiAnh(files, "cover");
          return;
        }
      }

      if (navigator.clipboard?.readText) {
        const text = (await navigator.clipboard.readText()).trim();
        if (
          text.startsWith("http://") ||
          text.startsWith("https://") ||
          text.startsWith("data:image/")
        ) {
          setForm({ ...form, cover_url: text });
          return;
        }
      }

      setLoiTai("Không tìm thấy ảnh trong clipboard. Hãy sao chép ảnh trước (Ctrl+C).");
    } catch {
      setLoiTai("Không thể đọc clipboard. Vui lòng cấp quyền hoặc dùng phím tắt Ctrl+V.");
    }
  };

  const apDungUrl = (event) => {
    event.preventDefault();
    const url = urlAnhBia.trim();
    if (!url) return;
    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("data:image/")
    ) {
      setLoiTai("URL ảnh không hợp lệ. Vui lòng nhập link bắt đầu bằng http:// hoặc https://");
      return;
    }
    setLoiTai("");
    setForm({ ...form, cover_url: url });
    setUrlAnhBia("");
  };

  return (
    <section className="op-media-step">
      <input
        ref={oFile}
        className="op-media-step__file"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          taiAnh(event.target.files || []);
          event.target.value = "";
        }}
      />

      <div className={`op-media-step__cover ${thieuAnh ? "op-media-step__cover--invalid" : ""}`}>
        <div className="op-media-step__head">
          <div>
            <h2>Ảnh bìa</h2>
            <span>Hình ảnh đại diện hiển thị đầu tiên trên trang chi tiết và thẻ tour</span>
          </div>
        </div>

        {form.cover_url ? (
          <div className="op-media-step__cover-preview">
            <PreviewAnh src={form.cover_url} alt="Ảnh bìa tour" className="op-media-step__cover-image" />
            <div className="op-media-step__cover-badge">Ảnh bìa hiện tại</div>
            <div className="op-media-step__cover-actions">
              <button
                type="button"
                className="op-media-step__cover-btn"
                onClick={() => moFile("cover")}
              >
                <span className="material-symbols-outlined">edit</span>
                Đổi ảnh
              </button>
              <button
                type="button"
                className="op-media-step__cover-btn op-media-step__cover-btn--danger"
                onClick={() => setForm({ ...form, cover_url: "" })}
              >
                <span className="material-symbols-outlined">delete</span>
                Xoá
              </button>
            </div>
          </div>
        ) : (
          <div className="op-yandex-dropzone">
            <div
              className={`op-yandex-dropzone__inner ${dangKeoAnhBia ? "op-yandex-dropzone__inner--dragging" : ""}`}
              tabIndex={0}
              role="region"
              aria-label="Vùng tải ảnh bìa phong cách Yandex"
              onDragOver={(event) => {
                event.preventDefault();
                setDangKeoAnhBia(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDangKeoAnhBia(true);
              }}
              onDragLeave={() => setDangKeoAnhBia(false)}
              onDrop={thaAnhBia}
              onPaste={(event) => danAnh(event, "cover")}
            >
              {/* Minh hoạ 3 thẻ ảnh phong cách Yandex */}
              <svg
                className="op-yandex-dropzone__icon"
                width="110"
                height="62"
                viewBox="0 0 110 62"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <filter id="yandexShadow" x="14" y="42" width="82" height="20" filterUnits="userSpaceOnUse">
                    <feGaussianBlur stdDeviation="3.5" />
                  </filter>
                  <clipPath id="yandexCenterClip">
                    <rect x="29" y="8" width="52" height="38" rx="8" />
                  </clipPath>
                  <linearGradient id="yandexCardGrad" x1="55" y1="8" x2="55" y2="46" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#373a42" />
                    <stop offset="1" stopColor="#24262d" />
                  </linearGradient>
                  <linearGradient id="yandexGoldGrad" x1="55" y1="20" x2="55" y2="46" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffcd43" />
                    <stop offset="1" stopColor="#f5a426" />
                  </linearGradient>
                </defs>

                {/* Vệt bóng mờ dịu nhẹ trên nền sáng */}
                <ellipse cx="55" cy="50" rx="36" ry="5" fill="#0f172a" opacity="0.18" filter="url(#yandexShadow)" />

                {/* Thẻ bên trái lệch góc */}
                <g transform="translate(18, 16) rotate(-11)">
                  <rect x="0" y="0" width="42" height="29" rx="6" fill="#32343b" stroke="#4b4e58" strokeWidth="1" />
                  <path d="M 4 29 L 16 17 L 27 29 Z" fill="#222429" />
                </g>

                {/* Thẻ bên phải lệch góc */}
                <g transform="translate(56, 9) rotate(11)">
                  <rect x="0" y="0" width="42" height="29" rx="6" fill="#32343b" stroke="#4b4e58" strokeWidth="1" />
                  <path d="M 14 29 L 26 17 L 38 29 Z" fill="#222429" />
                </g>

                {/* Thẻ trung tâm nổi bật */}
                <rect x="29" y="8" width="52" height="38" rx="8" fill="url(#yandexCardGrad)" stroke="#525662" strokeWidth="1" />
                <g clipPath="url(#yandexCenterClip)">
                  {/* Mặt trời */}
                  <circle cx="42" cy="19" r="4.5" fill="#ffcd43" />
                  {/* Dãy núi tối phía sau */}
                  <path d="M 25 46 L 42 27 L 57 46 Z" fill="#4b4e58" />
                  {/* Dãy núi vàng phong cách Yandex */}
                  <path d="M 38 46 L 56 22 L 76 46 Z" fill="url(#yandexGoldGrad)" />
                </g>
              </svg>

              <h3 className="op-yandex-dropzone__title">Kéo thả ảnh vào đây</h3>
              <p className="op-yandex-dropzone__sub">hoặc nhấn nút bên dưới</p>

              <div className="op-yandex-dropzone__actions">
                <button
                  type="button"
                  className="op-yandex-btn op-yandex-btn--primary"
                  onClick={() => moFile("cover")}
                >
                  Chọn tệp
                </button>
                <button
                  type="button"
                  className="op-yandex-btn op-yandex-btn--secondary"
                  onClick={danAnhTuClipboard}
                >
                  Dán từ clipboard
                </button>
              </div>
            </div>

            {/* Thanh nhập URL ảnh phong cách Yandex */}
            <form className="op-yandex-url-bar" onSubmit={apDungUrl}>
              <input
                type="url"
                className="op-yandex-url-input"
                placeholder="Nhập liên kết ảnh (URL)"
                value={urlAnhBia}
                onChange={(e) => setUrlAnhBia(e.target.value)}
              />
              <button
                type="submit"
                className="op-yandex-url-btn"
                disabled={!urlAnhBia.trim()}
              >
                Áp dụng
              </button>
            </form>
          </div>
        )}
        <FieldError>{thieuAnh}</FieldError>
      </div>

      <div
        className="op-media-step__gallery"
        onDragOver={(event) => event.preventDefault()}
        onDrop={thaAnhThuVien}
        onPaste={(event) => danAnh(event, "gallery")}
      >
        <div className="op-media-step__head">
          <div>
            <h2>Ảnh trong tour</h2>
            <span>Thêm các góc chụp hấp dẫn trong lịch trình và dịch vụ của tour</span>
          </div>
        </div>
        <div className="op-media-step__grid">
          {images.map((url, index) => (
            <div className="op-media-step__tile" key={url}>
              <PreviewAnh src={url} alt={`Ảnh tour ${index + 1}`} className="op-media-step__thumbnail" />
              <button
                type="button"
                aria-label={`Xoá ảnh ${index + 1}`}
                title="Xoá ảnh"
                onClick={() =>
                  setForm({ ...form, images: images.filter((_, i) => i !== index) })
                }
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          ))}
          <div
            className="op-media-step__add-tile"
            role="button"
            tabIndex={0}
            aria-label="Thêm ảnh vào thư viện"
            onClick={() => moFile("gallery")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") moFile("gallery");
            }}
          >
            <span className="material-symbols-outlined">add_photo_alternate</span>
          </div>
        </div>
      </div>

      {dangTai && <p className="op-media-step__status">Đang tải ảnh…</p>}
      {loiTai && <p className="op-media-step__error">{loiTai}</p>}
    </section>
  );
}
