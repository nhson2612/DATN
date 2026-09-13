/**
 * Từ điển ánh xạ ảnh danh lam thắng cảnh Wikimedia Commons cho 63 tỉnh thành Việt Nam
 * Phục vụ màn hình Chuyến đi (Wanderlog Trips - rhr.png)
 */

export const PROVINCE_WIKIMEDIA_IMAGES = {
  "ha-noi": "/assets/images/provinces/ha-noi.jpg",
  "ho-chi-minh": "/assets/images/provinces/ho-chi-minh.jpg",
  "da-nang": "/assets/images/provinces/da-nang.jpg",
  "quang-ninh": "/assets/images/provinces/quang-ninh.jpg",
  "khanh-hoa": "/assets/images/provinces/khanh-hoa.jpg",
  "lam-dong": "/assets/images/provinces/lam-dong.jpg",
  "thua-thien-hue": "/assets/images/provinces/thua-thien-hue.jpg",
  "hue": "/assets/images/provinces/hue.jpg",
  "kien-giang": "/assets/images/provinces/kien-giang.jpg",
  "lao-cai": "/assets/images/provinces/lao-cai.jpg",
  "ninh-binh": "/assets/images/provinces/ninh-binh.jpg",
  "hai-phong": "/assets/images/provinces/hai-phong.jpg",
  "ba-ria-vung-tau": "/assets/images/provinces/ba-ria-vung-tau.jpg",
  "quang-binh": "/assets/images/provinces/quang-binh.jpg",
  "quang-nam": "/assets/images/provinces/quang-nam.jpg",
  "can-tho": "/assets/images/provinces/can-tho.jpg",
  "binh-thuan": "/assets/images/provinces/binh-thuan.jpg",
  "binh-dinh": "/assets/images/provinces/binh-dinh.jpg",
  "phu-yen": "/assets/images/provinces/phu-yen.jpg",
  "ha-giang": "/assets/images/provinces/ha-giang.jpg",
  "cao-bang": "/assets/images/provinces/cao-bang.jpg",
  "yen-bai": "/assets/images/provinces/yen-bai.jpg",
  "an-giang": "/assets/images/provinces/an-giang.jpg",
  "tay-ninh": "/assets/images/provinces/tay-ninh.jpg",
  "dak-lak": "/assets/images/provinces/dak-lak.jpg",
  "gia-lai": "/assets/images/provinces/gia-lai.jpg",
  "kon-tum": "/assets/images/provinces/kon-tum.jpg",
  "dak-nong": "/assets/images/provinces/dak-nong.jpg",
  "dong-nai": "/assets/images/provinces/dong-nai.jpg",
  "binh-duong": "/assets/images/provinces/binh-duong.jpg",
  "binh-phuoc": "/assets/images/provinces/binh-phuoc.jpg",
  "long-an": "/assets/images/provinces/long-an.jpg",
  "tien-giang": "/assets/images/provinces/tien-giang.jpg",
  "ben-tre": "/assets/images/provinces/ben-tre.jpg",
  "dong-thap": "/assets/images/provinces/dong-thap.jpg",
  "vinh-long": "/assets/images/provinces/vinh-long.jpg",
  "tra-vinh": "/assets/images/provinces/tra-vinh.jpg",
  "hau-giang": "/assets/images/provinces/hau-giang.jpg",
  "soc-trang": "/assets/images/provinces/soc-trang.jpg",
  "bac-lieu": "/assets/images/provinces/bac-lieu.jpg",
  "ca-mau": "/assets/images/provinces/ca-mau.jpg",
  "nghe-an": "/assets/images/provinces/nghe-an.jpg",
  "ha-tinh": "/assets/images/provinces/ha-tinh.jpg",
  "quang-tri": "/assets/images/provinces/quang-tri.jpg",
  "quang-ngai": "/assets/images/provinces/quang-ngai.jpg",
  "ninh-thuan": "/assets/images/provinces/ninh-thuan.jpg",
  "thanh-hoa": "/assets/images/provinces/thanh-hoa.jpg",
  "son-la": "/assets/images/provinces/son-la.jpg",
  "dien-bien": "/assets/images/provinces/dien-bien.jpg",
  "lai-chau": "/assets/images/provinces/lai-chau.jpg",
  "hoa-binh": "/assets/images/provinces/hoa-binh.jpg",
  "thai-nguyen": "/assets/images/provinces/thai-nguyen.jpg",
  "lang-son": "/assets/images/provinces/lang-son.jpg",
  "bac-giang": "/assets/images/provinces/bac-giang.jpg",
  "bac-kan": "/assets/images/provinces/bac-kan.jpg",
  "tuyen-quang": "/assets/images/provinces/tuyen-quang.jpg",
  "phu-tho": "/assets/images/provinces/phu-tho.jpg",
  "vinh-phuc": "/assets/images/provinces/vinh-phuc.jpg",
  "bac-ninh": "/assets/images/provinces/bac-ninh.jpg",
  "hai-duong": "/assets/images/provinces/hai-duong.jpg",
  "hung-yen": "/assets/images/provinces/hung-yen.jpg",
  "ha-nam": "/assets/images/provinces/ha-nam.jpg",
  "nam-dinh": "/assets/images/provinces/nam-dinh.jpg",
  "thai-binh": "/assets/images/provinces/thai-binh.jpg",
};

