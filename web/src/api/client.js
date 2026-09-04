/* Gọi backend FastAPI. Không hardcode host: dev chạy Vite ở 5173 còn API ở 8000,
 * khi triển khai chung origin thì tự dùng origin đó. */

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (["5173", "4173", "3000"].includes(window.location.port)
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
    throw new Error(data.detail || `Lỗi ${res.status}`);
  }
  return data;
}

export const api = {
  // Điểm đến
  destinations: (limit = 24) => request(`/destinations?limit=${limit}`),
  destination: (slug) => request(`/destinations/${encodeURIComponent(slug)}`),

  // Địa điểm
  searchPlaces: (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/places/search?${qs}`);
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
  // Làm giàu (Tavily, cache-first): 200 kết quả/cache, 202 đang fetch, 503 chưa sẵn sàng.
  enrichPlace: (type, id) =>
    request(`/places/${encodeURIComponent(type)}/${Number(id)}/enrichment`, {
      method: "POST",
    }),

  // Tour trọn gói
  tours: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    return request(`/tours?${qs}`);
  },
  tour: (slug) => request(`/tours/${encodeURIComponent(slug)}`),
  bookTour: (body) => request("/tours/book", { method: "POST", body: JSON.stringify(body) }),

  // Yêu thích
  favorites: () => request("/favorites"),
  addFavorite: (place_type, place_id) =>
    request("/favorites", { method: "POST", body: JSON.stringify({ place_type, place_id }) }),
  removeFavorite: (type, id) => request(`/favorites/${type}/${id}`, { method: "DELETE" }),

  // Đặt chỗ
  createBooking: (body) =>
    request("/booking-requests", { method: "POST", body: JSON.stringify(body) }),

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
  route: (body) => request("/route", { method: "POST", body: JSON.stringify(body) }),

  // Quản trị
  adminStats: () => request("/admin/stats"),
  adminBookings: (status) =>
    request(`/booking-requests${status ? `?status=${status}` : ""}`),
  adminSetBookingStatus: (id, status) =>
    request(`/booking-requests/${id}?status=${status}`, { method: "PUT" }),
  adminTourBookings: () => request("/tours/admin/bookings"),
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
