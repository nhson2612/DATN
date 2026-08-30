/* Trang du lịch: điểm đến -> danh sách -> chi tiết.
 *
 * Bản trước lấy bản đồ làm trung tâm (bản đồ toàn màn hình, sidebar bên trái).
 * Không trang du lịch nào làm vậy — Traveloka, Booking, vietnam.travel đều là
 * trang nội dung: hero + ô tìm + lưới thẻ ảnh, còn bản đồ chỉ xuất hiện ở trang
 * chi tiết. Bản đồ cũ được giữ nguyên ở map.html.
 */

const VIEWS = ["view-home", "view-dest", "view-list", "view-detail", "view-fav"];
let diemDenHienTai = null;
let boLocHienTai = { destination: null, nhom: null, page: 1 };

const NHOM = {
    tham_quan: { ten: "Tham quan", icon: "fa-landmark" },
    an_uong:   { ten: "Ăn uống",   icon: "fa-utensils" },
    vui_choi:  { ten: "Vui chơi",  icon: "fa-masks-theater" },
    mua_sam:   { ten: "Mua sắm",   icon: "fa-bag-shopping" },
    luu_tru:   { ten: "Nơi lưu trú", icon: "fa-bed" },
};

// Ảnh nền theo nhóm cho địa điểm chưa có ảnh — Wikimedia chỉ phủ được điểm nổi
// tiếng, phần lớn CSDL là địa điểm địa phương nên đa số thẻ sẽ dùng cái này.
const MAU_NHOM = {
    tham_quan: "from-amber-400 to-orange-500",
    an_uong:   "from-rose-400 to-red-500",
    vui_choi:  "from-violet-400 to-purple-500",
    mua_sam:   "from-emerald-400 to-teal-500",
    luu_tru:   "from-sky-400 to-blue-500",
};

