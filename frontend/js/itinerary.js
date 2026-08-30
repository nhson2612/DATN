let currentRecommendedItinerary = null;
let itineraryRouteLayers = [];

async function generateAIItinerary() {
    const duration_days = parseInt(document.getElementById("itin-days").value);
    const budget = document.getElementById("itin-budget").value;
    const preferences = document.getElementById("itin-prefs").value.trim() || "Ngẫu nhiên";
    const destination = document.getElementById("itin-destination").value.trim();

    // Không có điểm đến thì backend gom địa điểm quanh vị trí hiện tại; gửi kèm
    // toạ độ GPS (userLocation do chat.js lấy lúc load trang) để nó có mốc.
    const pos = (typeof userLocation !== "undefined" && userLocation) ? userLocation : null;
    
    const btn = document.getElementById("recommend-btn");
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang lập lịch trình bằng AI...`;
    btn.disabled = true;
    
    clearQueryLayersAndMarkers();
    if (typeof clearRouteLayer === "function") clearRouteLayer();
    
    try {
        const res = await apiFetch("/itineraries/recommend", {
            method: 'POST',
            body: JSON.stringify({
                duration_days, budget, preferences, destination,
                user_lon: pos ? pos.lon : null,
                user_lat: pos ? pos.lat : null
            })
        });
        
        btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Lập lịch trình bằng AI`;
        btn.disabled = false;
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Lập lịch trình thất bại.");
            return;
        }
        
        const data = await res.json();
        currentRecommendedItinerary = data;
        
        document.getElementById("itin-result-container").style.display = "block";
        document.getElementById("itin-explanation").innerText = data.explanation;
        
        const daysList = document.getElementById("itin-days-list");
        daysList.innerHTML = "";
        
        data.days.forEach(day => {
            const dayBlock = document.createElement("div");
            dayBlock.className = "itin-day-block";
            dayBlock.innerHTML = `
                <div class="itin-day-title" onclick="renderItineraryDayOnMap(${day.day})">
                    <span>${day.title}</span>
                    <button class="view-day-route-btn"><i class="fa-solid fa-map-location-dot"></i> Xem đường đi</button>
                </div>
            `;
            
            const actList = document.createElement("div");
            actList.className = "itin-act-list";
            
            day.activities.forEach(act => {
                const actItem = document.createElement("div");
                actItem.className = "itin-act-item";
                actItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 12px; margin-bottom: 2px;">
                        <span class="time-badge">${act.time}</span>
                        <span class="place-link" onclick="focusOnPlace(${act.lon}, ${act.lat}, '${act.name}')">${act.name}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${act.description}</div>
                `;
                actList.appendChild(actItem);
            });
            
            dayBlock.appendChild(actList);
            daysList.appendChild(dayBlock);
        });
        
        if (data.days.length > 0) {
            renderItineraryDayOnMap(data.days[0].day);
        }
        
    } catch (e) {
        console.error(e);
        btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Lập lịch trình bằng AI`;
        btn.disabled = false;
        alert("Lỗi khi kết nối đến server.");
    }
}

function renderItineraryDayOnMap(dayNumber) {
    if (!currentRecommendedItinerary) return;
    
    const day = currentRecommendedItinerary.days.find(d => d.day === dayNumber);
    if (!day) return;
    
    clearQueryLayersAndMarkers();
    
    itineraryRouteLayers.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    itineraryRouteLayers = [];
    
    const points = [];
    day.activities.forEach((act, idx) => {
        if (act.lon !== undefined && act.lat !== undefined) {
            points.push([act.lon, act.lat]);
            
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.pointerEvents = 'none';

            const el = document.createElement('div');
            el.className = 'itin-marker';
            el.innerHTML = `<span>${idx + 1}</span>`;
            el.style.background = '#818cf8';
            el.style.color = '#fff';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = '12px';
            el.style.fontWeight = 'bold';
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';

            const label = document.createElement('div');
            label.innerText = act.name;
            label.style.fontSize = '10px';
            label.style.fontWeight = '700';
            label.style.color = '#1e293b';
            label.style.background = 'rgba(255, 255, 255, 0.9)';
            label.style.border = '1px solid #cbd5e1';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '4px';
            label.style.marginTop = '4px';
            label.style.whiteSpace = 'nowrap';
            label.style.boxShadow = '0 1.5px 3px rgba(0,0,0,0.1)';
            label.style.pointerEvents = 'auto';

            container.appendChild(el);
            container.appendChild(label);
            
            const popup = new maplibregl.Popup({ offset: 10 })
                .setHTML(`<div class="popup-title">${act.time}: ${act.name}</div><div class="popup-desc">${act.description}</div>`);
                
            const marker = new maplibregl.Marker({ element: container })
                .setLngLat([act.lon, act.lat])
                .setPopup(popup)
                .addTo(map);
                
            queryMarkers.push(marker);
        }
    });
    
    if (day.route_geojson && day.route_geojson.features.length > 0) {
        const sourceId = `itin-day-route-${dayNumber}`;
        map.addSource(sourceId, {
            type: 'geojson',
            data: day.route_geojson
        });
        
        map.addLayer({
            id: sourceId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#f59e0b',
                'line-width': 4.5,
                'line-opacity': 0.8
            }
        });
        
        itineraryRouteLayers.push(sourceId);
    }
    
    if (points.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach(pt => bounds.extend(pt));
        map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
}

function focusOnPlace(lon, lat, name) {
    map.flyTo({
        center: [lon, lat],
        zoom: 15,
        essential: true
    });
}

async function saveItinerary() {
    if (!token) {
        alert("Vui lòng đăng nhập để sử dụng tính năng này.");
        openAuthModal();
        return;
    }
    
    const nameInput = document.getElementById("save-itin-name");
    const name = nameInput.value.trim();
    if (!name) {
        alert("Vui lòng nhập tên cho lịch trình.");
        return;
    }
    
    if (!currentRecommendedItinerary) {
        alert("Không có lịch trình nào để lưu.");
        return;
    }
    
    const stops = [];
    currentRecommendedItinerary.days.forEach(day => {
        day.activities.forEach(act => {
            stops.push({
                day: day.day,
                type: act.place_type,
                id: act.place_id
            });
        });
    });
    
    try {
        const res = await apiFetch("/itineraries", {
            method: 'POST',
            body: JSON.stringify({
                name: name,
                description: currentRecommendedItinerary.explanation,
                duration_days: currentRecommendedItinerary.days.length,
                stops: stops
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Lưu thất bại.");
            return;
        }
        
        alert("Lưu lịch trình thành công!");
        nameInput.value = "";
        loadSavedItineraries();
    } catch (e) {
        console.error(e);
        alert("Lỗi khi kết nối đến server.");
    }
}

async function loadSavedItineraries() {
    if (!token) return;
    
    try {
        const res = await apiFetch("/itineraries");
        if (!res.ok) return;
        
        const data = await res.json();
        const listContainer = document.getElementById("saved-itins-list");
        
        if (data.itineraries.length === 0) {
            listContainer.innerHTML = `<p style="font-size: 11px; color: var(--text-secondary);">Bạn chưa lưu lịch trình nào.</p>`;
            return;
        }
        
        listContainer.innerHTML = "";
        data.itineraries.forEach(itin => {
            const item = document.createElement("div");
            item.className = "saved-itin-item";
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 600; font-size: 12px; color: var(--text-primary); cursor: pointer;" onclick="loadSavedItinOnMap(${itin.id})">
                        ${itin.name} (${itin.duration_days} ngày)
                    </span>
                    <button onclick="deleteSavedItinerary(${itin.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 11px;" title="Xóa">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    } catch (e) {
        console.error(e);
    }
}

async function deleteSavedItinerary(id) {
    if (!confirm("Bạn có chắc chắn muốn xóa lịch trình này?")) return;
    
    try {
        const res = await apiFetch(`/itineraries/${id}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            loadSavedItineraries();
        } else {
            const err = await res.json();
            alert(err.detail || "Xóa thất bại.");
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadSavedItinOnMap(id) {
    try {
        const res = await apiFetch("/itineraries");
        if (!res.ok) return;
        const data = await res.json();
        const itin = data.itineraries.find(i => i.id === id);
        if (!itin) return;
        
        const days = [];
        for (let d = 1; d <= itin.duration_days; d++) {
            const dayStops = itin.stops_details.filter(s => s.day === d);
            if (dayStops.length === 0) continue;
            
            const activities = dayStops.map((stop, index) => {
                const times = ["Sáng", "Trưa", "Chiều", "Tối"];
                return {
                    time: times[index % 4],
                    name: stop.name,
                    place_id: stop.id,
                    place_type: stop.type,
                    lon: stop.lon,
                    lat: stop.lat,
                    description: stop.details.description || stop.details.address || "Tham quan địa điểm."
                };
            });
            
            days.push({
                day: d,
                title: `Ngày ${d}: Khám phá địa điểm`,
                activities: activities
            });
        }
        
        currentRecommendedItinerary = {
            explanation: itin.description || "",
            days: days
        };
        
        document.getElementById("itin-result-container").style.display = "block";
        document.getElementById("itin-explanation").innerText = itin.description || "";
        
        const daysList = document.getElementById("itin-days-list");
        daysList.innerHTML = "";
        
        days.forEach(day => {
            const dayBlock = document.createElement("div");
            dayBlock.className = "itin-day-block";
            dayBlock.innerHTML = `
                <div class="itin-day-title" onclick="renderSavedItineraryDayOnMap(${day.day})">
                    <span>${day.title}</span>
                    <button class="view-day-route-btn"><i class="fa-solid fa-map-location-dot"></i> Xem đường đi</button>
                </div>
            `;
            
            const actList = document.createElement("div");
            actList.className = "itin-act-list";
            
            day.activities.forEach(act => {
                const actItem = document.createElement("div");
                actItem.className = "itin-act-item";
                actItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 12px; margin-bottom: 2px;">
                        <span class="time-badge">${act.time}</span>
                        <span class="place-link" onclick="focusOnPlace(${act.lon}, ${act.lat}, '${act.name}')">${act.name}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${act.description}</div>
                `;
                actList.appendChild(actItem);
            });
            
            dayBlock.appendChild(actList);
            daysList.appendChild(dayBlock);
        });
        
        if (days.length > 0) {
            renderSavedItineraryDayOnMap(days[0].day);
        }
        
        switchTab('itinerary-tab');
        
    } catch (e) {
        console.error(e);
    }
}

async function renderSavedItineraryDayOnMap(dayNumber) {
    if (!currentRecommendedItinerary) return;
    const day = currentRecommendedItinerary.days.find(d => d.day === dayNumber);
    if (!day) return;
    
    clearQueryLayersAndMarkers();
    itineraryRouteLayers.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    itineraryRouteLayers = [];
    
    const points = [];
    day.activities.forEach((act, idx) => {
        if (act.lon !== undefined && act.lat !== undefined) {
            points.push([act.lon, act.lat]);
            
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.pointerEvents = 'none';

            const el = document.createElement('div');
            el.className = 'itin-marker';
            el.innerHTML = `<span>${idx + 1}</span>`;
            el.style.background = '#38bdf8';
            el.style.color = '#fff';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.borderRadius = '50%';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = '12px';
            el.style.fontWeight = 'bold';
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';

            const label = document.createElement('div');
            label.innerText = act.name;
            label.style.fontSize = '10px';
            label.style.fontWeight = '700';
            label.style.color = '#1e293b';
            label.style.background = 'rgba(255, 255, 255, 0.9)';
            label.style.border = '1px solid #cbd5e1';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '4px';
            label.style.marginTop = '4px';
            label.style.whiteSpace = 'nowrap';
            label.style.boxShadow = '0 1.5px 3px rgba(0,0,0,0.1)';
            label.style.pointerEvents = 'auto';

            container.appendChild(el);
            container.appendChild(label);
            
            const popup = new maplibregl.Popup({ offset: 10 })
                .setHTML(`<div class="popup-title">${act.time}: ${act.name}</div><div class="popup-desc">${act.description}</div>`);
                
            const marker = new maplibregl.Marker({ element: container })
                .setLngLat([act.lon, act.lat])
                .setPopup(popup)
                .addTo(map);
                
            queryMarkers.push(marker);
        }
    });
    
    const features = [];
    for (let i = 0; i < points.length - 1; i++) {
        try {
            const res = await apiFetch("/route", {
                method: 'POST',
                body: JSON.stringify({
                    start_lon: points[i][0],
                    start_lat: points[i][1],
                    end_lon: points[i+1][0],
                    end_lat: points[i+1][1]
                })
            });
            if (res.ok) {
                const routeData = await res.json();
                if (routeData.success && routeData.path) {
                    routeData.path.forEach(seg => {
                        features.push({
                            type: 'Feature',
                            geometry: seg.geom,
                            properties: {}
                        });
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    if (features.length > 0) {
        const sourceId = `itin-day-route-${dayNumber}`;
        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });
        
        map.addLayer({
            id: sourceId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#10b981',
                'line-width': 4.5,
                'line-opacity': 0.8
            }
        });
        
        itineraryRouteLayers.push(sourceId);
    }
    
    if (points.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach(pt => bounds.extend(pt));
        map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
}
