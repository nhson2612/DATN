"""Import POI du lich CA NUOC tu Overture Places vao gis_vietnam.

Vi sao Overture chu khong Overpass: Overpass khong kham noi pham vi ca nuoc —
da thu chia luoi 128 o va bi chan IP giua chung. Overture doc thang parquet
tren S3, khong rate-limit.

LOC THEO NHU CAU DU LICH, khong lay tat: Overture co 2,04 trieu POI o Viet Nam
thuoc 1.235 category, trong do rat nhieu thu vo nghia voi khach du lich
(professional_services 83k, real_estate_service 43k, beauty_salon 37k).
Dung san cay phan loai `taxonomy.hierarchy[1]` cua Overture — 14 nhom goc —
thay vi liet ke tay 1.235 dong.

KHONG loc theo confidence luc import: nhap het roi luu diem tin cay vao cot
`confidence`, de tang truy van tu quyet dinh nguong. Loc ngay o day la vut du
lieu khong lay lai duoc. Do tren ca nuoc: 27% ban ghi co confidence < 0,5.

Chay:  cd backend && ./venv/bin/python scripts/import_overture_vn.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import duckdb
import psycopg

from app.core.config import settings

RELEASE = "2026-08-19.0"
S3 = f"s3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*"
BBOX = (102.0, 8.0, 110.0, 24.0)          # Viet Nam

# 6 nhom nhu cau du lich, anh xa sang taxonomy goc cua Overture.
# BO: services_and_business, lifestyle_services, education, health_care,
#     community_and_government — khach du lich khong tra cuu van phong cong ty,
#     truong hoc, uy ban.
TOURIST_ROOTS = (
    "lodging",                  # 1. Cho o
    "food_and_drink",           # 2. An uong
    "cultural_and_historic",    # 3. Diem tham quan
    "geographic_entities",      #    ...bai bien, nui, thac
    "arts_and_entertainment",   # 4. Vui choi
    "sports_and_recreation",
    "travel_and_transportation",# 5. Di lai
    "shopping",                 # 6. Mua sam
)

# Category thuoc nhom "lodging" nhung phai vao bang accommodation.
ACC_ROOT = "lodging"
BATCH = 20000


def fetch():
    con = duckdb.connect()
    con.execute(
        "INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;"
        "SET s3_region='us-west-2';"
    )
    roots = ", ".join(f"'{r}'" for r in TOURIST_ROOTS)
    print(f"Doc Overture {RELEASE} — {len(TOURIST_ROOTS)} nhom du lich...")
    return con.execute(
        f"""
        SELECT id,
               names.primary                 AS name,
               taxonomy.hierarchy[1]         AS root,
               categories.primary            AS cat,
               categories.alternate          AS cat_alt,
               addresses[1].freeform         AS addr,
               addresses[1].locality         AS locality,
               addresses[1].postcode         AS postcode,
               phones[1]                     AS phone,
               websites[1]                   AS website,
               emails[1]                     AS email,
               socials[1]                    AS social,
               brand.names.primary           AS brand,
               confidence                    AS conf,
               ST_X(ST_Centroid(geometry))   AS lon,
               ST_Y(ST_Centroid(geometry))   AS lat
        FROM read_parquet('{S3}', hive_partitioning=1)
        WHERE bbox.xmin BETWEEN {BBOX[0]} AND {BBOX[2]}
          AND bbox.ymin BETWEEN {BBOX[1]} AND {BBOX[3]}
          -- BBOX chi de parquet cat bot file doc; no bao ca Thai Lan, Lao,
          -- Campuchia. Thieu dong nay thi nhap ve 412k dia diem Thai + 101k
          -- Campuchia + 26k Lao, tat ca deu khong gan duoc tinh va lam ban
          -- ket qua tim kiem tren ban do.
          AND addresses[1].country = 'VN'
          AND taxonomy.hierarchy[1] IN ({roots})
          AND names.primary IS NOT NULL
        """
    ).fetchall()


def to_tags(cat, cat_alt, root, addr, locality, postcode,
            phone, website, email, social, brand):
    """Khoa OSM de cung mot cau hoi khong doi key tuy DB dang tro vao dau.

    98,8% dia diem du lich VN trong Overture den tu Meta, nen `socials` gan nhu
    luon la mot page Facebook (do phu 98%). Voi quan an va ca phe o Viet Nam,
    day thuong la noi co anh, menu va gio mo cua — nhieu hon Google.
    """
    t = {"cuisine": cat, "category_root": root, "addr:street": addr,
         "addr:city": locality, "addr:postcode": postcode,
         "phone": phone, "website": website, "email": email,
         "social": social, "brand": brand}
    t = {k: v for k, v in t.items() if v}
    if cat_alt:
        t["category_alt"] = list(cat_alt)
    return t


def main():
    rows = fetch()
    print(f"Overture tra {len(rows):,} dia diem du lich.")

    poi, acc = [], []
    for (oid, name, root, cat, cat_alt, addr, loc, postcode,
         phone, web, email, social, brand, conf, lon, lat) in rows:
        if lon is None or lat is None:
            continue
        tags = json.dumps(
            to_tags(cat, cat_alt, root, addr, loc, postcode,
                    phone, web, email, social, brand),
            ensure_ascii=False)
        rec = (oid, name, cat, tags, conf, lon, lat)
        (acc if root == ACC_ROOT else poi).append(rec)
    print(f"  poi={len(poi):,}  accommodation={len(acc):,}")

    with psycopg.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            for table, data, col in (("poi", poi, "amenity"),
                                     ("accommodation", acc, "tourism")):
                cur.execute(f"CREATE TEMP TABLE stage_{table} ("
                            f"ov_id text, name text, cat text, tags jsonb,"
                            f"confidence real,"
                            f"lon double precision, lat double precision)")
                with cur.copy(f"COPY stage_{table} FROM STDIN") as cp:
                    for r in data:
                        cp.write_row(r)
                cur.execute(f"""
                    INSERT INTO {table} (ov_id, name, {col}, tags, confidence, geom)
                    SELECT ov_id, name, cat, tags, confidence,
                           ST_SetSRID(ST_MakePoint(lon, lat), 4326)
                    FROM stage_{table}
                    ON CONFLICT (ov_id) WHERE ov_id IS NOT NULL DO UPDATE
                    SET name = EXCLUDED.name, {col} = EXCLUDED.{col},
                        tags = EXCLUDED.tags,
                        confidence = EXCLUDED.confidence,
                        geom = EXCLUDED.geom
                """)
                print(f"  {table}: {cur.rowcount:,} dong")
            conn.commit()
    print("Xong.")


if __name__ == "__main__":
    main()
