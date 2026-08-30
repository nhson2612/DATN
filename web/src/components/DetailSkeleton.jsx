/* Khung xương trang chi tiết: cột trái ảnh + chữ, cột phải khối hành động. */
export default function DetailSkeleton() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="skeleton h-64 rounded-card" />
          <div className="skeleton h-7 rounded w-2/3" />
          <div className="skeleton h-4 rounded w-1/4" />
          <div className="space-y-2 pt-2">
            <div className="skeleton h-3.5 rounded" />
            <div className="skeleton h-3.5 rounded w-11/12" />
            <div className="skeleton h-3.5 rounded w-3/4" />
          </div>
        </div>
        <div className="skeleton h-56 rounded-card" />
      </div>
    </main>
  );
}
