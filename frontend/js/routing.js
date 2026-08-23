function handleMapClickForRouting(lngLat) {
    const coordsText = `${lngLat.lng.toFixed(5)}, ${lngLat.lat.toFixed(5)}`;

    if (!startPoint) {
        startPoint = [lngLat.lng, lngLat.lat];
        document.getElementById('start-coord-label').innerText = coordsText;

        if (startMarker) startMarker.remove();
        
        const el = document.createElement('div');
        el.className = 'fa-solid fa-circle-play';
        el.style.fontSize = '24px';
        el.style.color = '#10b981';
        el.style.textShadow = '0 0 5px white';

        startMarker = new maplibregl.Marker({ element: el })
            .setLngLat(startPoint)
            .addTo(map);

    } else if (!endPoint) {
        endPoint = [lngLat.lng, lngLat.lat];
        document.getElementById('end-coord-label').innerText = coordsText;

        if (endMarker) endMarker.remove();
        
        const el = document.createElement('div');
        el.className = 'fa-solid fa-location-dot';
        el.style.fontSize = '24px';
        el.style.color = '#ef4444';
        el.style.textShadow = '0 0 5px white';

        endMarker = new maplibregl.Marker({ element: el })
            .setLngLat(endPoint)
            .addTo(map);

        document.getElementById('find-route-btn').disabled = false;
    } else {
        startPoint = [lngLat.lng, lngLat.lat];
        endPoint = null;
        document.getElementById('start-coord-label').innerText = coordsText;
        document.getElementById('end-coord-label').innerText = "Click trên bản đồ...";
        document.getElementById('find-route-btn').disabled = true;

        if (startMarker) startMarker.remove();
        if (endMarker) endMarker.remove();
        clearRouteLayer();

        const el = document.createElement('div');
        el.className = 'fa-solid fa-circle-play';
        el.style.fontSize = '24px';
        el.style.color = '#10b981';
        
        startMarker = new maplibregl.Marker({ element: el })
            .setLngLat(startPoint)
            .addTo(map);
    }
}

function clearRouteLayer() {
    if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
    if (map.getSource(routeLayerId)) map.removeSource(routeLayerId);
    document.getElementById('route-result-info').style.display = 'none';
}

async function calculateRoute() {
    if (!startPoint || !endPoint) return;

    document.getElementById('find-route-btn').innerText = "Đang tính toán tuyến đường...";
    clearRouteLayer();

    try {
        const response = await apiFetch("/route", {
            method: 'POST',
            body: JSON.stringify({
                start_lon: startPoint[0],
                start_lat: startPoint[1],
                end_lon: endPoint[0],
                end_lat: endPoint[1]
            })
        });

        document.getElementById('find-route-btn').innerHTML = `<i class="fa-solid fa-compass"></i> Tìm đường đi ngắn nhất`;

        if (!response.ok) {
            const err = await response.json();
            alert(err.detail || "Có lỗi xảy ra khi tính toán tuyến đường.");
            return;
        }

        const data = await response.json();

        if (!data.success || !data.path || data.path.length === 0) {
            alert("Không tìm thấy đường đi giữa hai điểm này trên mạng lưới đường bộ.");
            return;
        }

        const features = data.path.map(segment => ({
            type: 'Feature',
            properties: { name: segment.street_name },
            geometry: segment.geom
        }));

        // Snap connection start
        if (data.start_snap_lon !== undefined && data.start_snap_lat !== undefined) {
            features.unshift({
                type: 'Feature',
                properties: { name: 'Kết nối bắt đầu (Đi bộ)' },
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [startPoint[0], startPoint[1]],
                        [data.start_snap_lon, data.start_snap_lat]
                    ]
                }
            });
        }

        // Snap connection end
        if (data.end_snap_lon !== undefined && data.end_snap_lat !== undefined) {
            features.push({
                type: 'Feature',
                properties: { name: 'Kết nối kết thúc (Đi bộ)' },
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [data.end_snap_lon, data.end_snap_lat],
                        [endPoint[0], endPoint[1]]
                    ]
                }
            });
        }

        map.addSource(routeLayerId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });

        map.addLayer({
            id: routeLayerId,
            type: 'line',
            source: routeLayerId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#10b981',
                'line-width': 5,
                'line-opacity': 0.85
            }
        });

        const distanceKm = (data.total_distance_meters / 1000).toFixed(2);
        document.getElementById('route-distance-text').innerText = `Quãng đường: ${distanceKm} km (${data.total_distance_meters.toFixed(0)} mét)`;
        document.getElementById('route-result-info').style.display = 'flex';

    } catch (err) {
        console.error(err);
        alert("Lỗi khi gửi yêu cầu định tuyến tới backend.");
        document.getElementById('find-route-btn').innerHTML = `<i class="fa-solid fa-compass"></i> Tìm đường đi ngắn nhất`;
    }
}
