/* Khám phá điểm đến — luồng chính của một website du lịch.
 *
 * Ba view trong cùng một tab: danh sách điểm đến -> địa điểm của điểm đến ->
 * chi tiết một địa điểm. Trước đây người dùng chỉ có bản đồ và ô hỏi đáp, tức
 * chỉ trả lời được "có gì gần đây" — không ai vào trang du lịch để hỏi vậy.
 */

let diemDenHienTai = null;

// Ảnh mặc định theo nhóm: Wikimedia chỉ phủ được địa điểm nổi tiếng, quán ăn
// nhỏ sẽ không có ảnh nào.
const ICON_NHOM = {
    tham_quan: "fa-landmark",
    an_uong: "fa-utensils",
    vui_choi: "fa-masks-theater",
    mua_sam: "fa-bag-shopping",
    luu_tru: "fa-bed",
};

function _hien(view) {
    ["explore-home", "explore-dest-view", "explore-detail"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === view) ? "block" : "none";
    });
}

/* ── View 1: danh sách điểm đến ─────────────────────────────────────────── */

async function taiDanhSachDiemDen() {
    const box = document.getElementById("dest-list");
    if (!box) return;
    box.innerHTML = `<p style="font-size:12px;color:var(--text-secondary)">Đang tải...</p>`;
    try {
        const res = await apiFetch("/destinations?limit=24");
        if (!res.ok) throw new Error("tải thất bại");
        const { destinations } = await res.json();
        box.innerHTML = destinations.map(d => `
            <div class="dest-card" onclick="moDiemDen('${d.slug}')">
                <div>
                    <div class="dest-card-name">${d.name}</div>
                    <div class="dest-card-meta">
                        ${d.so_dia_diem.toLocaleString("vi-VN")} địa điểm ·
                        ${d.so_luu_tru.toLocaleString("vi-VN")} nơi lưu trú
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `).join("");
    } catch (e) {
        console.error(e);
        box.innerHTML = `<p style="font-size:12px;color:#ef4444">Không tải được danh sách điểm đến.</p>`;
    }
}

function veTrangDiemDen() { _hien("explore-home"); }

/* ── View 2: một điểm đến ───────────────────────────────────────────────── */

async function moDiemDen(slug) {
    if (!slug) return;
    _hien("explore-dest-view");
    document.getElementById("dest-name").innerText = "Đang tải...";
    document.getElementById("dest-groups").innerHTML = "";
    try {
        const res = await apiFetch(`/destinations/${encodeURIComponent(slug)}`);
        if (!res.ok) {
            document.getElementById("dest-name").innerText = "Không tìm thấy điểm đến";
            document.getElementById("dest-meta").innerText =
                `Thử gõ tên tỉnh/thành, ví dụ "Đà Nẵng".`;
            return;
        }
        const d = await res.json();
        diemDenHienTai = d;

        document.getElementById("dest-name").innerText = d.name;
        const tong = d.groups.reduce((s, g) => s + g.items.length, 0);
        document.getElementById("dest-meta").innerText =
            `${tong} địa điểm nổi bật · ${d.groups.length} nhóm`;

        document.getElementById("dest-groups").innerHTML = d.groups.map(g => `
            <div class="dest-group">
                <h4><i class="fa-solid ${ICON_NHOM[g.key] || "fa-location-dot"}"></i> ${g.ten}</h4>
                ${g.items.map(p => _theDiaDiem(p)).join("")}
            </div>
        `).join("");

        // Đưa cả điểm đến lên bản đồ để người dùng thấy ngay nó nằm đâu.
        if (typeof map !== "undefined" && map && d.lon) {
            map.flyTo({ center: [d.lon, d.lat], zoom: 11 });
        }
        _veDiemLenBanDo(d.groups.flatMap(g => g.items));
    } catch (e) {
        console.error(e);
    }
}