function _hien(view) {
    VIEWS.forEach(v => document.getElementById(v)?.classList.toggle("hidden", v !== view));
    document.getElementById("hero").style.display = (view === "view-home") ? "" : "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function veTrangChu() { _hien("view-home"); }

/* ── Thẻ ─────────────────────────────────────────────────────────────────── */

function _theAnh(p, nhomKey) {
    if (p.anh) {
        return `<img src="${p.anh}" alt="" loading="lazy" class="card-img w-full">`;
    }
    const mau = MAU_NHOM[nhomKey] || "from-slate-300 to-slate-400";
    const icon = NHOM[nhomKey]?.icon || "fa-location-dot";
    return `<div class="card-img w-full bg-gradient-to-br ${mau} flex items-center justify-center">
              <i class="fa-solid ${icon} text-white/80 text-3xl"></i>
            </div>`;
}

function _theDiaDiem(p, nhomKey) {
    return `
    <article onclick="moChiTiet('${p.type}',${p.id})"
             class="group cursor-pointer rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition">
      <div class="overflow-hidden">${_theAnh(p, nhomKey)}</div>
      <div class="p-3">
        <h3 class="font-semibold text-sm line-2 group-hover:text-brand-600">${p.name}</h3>
        <p class="text-xs text-slate-500 mt-1">${(p.category || "").replace(/_/g, " ")}</p>
        ${p.dia_chi ? `<p class="text-xs text-slate-400 mt-1 line-2"><i class="fa-solid fa-location-dot"></i> ${p.dia_chi}</p>` : ""}
      </div>
    </article>`;
}

/* ── Trang chủ: điểm đến ─────────────────────────────────────────────────── */

async function taiDiemDen() {
    const box = document.getElementById("dest-grid");
    box.innerHTML = `<p class="text-slate-400 text-sm">Đang tải...</p>`;
    try {
        const res = await apiFetch("/destinations?limit=24");
        const { destinations } = await res.json();
        box.innerHTML = destinations.map((d, i) => `
          <article onclick="moDiemDen('${d.slug}')"
                   class="group cursor-pointer rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition">
            <div class="card-img w-full bg-gradient-to-br ${["from-sky-400 to-blue-600","from-emerald-400 to-teal-600","from-amber-400 to-orange-600","from-violet-400 to-purple-600"][i % 4]}
                        flex flex-col items-center justify-center text-white">
              <i class="fa-solid fa-location-dot text-2xl mb-1 opacity-80"></i>
              <span class="font-bold text-lg px-3 text-center">${d.name.replace(/^(Thành phố|Tỉnh)\s+/, "")}</span>
            </div>
            <div class="p-3 flex items-center justify-between">
              <span class="text-xs text-slate-500">
                ${d.so_dia_diem.toLocaleString("vi-VN")} địa điểm
              </span>
              <span class="text-xs text-slate-400">${d.so_luu_tru.toLocaleString("vi-VN")} nơi ở</span>
            </div>
          </article>`).join("");
    } catch (e) {
        console.error(e);
        box.innerHTML = `<p class="text-red-500 text-sm">Không tải được danh sách điểm đến. Kiểm tra backend đã chạy chưa.</p>`;
    }
}

function timDiemDen() {
    const v = document.getElementById("q-dest").value.trim();
    if (v) moDiemDen(v);
}

/* ── Một điểm đến ────────────────────────────────────────────────────────── */

async function moDiemDen(slug) {
    _hien("view-dest");
    document.getElementById("dest-title").innerText = "Đang tải...";
    document.getElementById("dest-groups").innerHTML = "";
    try {
        const res = await apiFetch(`/destinations/${encodeURIComponent(slug)}`);
        if (!res.ok) {
            document.getElementById("dest-title").innerText = "Không tìm thấy điểm đến";
            document.getElementById("dest-sub").innerText = `Thử gõ tên tỉnh/thành, ví dụ "Đà Nẵng".`;
            return;
        }
        const d = await res.json();
        diemDenHienTai = d;
        document.getElementById("dest-title").innerText = d.name;
        document.getElementById("dest-sub").innerText =
            `${d.groups.reduce((s, g) => s + g.items.length, 0)} địa điểm nổi bật`;

        document.getElementById("dest-groups").innerHTML = d.groups.map(g => `
          <div class="mb-10">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold">
                <i class="fa-solid ${NHOM[g.key]?.icon || "fa-location-dot"} text-brand-500"></i> ${g.ten}
              </h3>
              <button onclick="moDanhSach('${d.slug}','${g.key}')"
                      class="text-sm text-brand-600 font-medium hover:underline">Xem tất cả</button>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              ${g.items.slice(0, 8).map(p => _theDiaDiem(p, g.key)).join("")}
            </div>
          </div>`).join("");
    } catch (e) { console.error(e); }
}

/* ── Danh sách có bộ lọc ─────────────────────────────────────────────────── */

function moTatCaDiaDiem(nhom) {
    moDanhSach(diemDenHienTai?.slug || null, nhom);
}

async function moDanhSach(destination, nhom, page = 1) {
    _hien("view-list");
    boLocHienTai = { destination, nhom, page };
    document.getElementById("list-title").innerText =
        `${NHOM[nhom]?.ten || "Địa điểm"}${destination ? "" : " — cả nước"}`;

    document.getElementById("list-filters").innerHTML = Object.entries(NHOM).map(([k, v]) => `
      <button onclick="moDanhSach(${destination ? `'${destination}'` : "null"},'${k}')"
              class="px-3 py-1.5 rounded-full text-sm border transition
                     ${k === nhom ? "bg-brand-500 text-white border-brand-500"
                                  : "border-slate-300 text-slate-600 hover:border-brand-500"}">
        <i class="fa-solid ${v.icon}"></i> ${v.ten}
      </button>`).join("");

    const grid = document.getElementById("list-grid");
    grid.innerHTML = `<p class="text-slate-400 text-sm">Đang tải...</p>`;

    // "Nơi lưu trú" nằm ở bảng accommodation, không có trong /places/search
    // (endpoint đó chỉ tra bảng poi) — lấy qua trang điểm đến.
    if (nhom === "luu_tru") {
        if (!destination) { grid.innerHTML = `<p class="text-slate-500 text-sm">Chọn một điểm đến để xem nơi lưu trú.</p>`; return; }
        const d = await (await apiFetch(`/destinations/${destination}`)).json();
        const g = d.groups.find(x => x.key === "luu_tru");
        grid.innerHTML = (g?.items || []).map(p => _theDiaDiem(p, "luu_tru")).join("")
            || `<p class="text-slate-500 text-sm">Không có dữ liệu.</p>`;
        document.getElementById("list-more").innerHTML = "";
        return;
    }

    const qs = new URLSearchParams({ page, page_size: 24 });
    if (destination) qs.set("destination", destination);
    if (nhom) qs.set("nhom", nhom);
    try {
        const d = await (await apiFetch(`/places/search?${qs}`)).json();
        grid.innerHTML = d.items.map(p => _theDiaDiem(p, nhom)).join("")
            || `<p class="text-slate-500 text-sm">${d.error || "Không có địa điểm nào."}</p>`;
        const conNua = d.total > page * 24;
        document.getElementById("list-more").innerHTML = conNua
            ? `<button onclick="moDanhSach(${destination ? `'${destination}'` : "null"},'${nhom}',${page + 1})"
                       class="px-6 py-2.5 border border-slate-300 rounded-lg hover:border-brand-500 text-sm font-medium">
                 Xem thêm (${(d.total - page * 24).toLocaleString("vi-VN")} địa điểm)</button>`
            : `<p class="text-sm text-slate-400">Đã hết — tổng ${d.total.toLocaleString("vi-VN")} địa điểm.</p>`;
    } catch (e) { console.error(e); }
}

/* ── Chi tiết ────────────────────────────────────────────────────────────── */

async function moChiTiet(type, id) {
    _hien("view-detail");
    const box = document.getElementById("view-detail");
    box.innerHTML = `<p class="text-slate-400 text-sm">Đang tải...</p>`;
    try {
        const res = await apiFetch(`/places/${type}/${id}`);
        if (!res.ok) { box.innerHTML = `<p class="text-red-500">Không tìm thấy địa điểm.</p>`; return; }
        const p = (await res.json()).place;

        const thongTin = [];
        if (p.dia_chi) thongTin.push(["fa-location-dot", p.dia_chi]);
        if (p.dien_thoai) thongTin.push(["fa-phone", `<a href="tel:${p.dien_thoai}" class="text-brand-600">${p.dien_thoai}</a>`]);
        if (p.stars) thongTin.push(["fa-star", `${p.stars} sao`]);
        if (p.price_range) thongTin.push(["fa-tag", p.price_range]);

        box.innerHTML = `
          <button onclick="${diemDenHienTai ? `moDiemDen('${diemDenHienTai.slug}')` : "veTrangChu()"}"
                  class="text-sm text-slate-500 hover:text-brand-600 mb-4">
            <i class="fa-solid fa-arrow-left"></i> Quay lại
          </button>

          <div class="grid lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2">
              ${p.anh ? `<img src="${p.anh}" class="w-full rounded-2xl mb-2" alt="">
                         <p class="text-xs text-slate-400 mb-4">Ảnh: ${p.anh_nguon || "Wikimedia Commons"}</p>`
                      : `<div class="w-full h-64 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mb-4">
                           <i class="fa-solid fa-image text-4xl text-white"></i></div>`}
              <h1 class="text-2xl font-bold">${p.name}</h1>
              <p class="text-sm text-brand-600 mb-4">${(p.category || "").replace(/_/g, " ")}</p>
              ${p.description ? `<p class="text-slate-600 leading-relaxed mb-6">${p.description}</p>` : ""}

              <div class="space-y-2 text-sm mb-6">
                ${thongTin.map(([ic, t]) => `<div><i class="fa-solid ${ic} text-slate-400 w-5"></i> ${t}</div>`).join("")}
              </div>

              <!-- Bản đồ chỉ xuất hiện ở đây, đúng chỗ người dùng cần: Baymard
                   đo được 57% trang du lịch thiếu bản đồ ở trang chi tiết. -->
              <div id="detail-map" class="w-full h-64 rounded-2xl border border-slate-200 mb-6"></div>
            </div>

            <aside class="lg:col-span-1">
              <div class="border border-slate-200 rounded-2xl p-5 sticky top-20">
                <button onclick="luuYeuThich('${p.type}',${p.id},this)"
                        class="w-full mb-2 py-2.5 rounded-lg border border-slate-300 hover:border-rose-400 hover:text-rose-500 font-medium text-sm">
                  <i class="fa-regular fa-heart"></i> Lưu yêu thích
                </button>
                <button onclick='moDatCho("${p.type}",${p.id},${JSON.stringify(p.name)})'
                        class="w-full mb-2 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm">
                  <i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu đặt chỗ
                </button>
                ${p.website ? `<a href="${p.website}" target="_blank" rel="noopener"
                     class="block text-center w-full py-2.5 rounded-lg border border-slate-300 hover:border-brand-500 text-sm font-medium">
                     <i class="fa-solid fa-arrow-up-right-from-square"></i> Trang chính thức</a>` : ""}
                <p class="text-xs text-slate-400 mt-3 text-center">
                  Thông tin đánh giá xem tại trang chính thức của địa điểm.
                </p>
              </div>
            </aside>
          </div>

          ${p.nearby?.length ? `
            <div class="mt-10">
              <h3 class="text-lg font-bold mb-4"><i class="fa-solid fa-location-crosshairs text-brand-500"></i> Gần đây</h3>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                ${p.nearby.map(n => `
                  <article onclick="moChiTiet('poi',${n.id})"
                           class="cursor-pointer rounded-xl border border-slate-200 p-3 hover:shadow-md transition">
                    <h4 class="font-semibold text-sm line-2">${n.name}</h4>
                    <p class="text-xs text-slate-400 mt-1">cách ${n.met} m</p>
                  </article>`).join("")}
              </div>
            </div>` : ""}
        `;
        _veBanDoNho(p);
    } catch (e) { console.error(e); }
}

function _veBanDoNho(p) {
    const el = document.getElementById("detail-map");
    if (!el || !p.lon) return;
    // Nạp MapLibre theo yêu cầu: trang chủ và danh sách không cần bản đồ, tải
    // sẵn thư viện chỉ làm chậm lần vào đầu tiên.
    const ve = () => {
        const m = new maplibregl.Map({
            container: "detail-map",
            style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
            center: [p.lon, p.lat], zoom: 15,
        });
        new maplibregl.Marker({ color: "#2563eb" }).setLngLat([p.lon, p.lat]).addTo(m);
    };
    if (window.maplibregl) return ve();
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
    js.onload = ve;
    document.head.appendChild(js);
}

/* ── Yêu thích & đặt chỗ ─────────────────────────────────────────────────── */

async function luuYeuThich(type, id, btn) {
    if (!localStorage.getItem("token")) return moAuth();
    const res = await apiFetch("/favorites", {
        method: "POST", body: JSON.stringify({ place_type: type, place_id: id }),
    });
    if (res.ok) {
        const d = await res.json();
        btn.innerHTML = `<i class="fa-solid fa-heart text-rose-500"></i> ${d.da_co ? "Đã có trong yêu thích" : "Đã lưu"}`;
        btn.disabled = true;
    }
}

async function moYeuThich() {
    if (!localStorage.getItem("token")) return moAuth();
    _hien("view-fav");
    const grid = document.getElementById("fav-grid");
    grid.innerHTML = `<p class="text-slate-400 text-sm">Đang tải...</p>`;
    const { favorites } = await (await apiFetch("/favorites")).json();
    grid.innerHTML = favorites.length
        ? favorites.map(f => `
            <article class="rounded-xl border border-slate-200 overflow-hidden">
              <div onclick="moChiTiet('${f.place_type}',${f.place_id})" class="cursor-pointer">
                ${_theAnh(f, "tham_quan")}
                <div class="p-3"><h3 class="font-semibold text-sm line-2">${f.name}</h3>
                  <p class="text-xs text-slate-500 mt-1">${(f.category || "").replace(/_/g, " ")}</p></div>
              </div>
              <button onclick="boYeuThich('${f.place_type}',${f.place_id})"
                      class="w-full py-2 text-xs text-slate-400 hover:text-rose-500 border-t border-slate-100">
                <i class="fa-solid fa-xmark"></i> Bỏ lưu</button>
            </article>`).join("")
        : `<p class="text-slate-500 text-sm col-span-full">Chưa lưu địa điểm nào.</p>`;
}

async function boYeuThich(type, id) {
    if ((await apiFetch(`/favorites/${type}/${id}`, { method: "DELETE" })).ok) moYeuThich();
}

function moDatCho(type, id, ten) {
    if (!localStorage.getItem("token")) return moAuth();
    const ho_ten = prompt(`Gửi yêu cầu đặt chỗ tại "${ten}"\n\nHọ và tên:`);
    if (!ho_ten) return;
    const phone = prompt("Số điện thoại:");
    if (!phone) return;
    apiFetch("/booking-requests", {
        method: "POST",
        body: JSON.stringify({
            place_type: type, place_id: id, full_name: ho_ten, phone,
            check_in: prompt("Ngày nhận (YYYY-MM-DD), bỏ trống nếu chưa rõ:") || null,
            check_out: prompt("Ngày trả (YYYY-MM-DD), bỏ trống nếu chưa rõ:") || null,
        }),
    }).then(async r => {
        const d = await r.json();
        alert(r.ok ? d.message : (d.detail || "Gửi yêu cầu thất bại."));
    });
}

/* ── Đăng nhập ───────────────────────────────────────────────────────────── */

let dangKy = false;

function moAuth() { document.getElementById("auth-modal").classList.remove("hidden"); }
function dongAuth() { document.getElementById("auth-modal").classList.add("hidden"); }

function doiCheDoAuth() {
    dangKy = !dangKy;
    document.getElementById("auth-title").innerText = dangKy ? "Đăng ký" : "Đăng nhập";
    document.getElementById("auth-name").classList.toggle("hidden", !dangKy);
    document.getElementById("auth-switch-text").innerText = dangKy ? "Đã có tài khoản?" : "Chưa có tài khoản?";
    document.getElementById("auth-switch-btn").innerText = dangKy ? "Đăng nhập" : "Đăng ký";
}

async function guiAuth() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-pass").value;
    if (!email || !password) return alert("Nhập email và mật khẩu.");

    if (dangKy) {
        const full_name = document.getElementById("auth-name").value.trim() || email;
        const r = await apiFetch("/auth/register", {
            method: "POST", body: JSON.stringify({ email, password, full_name }),
        });
        if (!r.ok) return alert((await r.json()).detail || "Đăng ký thất bại.");
    }
    const r = await apiFetch("/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return alert("Email hoặc mật khẩu không đúng.");
    const d = await r.json();
    localStorage.setItem("token", d.access_token);
    localStorage.setItem("user", JSON.stringify(d.user));
    dongAuth();
    veUserBox();
}

function veUserBox() {
    const box = document.getElementById("user-box");
    const u = JSON.parse(localStorage.getItem("user") || "null");
    box.innerHTML = u
        ? `<div class="flex items-center gap-2">
             ${u.role === "admin" ? `<a href="admin.html" class="text-sm text-slate-600 hover:text-brand-600"><i class="fa-solid fa-screwdriver-wrench"></i></a>` : ""}
             <span class="text-sm text-slate-600 hidden sm:inline">${u.full_name || u.email}</span>
             <button onclick="dangXuat()" class="text-sm text-slate-400 hover:text-red-500"><i class="fa-solid fa-right-from-bracket"></i></button>
           </div>`
        : `<button onclick="moAuth()" class="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Đăng nhập</button>`;
}

function dangXuat() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    veUserBox();
    veTrangChu();
}

document.addEventListener("DOMContentLoaded", () => {
    veUserBox();
    taiDiemDen();
});
