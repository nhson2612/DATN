"""Vật hoá kết quả pgr_connectedComponents ra bảng roads_components.

main.py trước đây gọi pgr_connectedComponents ngay trong câu truy vấn tìm đỉnh
snap, tức 2 lần mỗi request /api/route. Hàm đó là O(V+E) trên TOÀN graph: đo
được 51ms ở 6.341 vertex — tuyến tính, nên ở quy mô lớn là hàng chục giây cho
mỗi lần bấm chỉ đường.

PHẢI chạy lại sau mỗi lần bảng `roads` thay đổi, đặc biệt sau
node_and_rebuild_topology.py (nó tạo lại `roads` từ đầu nên id đỉnh đổi hết).
"""

import os
import sys
import time

import psycopg

# Doc DATABASE_URL truoc, chi fallback ve gis_tourism khi khong co. Truoc day
# chuoi ket noi bi hardcode nen chay voi DATABASE_URL=... tro tro DB khac van
# am tham refresh gis_tourism -> bang roads_components cua DB kia bi bo cu.
DB_CONN = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/gis_tourism"
)

EDGE_SQL = "SELECT id, source, target, cost, reverse_cost FROM roads"


def refresh():
    t0 = time.time()
    print(f"DB: {DB_CONN.rsplit('/', 1)[-1]}")
    try:
        with psycopg.connect(DB_CONN) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS roads_components (
                        node      BIGINT PRIMARY KEY,
                        component BIGINT NOT NULL,
                        comp_size INT    NOT NULL
                    );
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS roads_components_size_idx
                        ON roads_components (comp_size);
                """)
                conn.commit()

                print("Đang tính connected components trên toàn mạng đường...")
                cur.execute("TRUNCATE roads_components;")
                cur.execute(f"""
                    INSERT INTO roads_components (node, component, comp_size)
                    SELECT node, component,
                           count(*) OVER (PARTITION BY component)
                    FROM pgr_connectedComponents('{EDGE_SQL}');
                """)
                inserted = cur.rowcount
                conn.commit()
                cur.execute("ANALYZE roads_components;")
                conn.commit()

                cur.execute("""
                    SELECT count(DISTINCT component), max(comp_size),
                           count(*) FILTER (WHERE comp_size > 100)
                    FROM roads_components;
                """)
                ncomp, biggest, usable = cur.fetchone()
                print(f"Đã ghi {inserted} đỉnh trong {time.time() - t0:.1f}s")
                print(f"  số component      : {ncomp}")
                print(f"  component lớn nhất: {biggest}")
                print(f"  đỉnh dùng được    : {usable} (comp_size > 100)")
    except Exception as e:
        print(f"Lỗi khi làm mới roads_components: {e}")
        sys.exit(1)


if __name__ == "__main__":
    refresh()