// Ảnh mặc định du lịch Việt Nam chất lượng cao lưu cục bộ
export const DEFAULT_TRIP_IMAGE = "/assets/images/provinces/ha-noi.jpg";

function normStr(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(thanh pho|tinh|du lich|chuyen di|trip to|kham pha)\s+/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Lấy ảnh đại diện mặc định của tỉnh thành từ Wikimedia Commons
 */
export function getProvinceImage(destination, tripName) {
  const destSlug = normStr(destination);
  const nameSlug = normStr(tripName);

  // 1. Khớp chính xác theo destination slug
  if (destSlug && PROVINCE_WIKIMEDIA_IMAGES[destSlug]) {
    return PROVINCE_WIKIMEDIA_IMAGES[destSlug];
  }

  // 2. Tìm một phần trong destination
  for (const [key, url] of Object.entries(PROVINCE_WIKIMEDIA_IMAGES)) {
    if (destSlug.includes(key) || key.includes(destSlug)) {
      return url;
    }
  }

  // 3. Khớp theo trip name slug
  if (nameSlug) {
    if (PROVINCE_WIKIMEDIA_IMAGES[nameSlug]) {
      return PROVINCE_WIKIMEDIA_IMAGES[nameSlug];
    }
    for (const [key, url] of Object.entries(PROVINCE_WIKIMEDIA_IMAGES)) {
      if (nameSlug.includes(key)) {
        return url;
      }
    }
  }

  // Các điểm đến du lịch phổ biến khác
  if (nameSlug.includes("sa-pa") || nameSlug.includes("sapa") || destSlug.includes("sapa")) {
    return PROVINCE_WIKIMEDIA_IMAGES["lao-cai"];
  }
  if (nameSlug.includes("ha-long") || nameSlug.includes("halong") || destSlug.includes("halong")) {
    return PROVINCE_WIKIMEDIA_IMAGES["quang-ninh"];
  }
  if (nameSlug.includes("phu-quoc") || nameSlug.includes("phuquoc") || destSlug.includes("phuquoc")) {
    return PROVINCE_WIKIMEDIA_IMAGES["kien-giang"];
  }
  if (nameSlug.includes("da-lat") || nameSlug.includes("dalat") || destSlug.includes("dalat")) {
    return PROVINCE_WIKIMEDIA_IMAGES["lam-dong"];
  }
  if (nameSlug.includes("hoi-an") || nameSlug.includes("hoian") || destSlug.includes("hoian")) {
    return PROVINCE_WIKIMEDIA_IMAGES["quang-nam"];
  }
  if (nameSlug.includes("nha-trang") || nameSlug.includes("nhatrang") || destSlug.includes("nhatrang")) {
    return PROVINCE_WIKIMEDIA_IMAGES["khanh-hoa"];
  }
  if (nameSlug.includes("vung-tau") || nameSlug.includes("vungtau") || destSlug.includes("vungtau")) {
    return PROVINCE_WIKIMEDIA_IMAGES["ba-ria-vung-tau"];
  }
  if (nameSlug.includes("sai-gon") || nameSlug.includes("saigon")) {
    return PROVINCE_WIKIMEDIA_IMAGES["ho-chi-minh"];
  }
  if (nameSlug.includes("ha-noi") || nameSlug.includes("hanoi")) {
    return PROVINCE_WIKIMEDIA_IMAGES["ha-noi"];
  }
  if (nameSlug.includes("hong-kong") || nameSlug.includes("hongkong")) {
    return DEFAULT_TRIP_IMAGE;
  }

  return DEFAULT_TRIP_IMAGE;
}
