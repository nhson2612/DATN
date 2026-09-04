/* Tên và icon cho mã loại địa điểm của Overture Maps.
 * Dùng chung giữa danh sách lịch trình và thẻ thông tin trên bản đồ — trước đây
 * mỗi nơi tự xử lý nên cùng một quán hiện 'Nhà hàng Việt' ở cột trái mà
 * 'Vietnamese Restaurant' trên bản đồ. */

/* Bảng dịch. Dịch các mã phổ biến, còn lại bỏ gạch dưới
 * và viết hoa chữ đầu. Đây là trường duy nhất 100% địa điểm đều có. */
export const TEN_LOAI = {
  restaurant: "Nhà hàng", coffee_shop: "Quán cà phê", cafe: "Quán cà phê",
  shopping: "Mua sắm", flowers_and_gifts_shop: "Cửa hàng hoa và quà",
  clothing_store: "Cửa hàng quần áo", furniture_store: "Cửa hàng nội thất",
  grocery_store: "Cửa hàng tạp hoá", diner: "Quán ăn",
  mobile_phone_store: "Cửa hàng điện thoại", car_dealer: "Đại lý ô tô",
  bakery: "Tiệm bánh", landmark_and_historical_building: "Di tích lịch sử",
  vietnamese_restaurant: "Nhà hàng Việt", electronics: "Điện tử",
  fashion: "Thời trang", cosmetic_and_beauty_supplies: "Mỹ phẩm",
  travel_services: "Dịch vụ du lịch", pharmacy: "Nhà thuốc",
  bubble_tea: "Trà sữa", womens_clothing_store: "Thời trang nữ",
  shoe_store: "Cửa hàng giày", buddhist_temple: "Chùa",
  fashion_accessories_store: "Phụ kiện thời trang", automotive_repair: "Sửa chữa ô tô",
  arts_and_entertainment: "Nghệ thuật và giải trí", seafood_restaurant: "Nhà hàng hải sản",
  convenience_store: "Cửa hàng tiện lợi", fast_food_restaurant: "Đồ ăn nhanh",
  gym: "Phòng gym", home_goods_store: "Đồ gia dụng", tours: "Tour du lịch",
  hotel: "Khách sạn", accommodation: "Nơi lưu trú", resort: "Resort",
  holiday_rental_home: "Nhà nghỉ dưỡng", lodge: "Nhà nghỉ", hostel: "Hostel",
  service_apartments: "Căn hộ dịch vụ", campground: "Khu cắm trại",
  cottage: "Nhà gỗ", motel: "Nhà nghỉ ven đường",
  religious_organization: "Cơ sở tôn giáo", church_cathedral: "Nhà thờ",
  monument: "Tượng đài", cultural_center: "Trung tâm văn hoá",
  museum: "Bảo tàng", park: "Công viên", zoo: "Vườn thú",
  stadium_arena: "Sân vận động", art_gallery: "Phòng tranh",
  historical_landmark: "Di tích", beach: "Bãi biển", lake: "Hồ",
};

/* Không có ảnh thật cho từng địa điểm: bảng place_photos gần như rỗng và
 * photo_service trả về đúng MỘT ảnh stock cho mọi thứ. Hiện ảnh đó lên thì mọi
 * thẻ giống hệt nhau và ngụ ý sai rằng đó là ảnh của địa điểm. Dùng icon theo
 * loại: thật thà hơn và vẫn phân biệt được. */
export const ICON_LOAI = {
  religious_organization: "fa-place-of-worship", church_cathedral: "fa-church",
  buddhist_temple: "fa-place-of-worship", monument: "fa-monument",
  museum: "fa-landmark", art_gallery: "fa-palette", cultural_center: "fa-masks-theater",
  park: "fa-tree", beach: "fa-umbrella-beach", lake: "fa-water",
  landmark_and_historical_building: "fa-landmark-dome", historical_landmark: "fa-landmark-dome",
  restaurant: "fa-utensils", vietnamese_restaurant: "fa-bowl-food",
  seafood_restaurant: "fa-fish", fast_food_restaurant: "fa-burger",
  coffee_shop: "fa-mug-saucer", cafe: "fa-mug-saucer", bubble_tea: "fa-glass-water",
  bakery: "fa-bread-slice", shopping: "fa-bag-shopping", tours: "fa-route",
  gym: "fa-dumbbell", stadium_arena: "fa-futbol", zoo: "fa-paw",
  hotel: "fa-hotel", resort: "fa-umbrella-beach", hostel: "fa-bed",
};

export const iconLoai = (c) => ICON_LOAI[c] || "fa-location-dot";

export function tenLoai(c) {
  if (!c) return "";
  if (TEN_LOAI[c]) return TEN_LOAI[c];
  const t = String(c).replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
