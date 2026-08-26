let userLocation = null;

// Try to obtain the user's location via GPS on page load
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lon: position.coords.longitude,
                lat: position.coords.latitude
            };
            console.log("GPS Location acquired:", userLocation);
        },
        (err) => {
            console.warn("GPS Location not available, falling back to IP-based location on backend.");
        }
    );
}

function handleChatKey(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    const question = inputEl.value.trim();
    if (!question) return;

    inputEl.value = '';
    
    // Append User message
    appendMessage(question, 'user');

    // Append Agent placeholder
    const agentMsgId = 'agent-' + Date.now();
    appendMessage(`
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>
    `, 'agent', agentMsgId);

    // Clear previous query layers/markers
    clearQueryLayersAndMarkers();
    if (typeof clearRouteLayer === "function") clearRouteLayer();

    try {
        const bodyPayload = { question };
        if (userLocation) {
            bodyPayload.user_lon = userLocation.lon;
            bodyPayload.user_lat = userLocation.lat;
        }

        const response = await apiFetch("/chat", {
            method: 'POST',
            body: JSON.stringify(bodyPayload)
        });
        
        const data = await response.json();
        const agentEl = document.getElementById(agentMsgId);
        const contentEl = agentEl ? agentEl.querySelector('.message-content') : null;

        if (!data.success) {
            const errHtml = `Lỗi hệ thống: ${data.error || 'Không thể tạo truy vấn hợp lệ'}`;
            if (contentEl) contentEl.innerHTML = errHtml;
            else if (agentEl) agentEl.innerHTML = errHtml;
            return;
        }

        // Render answer
        let responseHtml = `<div>${data.explanation}</div>`;
        
        // Append SQL debug in light theme style
        responseHtml += `
            <div style="margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 8px; text-align: left;">
                <span class="debug-tag" style="background: rgba(37, 99, 235, 0.08); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.15);"><i class="fa-solid fa-code"></i> PostGIS SQL Sinh ra</span>
                <div class="sql-box" style="background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; font-family: monospace; font-size: 10.5px; border-radius: 6px; padding: 10px; margin-top: 6px; white-space: pre-wrap; word-break: break-all;">${data.sql}</div>
            </div>
        `;

        const attemptsCount = data.debug.length;
        if (attemptsCount > 1) {
            responseHtml += `
                <div style="margin-top: 8px; font-size: 11px; color: #db2777;">
                    <i class="fa-solid fa-bug"></i> Hệ thống tự phát hiện lỗi và sửa (${attemptsCount - 1} lần)
                </div>
            `;
        }

        if (contentEl) contentEl.innerHTML = responseHtml;
        else if (agentEl) agentEl.innerHTML = responseHtml;

        // Render results on the map
        if (data.results && data.results.length > 0) {
            renderQueryResultsOnMap(data.results);
        }

    } catch (err) {
        console.error(err);
        const agentEl = document.getElementById(agentMsgId);
        const contentEl = agentEl ? agentEl.querySelector('.message-content') : null;
        const errText = `Không thể kết nối đến máy chủ backend (Localhost:8000).`;
        if (contentEl) contentEl.innerHTML = errText;
        else if (agentEl) agentEl.innerHTML = errText;
    }
}

function appendMessage(text, sender, id = null) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    const msgEl = document.createElement('div');
    msgEl.className = `message ${sender}`;
    if (id) msgEl.id = id;

    const avatarHtml = sender === 'user'
        ? `<span class="chat-user-avatar"><i class="fa-solid fa-user-astronaut"></i></span>`
        : `<span class="chat-agent-avatar"><i class="fa-solid fa-comments"></i></span>`;

    msgEl.innerHTML = `
        ${avatarHtml}
        <div class="message-content">${text}</div>
    `;

    chatHistory.appendChild(msgEl);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function fillChatSuggestion(text) {
    const inputEl = document.getElementById('chat-input');
    if (inputEl) {
        inputEl.value = text;
        sendChatMessage();
    }
}

function clearQueryLayersAndMarkers() {
    queryMarkers.forEach(m => m.remove());
    queryMarkers = [];

    queryLayers.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
    });
    queryLayers = [];
}

function renderQueryResultsOnMap(results) {
    const points = [];

    results.forEach((item, index) => {
        let geom = item.geom || item.geometry;
        if (!geom) return;

        const name = item.name || `Địa điểm ${index + 1}`;
        const detail = item.address || item.description || item.tourism || item.amenity || '';

        if (geom.type === 'Point') {
            const coords = geom.coordinates;
            points.push(coords);

            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.pointerEvents = 'none';

            const dot = document.createElement('div');
            dot.style.width = '16px';
            dot.style.height = '16px';
            dot.style.borderRadius = '50%';
            dot.style.background = 'radial-gradient(circle, #38bdf8 0%, #818cf8 100%)';
            dot.style.border = '2px solid white';
            dot.style.boxShadow = '0 0 10px #38bdf8';
            dot.style.cursor = 'pointer';
            dot.style.pointerEvents = 'auto'; // enable interaction on dot

            const label = document.createElement('div');
            label.innerText = name;
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
            label.style.pointerEvents = 'auto'; // enable interaction on label too

            container.appendChild(dot);
            container.appendChild(label);

            let popupContent = `<div class="popup-title">${name}</div><div class="popup-desc">${detail}</div>`;
            if (currentUser && currentUser.role === 'admin') {
                popupContent += `
                    <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                        <button onclick="deletePlace('${item.id}', '${item.type || 'poi'}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-trash-can"></i> Xóa địa điểm
                        </button>
                    </div>
                `;
            }

            const popup = new maplibregl.Popup({ offset: 10 })
                .setHTML(popupContent);

            const marker = new maplibregl.Marker({ element: container })
                .setLngLat(coords)
                .setPopup(popup)
                .addTo(map);

            queryMarkers.push(marker);
        } 
        else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            const layerId = `layer-result-${index}`;
            map.addSource(layerId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: { name, detail },
                    geometry: geom
                }
            });

            map.addLayer({
                id: `${layerId}-outline`,
                type: 'line',
                source: layerId,
                paint: {
                    'line-color': '#818cf8',
                    'line-width': 2
                }
            });

            map.addLayer({
                id: layerId,
                type: 'fill',
                source: layerId,
                paint: {
                    'fill-color': '#38bdf8',
                    'fill-opacity': 0.15
                }
            });

            queryLayers.push(layerId);
            queryLayers.push(`${layerId}-outline`);
        }
    });

    if (points.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach(pt => bounds.extend(pt));
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
}