function _theDiaDiem(p) {
    const anh = p.anh
        ? `<img src="${p.anh}" alt="" loading="lazy" class="place-thumb">`
        : `<div class="place-thumb place-thumb-empty"><i class="fa-solid fa-image"></i></div>`;
    return `
        <div class="place-card" onclick="moChiTiet('${p.type}', ${p.id})">
            ${anh}
            <div class="place-card-body">
                <div class="place-card-name">${p.name}</div>
                <div class="place-card-meta">${p.category || ""}</div>
            </div>
        </div>`;
}

/* ── View 3: chi tiết địa điểm ──────────────────────────────────────────── */

function quayLaiDiemDen() {
    _hien(diemDenHienTai ? "explore-dest-view" : "explore-home");
}

async function moChiTiet(type, id) {
    _hien("explore-detail");
    const box = document.getElementById("detail-body");
    box.innerHTML = `<p style="font-size:12px;color:var(--text-secondary)">Đang tải...</p>`;
    try {
        const res = await apiFetch(`/places/${type}/${id}`);
        if (!res.ok) { box.innerHTML = `<p>Không tìm thấy địa điểm.</p>`; return; }
        const p = (await res.json()).place;

        const dong = [];
        if (p.dia_chi) dong.push([`fa-location-dot`, p.dia_chi]);
        if (p.dien_thoai) dong.push([`fa-phone`, `<a href="tel:${p.dien_thoai}">${p.dien_thoai}</a>`]);
        if (p.stars) dong.push([`fa-star`, `${p.stars} sao`]);
        if (p.price_range) dong.push([`fa-tag`, p.price_range]);

        box.innerHTML = `
            ${p.anh ? `<img src="${p.anh}" class="detail-photo" alt="">
                       <div class="detail-credit">Ảnh: ${p.anh_nguon || "Wikimedia"}</div>` : ""}
            <h3 style="font-size:16px;margin:8px 0 4px">${p.name}</h3>
            <div class="detail-cat">${p.category || ""}</div>
            ${p.description ? `<p class="detail-desc">${p.description}</p>` : ""}
            <div class="detail-info">
                ${dong.map(([ic, t]) => `<div><i class="fa-solid ${ic}"></i> ${t}</div>`).join("")}
            </div>
            <div class="detail-actions">
                <button class="route-btn" onclick="luuYeuThich('${p.type}', ${p.id}, this)">
                    <i class="fa-regular fa-heart"></i> Lưu yêu thích
                </button>
                <button class="route-btn" style="background:#0ea5e9"
                        onclick="moFormDatCho('${p.type}', ${p.id}, ${JSON.stringify(p.name).replace(/"/g, "&quot;")})">
                    <i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu đặt chỗ
                </button>
                ${p.website ? `<a class="route-btn" style="background:transparent;color:var(--accent-glow);border:1px solid var(--border-color);text-decoration:none;display:block;text-align:center"
                       href="${p.website}" target="_blank" rel="noopener">
                       <i class="fa-solid fa-arrow-up-right-from-square"></i> Trang chính thức</a>` : ""}
            </div>
            ${p.nearby && p.nearby.length ? `
                <div class="dest-group" style="margin-top:16px">
                    <h4><i class="fa-solid fa-location-crosshairs"></i> Gần đây</h4>
                    ${p.nearby.map(n => `
                        <div class="place-card" onclick="moChiTiet('poi', ${n.id})">
                            <div class="place-thumb place-thumb-empty"><i class="fa-solid fa-location-dot"></i></div>
                            <div class="place-card-body">
                                <div class="place-card-name">${n.name}</div>
                                <div class="place-card-meta">cách ${n.met} m</div>
                            </div>
                        </div>`).join("")}
                </div>` : ""}
        `;

        if (typeof map !== "undefined" && map) {
            map.flyTo({ center: [p.lon, p.lat], zoom: 16 });
        }
        _veDiemLenBanDo([p]);
    } catch (e) {
        console.error(e);
        box.innerHTML = `<p style="font-size:12px;color:#ef4444">Lỗi tải chi tiết địa điểm.</p>`;
    }
}

/* ── Yêu thích ──────────────────────────────────────────────────────────── */

