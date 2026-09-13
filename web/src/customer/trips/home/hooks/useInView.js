import { useEffect, useRef, useState } from "react";

/**
 * Theo dõi một section trong luồng scroll-snap toàn trang.
 * Trả về [ref, isInView] — isInView bật/tắt mỗi lần section vào/rời viewport
 * để animation chạy lại ở mỗi lượt cuộn.
 */
export default function useInView({ threshold = 0.55, once = false } = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, isInView];
}
