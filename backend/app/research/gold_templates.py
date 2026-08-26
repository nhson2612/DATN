# Gold SQL templates written by hand. Completely independent of the IR compiler.

GOLD_TEMPLATES = {
    "intersects+count": """
        SELECT count(*)::integer AS total
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
    """,
    "intersects+name": """
        SELECT p.name
        FROM poi p
        WHERE p.amenity = %s
          AND ST_Contains(
            (SELECT ST_CollectionExtract(ST_MakeValid(geom), 3) FROM boundaries WHERE id = %s),
            p.geom
          )
        ORDER BY p.name
        LIMIT 20
    """,
    "range+count_poi": """
        SELECT count(*)::integer AS total
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    """,
    "range+count_accommodation": """
        SELECT count(*)::integer AS total
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
    """,
    "range+name_poi": """
        SELECT t.name
        FROM poi t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    """,
    "range+name_accommodation": """
        SELECT t.name
        FROM accommodation t
        WHERE ST_DWithin(
          t.geom::geography,
          (SELECT geom::geography FROM poi WHERE id = %s),
          %s
        )
        ORDER BY t.name
        LIMIT 20
    """,
    "knn+name": """
        SELECT t.name
        FROM poi t
        WHERE t.amenity = %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    """,
    "knn+distance": """
        SELECT t.name
        FROM accommodation t
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    """,
    "knn:non_spat_filter+name": """
        SELECT t.name
        FROM accommodation t
        WHERE t.rating >= %s
        ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        LIMIT %s
    """,
    "range:non_spat_filter+name": """
        SELECT t.name
        FROM accommodation t
        WHERE t.price_level = %s
          AND t.tourism IN ('guest_house', 'hostel')
          AND ST_DWithin(
            t.geom::geography,
            (SELECT geom::geography FROM poi WHERE id = %s),
            %s
          )
        ORDER BY t.name
        LIMIT 20
    """
}

def get_gold_sql_and_params(template, target, params):
    """
    Returns (sql_query, sql_params) for a given template name, target, and input arguments.
    params is a list of parameter values in the order expected by the template.
    """
    key = template
    if template in ("range+count", "range+name"):
        key = f"{template}_{target}"
    
    if key not in GOLD_TEMPLATES:
        raise ValueError(f"Unknown gold template key: {key}")
        
    return GOLD_TEMPLATES[key], params