async function luuYeuThich(type, id, btn) {
    if (!localStorage.getItem("token")) {
        alert("Bạn cần đăng nhập để lưu địa điểm yêu thích.");
        return;
    }
    try {
        const res = await apiFetch("/favorites", {
            method: "POST",
            body: JSON.stringify({ place_type: type, place_id: id }),
        });
        if (res.ok) {
            const d = await res.json();
            btn.innerHTML = `<i class="fa-solid fa-heart"></i> ${d.da_co ? "Đã có trong yêu thích" : "Đã lưu"}`;
            btn.disabled = true;
        }
    } catch (e) { console.error(e); }
}

async function taiYeuThich() {
    const box = document.getElementById("fav-list");
    if (!box) return;
    if (!localStorage.getItem("token")) {
        box.innerHTML = `<p style="font-size:12px;color:var(--text-secondary)">Hãy đăng nhập để xem danh sách yêu thích.</p>`;
        return;
    }
    try {
        const res = await apiFetch("/favorites");
        if (!res.ok) return;
        const { favorites } = await res.json();
        if (!favorites.length) {
            box.innerHTML = `<p style="font-size:12px;color:var(--text-secondary)">Chưa có địa điểm nào. Vào tab Khám phá để lưu.</p>`;
            return;
        }
        box.innerHTML = favorites.map(f => `
            <div class="place-card">
                <div class="place-thumb place-thumb-empty"><i class="fa-solid fa-heart"></i></div>
                <div class="place-card-body" onclick="moChiTiet('${f.place_type}', ${f.place_id})">
                    <div class="place-card-name">${f.name}</div>
                    <div class="place-card-meta">${f.category || ""}</div>
                </div>
                <button class="fav-remove" onclick="boYeuThich('${f.place_type}', ${f.place_id})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`).join("");
        _veDiemLenBanDo(favorites.map(f => ({ ...f, type: f.place_type })));
    } catch (e) { console.error(e); }
}

async function boYeuThich(type, id) {
    try {
        const res = await apiFetch(`/favorites/${type}/${id}`, { method: "DELETE" });
        if (res.ok) taiYeuThich();
    } catch (e) { console.error(e); }
}

/* ── Yêu cầu đặt chỗ ────────────────────────────────────────────────────── */

function moFormDatCho(type, id, ten) {
    if (!localStorage.getItem("token")) {
        alert("Bạn cần đăng nhập để gửi yêu cầu đặt chỗ.");
        return;
    }
    const ho_ten = prompt(`Gửi yêu cầu đặt chỗ tại "${ten}"\n\nHọ và tên của bạn:`);
    if (!ho_ten) return;
    const dien_thoai = prompt("Số điện thoại liên hệ:");
    if (!dien_thoai) return;
    const nhan = prompt("Ngày nhận phòng (YYYY-MM-DD), bỏ trống nếu chưa rõ:") || null;
    const tra = prompt("Ngày trả phòng (YYYY-MM-DD), bỏ trống nếu chưa rõ:") || null;

    apiFetch("/booking-requests", {
        method: "POST",
        body: JSON.stringify({
            place_type: type, place_id: id, full_name: ho_ten,
            phone: dien_thoai, check_in: nhan, check_out: tra,
        }),
    }).then(async res => {
        const d = await res.json();
        alert(res.ok ? d.message : (d.detail || "Gửi yêu cầu thất bại."));
    }).catch(e => console.error(e));
}

/* ── Vẽ lên bản đồ ──────────────────────────────────────────────────────── */

function _veDiemLenBanDo(items) {
    if (typeof clearQueryLayersAndMarkers !== "function") return;
    clearQueryLayersAndMarkers();
    const hop_le = items.filter(p => p.lon && p.lat);
    if (!hop_le.length) return;
    // Dùng lại đúng đường vẽ của tab hỏi đáp để không sinh thêm layer song song.
    if (typeof renderQueryResultsOnMap === "function") {
        renderQueryResultsOnMap(hop_le.map(p => ({
            name: p.name,
            geom: { type: "Point", coordinates: [p.lon, p.lat] },
        })));
    }
}
