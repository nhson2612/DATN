import psycopg
import sys
import time

DB_CONN = "postgresql://postgres:postgres@localhost:5432/gis_tourism"

def rebuild():
    print("Connecting to PostgreSQL...")
    try:
        with psycopg.connect(DB_CONN) as conn:
            with conn.cursor() as cur:
                # 1. Clean up old tables if they exist
                print("Cleaning up temporary tables...")
                cur.execute("DROP TABLE IF EXISTS roads_raw CASCADE;")
                cur.execute("DROP TABLE IF EXISTS roads_raw_noded CASCADE;")
                cur.execute("DROP TABLE IF EXISTS roads_noded CASCADE;")
                conn.commit()

                # 2. Rename current roads to roads_raw
                print("Renaming 'roads' to 'roads_raw'...")
                cur.execute("ALTER TABLE roads RENAME TO roads_raw;")
                # Drop original indexes/constraints from roads_raw if necessary, but renaming is fine
                cur.execute("DROP INDEX IF EXISTS roads_geom_idx;")
                conn.commit()

                # 3. Use pgr_nodeNetwork to split intersecting roads
                print("Running pgr_nodeNetwork (this splits geometries at intersection points)...")
                cur.execute("SELECT pgr_nodeNetwork('roads_raw', 0.00001, 'id', 'geom', 'noded');")
                res = cur.fetchone()[0]
                print(f"pgr_nodeNetwork result: {res}")
                conn.commit()

                # 4. Create new roads table with original structure
                print("Re-creating 'roads' table...")
                cur.execute("""
                    CREATE TABLE roads (
                        id SERIAL PRIMARY KEY,
                        osm_id BIGINT,
                        name VARCHAR(255),
                        highway VARCHAR(100),
                        oneway VARCHAR(10),
                        source INT,
                        target INT,
                        cost DOUBLE PRECISION,
                        reverse_cost DOUBLE PRECISION,
                        length DOUBLE PRECISION,
                        geom GEOMETRY(LineString, 4326)
                    );
                """)
                cur.execute("CREATE INDEX roads_geom_idx ON roads USING GIST (geom);")
                conn.commit()

                # 5. Populate roads table from noded segments
                print("Populating 'roads' with noded segments...")
                cur.execute("""
                    INSERT INTO roads (osm_id, name, highway, oneway, geom)
                    SELECT 
                        r.osm_id,
                        r.name,
                        r.highway,
                        r.oneway,
                        n.geom
                    FROM roads_raw_noded n
                    JOIN roads_raw r ON n.old_id = r.id;
                """)
                inserted_count = cur.rowcount
                print(f"Inserted {inserted_count} noded road segments.")
                conn.commit()

                # 6. Calculate lengths and costs
                print("Calculating lengths and routing costs...")
                cur.execute("UPDATE roads SET length = ST_Length(geom::geography);")
                cur.execute("""
                    UPDATE roads 
                    SET cost = CASE WHEN oneway = '-1' THEN -1 ELSE length END,
                        reverse_cost = CASE WHEN oneway IN ('yes', '1', 'true') THEN -1 ELSE length END;
                """)
                conn.commit()

                # 7. Create pgRouting topology
                print("Building pgRouting topology on noded road network...")
                cur.execute("SELECT pgr_createTopology('roads', 0.00001, 'geom', 'id');")
                res_topo = cur.fetchone()[0]
                print(f"pgr_createTopology result: {res_topo}")
                conn.commit()

                # 8. Verify connection components
                cur.execute("""
                    WITH components AS (
                        SELECT node, component, count(*) OVER (PARTITION BY component) as comp_size
                        FROM pgr_connectedComponents('SELECT id, source, target, cost, reverse_cost FROM roads')
                    )
                    SELECT count(distinct component), max(comp_size)
                    FROM components;
                """)
                num_components, max_comp_size = cur.fetchone()
                print(f"Topology built. Total components: {num_components}, Max component size: {max_comp_size}")
                
                # Check component of Ngô Gia Tự
                cur.execute("""
                    WITH components AS (
                        SELECT node, component, count(*) OVER (PARTITION BY component) as comp_size
                        FROM pgr_connectedComponents('SELECT id, source, target, cost, reverse_cost FROM roads')
                    )
                    SELECT v.id, c.comp_size
                    FROM roads_vertices_pgr v
                    JOIN components c ON v.id = c.node
                    WHERE v.id IN (
                        SELECT source FROM roads WHERE name ILIKE '%Ngô Gia Tự%'
                        UNION
                        SELECT target FROM roads WHERE name ILIKE '%Ngô Gia Tự%'
                    )
                    LIMIT 5;
                """)
                print("Component details for Ngô Gia Tự nodes in noded network:")
                print(cur.fetchall())
                
                # 9. Clean up temporary raw tables
                print("Cleaning up temporary raw tables...")
                cur.execute("DROP TABLE IF EXISTS roads_raw CASCADE;")
                cur.execute("DROP TABLE IF EXISTS roads_raw_noded CASCADE;")
                conn.commit()
                print("Topology rebuilding completed successfully!")
                
    except Exception as e:
        print(f"Error rebuilding topology: {e}")
        sys.exit(1)

if __name__ == "__main__":
    rebuild()
