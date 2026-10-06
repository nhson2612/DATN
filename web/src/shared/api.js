/* Gọi backend FastAPI. Không hardcode host: dev chạy Vite ở 5173 còn API ở 8000,
 * khi triển khai chung origin thì tự dùng origin đó. */

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  ((["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.hostname.endsWith(".local")) && window.location.port !== "8000"
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : `${window.location.origin}/api`);

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Ném lỗi kèm thông điệp của backend để component hiện đúng nguyên nhân,
    // thay vì báo chung chung "có lỗi xảy ra".
    // FastAPI trả lỗi kiểm tra dữ liệu dạng mảng; đọc ra chuỗi để hiện được,
    // nếu không nguyên nhân sẽ hiện thành "[object Object]".
    const chiTiet = data.detail;
    const err = new Error(
      Array.isArray(chiTiet)
        ? chiTiet
            .map((e) => `${(e.loc || []).slice(1).join(".") || "dữ liệu"}: ${e.msg}`)
            .join("; ")
        : chiTiet || `Lỗi ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function download(path, filename) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Lỗi ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

async function upload(path, body) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Lỗi ${res.status}`);
  return data;
}

export const api = {
  // Điểm đến
  destinations: (limit = 24) => request(`/destinations?limit=${limit}`),
  destination: (slug) => request(`/destinations/${encodeURIComponent(slug)}`),

  // Địa điểm
  searchPlaces: (params, options = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/places/search?${qs}`, options);
  },
  place: (type, id) => request(`/places/${type}/${id}`),
  nearbyPlaces: (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/places/nearby?${qs}`);
  },
  cachePlaceDetails: (body) =>
    request("/places/cache-details", { method: "POST", body: JSON.stringify(body) }),
  // Làm giàu (Serper, cache-first): 200 kết quả/cache, 202 đang fetch, 503 chưa sẵn sàng.
  enrichPlace: (type, id) =>
    request(`/places/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}/enrichment`, {
      method: "POST",
    }),

  // Tour trọn gói
  tours: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/tours?${qs}`);
  },
  tourProvinces: (all = false) => request(`/tours/provinces${all ? "?all=true" : ""}`),
  tour: (slug) => request(`/tours/${encodeURIComponent(slug)}`),
  bookTour: (body) => request("/tours/book", { method: "POST", body: JSON.stringify(body) }),
  myTourBookings: (limit = 100) => request(`/tours/bookings/me?limit=${limit}`),
  cancelMyTourBooking: (bookingId, reason = "") => request(`/tours/bookings/${bookingId}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  payTourBooking: (bookingId, body = {}) =>
    request(`/tours/bookings/${bookingId}/pay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  checkoutTourBooking: (bookingId, redirectBase = "") =>
    request(`/tours/bookings/${bookingId}/checkout`, {
      method: "POST",
      body: JSON.stringify({ redirect_base: redirectBase }),
    }),
  tourBookingStatus: (bookingId) =>
    request(`/tours/bookings/${bookingId}/status`),

  supportConversations: () => request("/support/conversations/me"),
  createSupportConversation: (body) => request("/support/conversations", { method: "POST", body: JSON.stringify(body) }),
  supportMessages: (id) => request(`/support/conversations/${id}/messages`),
  sendSupportMessage: (id, body) => request(`/support/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(body) }),
  supportInbox: (status = "") => request(`/support/inbox${status ? `?status=${status}` : ""}`),
  updateSupportConversation: (id, body) => request(`/support/conversations/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  takeOverSupportConversation: (id) => request(`/support/conversations/${id}/take-over`, { method: "POST" }),
  supportAiDraft: (id) => request(`/support/conversations/${id}/ai-draft`, { method: "POST" }),

  // Yêu thích
  favorites: () => request("/favorites"),
  addFavorite: (place_type, place_id) =>
    request("/favorites", { method: "POST", body: JSON.stringify({ place_type, place_id }) }),
  removeFavorite: (type, id) => request(`/favorites/${type}/${id}`, { method: "DELETE" }),

  // Chuyến đi tự lên lịch
  recommend: (body) =>
    request("/itineraries/recommend", { method: "POST", body: JSON.stringify(body) }),
  itineraries: () => request("/itineraries"),
  saveItinerary: (body) =>
    request("/itineraries", { method: "POST", body: JSON.stringify(body) }),
  updateItinerary: (id, body) =>
    request(`/itineraries/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteItinerary: (id) => request(`/itineraries/${id}`, { method: "DELETE" }),
  optimizeItinerary: (id, day) =>
    request(`/itineraries/${id}/optimize${day ? `?day=${day}` : ""}`, { method: "POST" }),

  // Trợ lý
  chat: (body) => request("/chat", { method: "POST", body: JSON.stringify(body) }),
  route: (body, options = {}) =>
    request("/route", { method: "POST", body: JSON.stringify(body), ...options }),

  // Quản trị
  adminStats: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value != null && value !== "")
    );
    return request(`/admin/stats${qs.size ? `?${qs}` : ""}`);
  },
  adminTourBookings: () => request("/tours/admin/bookings"),
  adminPayments: (status) =>
    request(`/tours/admin/payments${status ? `?status=${status}` : ""}`),
  adminConfirmPayment: (id, note) =>
    request(`/tours/admin/payments/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }),

  // Nhà điều hành tour
  operatorTours: (params = {}) => request(`/operator/tours?${new URLSearchParams(params)}`),
  operatorTour: (id) => request(`/operator/tours/${id}`),
  createOperatorTour: (body) => request("/operator/tours", { method: "POST", body: JSON.stringify(body) }),
  updateOperatorTour: (id, body) => request(`/operator/tours/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  uploadOperatorTourMedia: (data_url) => upload("/operator/tours/media", { data_url }),
  operatorDepartures: (tourId) => request(`/operator/tours/${tourId}/departures?page_size=100`),
  createOperatorDeparture: (tourId, body) => request(`/operator/tours/${tourId}/departures`, { method: "POST", body: JSON.stringify(body) }),
  updateOperatorDeparture: (id, body) => request(`/operator/departures/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setOperatorSale: (id, body) => request(`/operator/departures/${id}/sale`, { method: "PUT", body: JSON.stringify(body) }),
  removeOperatorSale: (id) => request(`/operator/departures/${id}/sale`, { method: "DELETE" }),
  operatorBookings: (params = {}) => request(`/operator/bookings?${new URLSearchParams(params)}`),
  confirmOperatorBooking: (id) => request(`/operator/bookings/${id}/confirm`, { method: "POST" }),
  setOperatorBookingOperationalStatus: (id, status) => request(`/operator/bookings/${id}/operational-status`, { method: "POST", body: JSON.stringify({ status }) }),
  operatorGuests: (id) => request(`/operator/departures/${id}/guests`),
  downloadOperatorGuests: (id) => download(`/operator/departures/${id}/guests.csv`, `khach-dot-${id}.csv`),
  cancelOperatorDeparture: (id, reason) => request(`/operator/departures/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  operatorRevenue: () => request("/operator/departures/revenue/summary"),
  operatorSubmitTour: (id) => request(`/operator/tours/${id}/submit`, { method: "POST" }),
  adminToursChoDuyet: () => request("/admin/tours/pending"),
  adminDuyetTour: (id) => request(`/admin/tours/${id}/approve`, { method: "POST" }),
  adminTuChoiTour: (id, reason) =>
    request(`/admin/tours/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  createPlace: (type, body) =>
    request(`/${type}`, { method: "POST", body: JSON.stringify(body) }),
  updatePlace: (type, id, body) =>
    request(`/${type}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePlace: (type, id) => request(`/${type}/${id}`, { method: "DELETE" }),

  // Tài khoản
  login: (email, password) => {
    const payload = typeof email === "object" ? email : { email, password };
    return request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
  },
  register: (email, password, full_name) => {
    const payload = typeof email === "object" ? email : { email, password, full_name };
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
