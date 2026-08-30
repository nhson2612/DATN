/* Khung xương lúc tải, dựng theo đúng hình dạng thẻ thật.
 *
 * Thay cho dòng chữ "Đang tải..." trước đây: người dùng thấy ngay bố cục sắp
 * hiện ra, và trang không nhảy khi dữ liệu về. */
export default function CardSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ui-card overflow-hidden">
          <div className="skeleton card-img" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-3.5 rounded w-4/5" />
            <div className="skeleton h-3 rounded w-2/5" />
          </div>
        </div>
      ))}
    </>
  );
}
