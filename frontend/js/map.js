let map;
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let routeLayerId = 'routing-path';
let queryLayers = [];
let queryMarkers = [];

document.addEventListener("DOMContentLoaded", () => {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center: [108.206, 16.047], // Da Nang center
        zoom: 12,
        pitch: 30
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('load', async () => {
        // Load road network
        try {
            const response = await fetch(`${API_BASE}/roads`);
            if (response.ok) {
                const roadsData = await response.json();
                map.addSource('db-roads', {
                    type: 'geojson',
                    data: roadsData
                });
                map.addLayer({
                    id: 'db-roads-layer',
                    type: 'line',
                    source: 'db-roads',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#4f46e5',
                        'line-width': 2.2,
                        'line-opacity': 0.6
                    }
                });
            }
        } catch (err) {
            console.error("Lỗi khi tải mạng lưới đường từ DB:", err);
        }

        // Fetch and display POIs/Accommodations
        try {
            const response = await fetch(`${API_BASE}/places`);
            if (response.ok) {
                const placesData = await response.json();
                map.addSource('db-places', {
                    type: 'geojson',
                    data: placesData
                });
                
                // POI and accommodation circles layer
                map.addLayer({
                    id: 'db-places-layer',
                    type: 'circle',
                    source: 'db-places',
                    paint: {
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 3.5,
                            15, 7.5
                        ],
                        'circle-color': [
                            'match',
                            ['get', 'type'],
                            'poi', '#38bdf8', // Light blue for POIs
                            'accommodation', '#f59e0b', // Orange for hotels
                            '#818cf8'
                        ],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                        'circle-opacity': 0.85
                    }
                });

                // Show popups on place click
                map.on('click', 'db-places-layer', (e) => {
                    const coordinates = e.features[0].geometry.coordinates.slice();
                    const props = e.features[0].properties;
                    
                    let popupContent = `
                        <div class="popup-title" style="font-weight:700; font-size:13px; color:#1e293b; margin-bottom:4px;">${props.name}</div>
                        <div class="popup-desc" style="font-size:11px; color:#64748b; line-height:1.4;">${props.description || 'Không có mô tả.'}</div>
                    `;

                    if (props.amenity || props.tourism) {
                        popupContent += `
                            <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${props.amenity ? `<span style="font-size: 9px; background: rgba(56, 189, 248, 0.15); color: #0284c7; padding: 2px 5px; border-radius: 3px; font-weight: bold;">${props.amenity}</span>` : ''}
                                ${props.tourism ? `<span style="font-size: 9px; background: rgba(129, 140, 248, 0.15); color: #4f46e5; padding: 2px 5px; border-radius: 3px; font-weight: bold;">${props.tourism}</span>` : ''}
                            </div>
                        `;
                    }
                    
                    const isAdminPage = window.location.pathname.includes("admin.html");
                    const mapToken = localStorage.getItem("token");
                    const mapUserStr = localStorage.getItem("user");
                    let mapUser = null;
                    try { if (mapUserStr) mapUser = JSON.parse(mapUserStr); } catch(err) {}

                    if (isAdminPage && mapToken && mapUser && mapUser.role === 'admin') {
                        popupContent += `
                            <div style="margin-top: 10px; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; display:flex; justify-content:flex-end;">
                                <button onclick="deletePlace('${props.id}', '${props.type}')" style="background: #ef4444; color: white; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-trash-can"></i> Xóa địa điểm
                                </button>
                            </div>
                        `;
                    }

                    new maplibregl.Popup({ offset: 10 })
                        .setLngLat(coordinates)
                        .setHTML(popupContent)
                        .addTo(map);
                });

                // Change cursor to pointer when hovering over places
                map.on('mouseenter', 'db-places-layer', () => {
                    map.getCanvas().style.cursor = 'pointer';
                });
                map.on('mouseleave', 'db-places-layer', () => {
                    map.getCanvas().style.cursor = '';
                });
            }
        } catch (err) {
            console.error("Lỗi khi tải địa điểm từ DB:", err);
        }
    });

    // Handle map clicks
    map.on('click', (e) => {
        // If on the standalone admin page
        if (window.location.pathname.includes("admin.html")) {
            if (typeof handleMapClickForAdmin === "function") {
                handleMapClickForAdmin(e.lngLat);
            }
            return;
        }

        // If on client page, handle routing tab clicks
        const activeTabEl = document.querySelector('.tab-panel.active');
        if (!activeTabEl) return;
        
        const activeTab = activeTabEl.id;
        if (activeTab === 'routing-tab') {
            handleMapClickForRouting(e.lngLat);
        }
    });
});

async function reloadPlacesSource() {
    if (map && map.getSource('db-places')) {
        try {
            const response = await fetch(`${API_BASE}/places`);
            if (response.ok) {
                const data = await response.json();
                map.getSource('db-places').setData(data);
            }
        } catch (e) {
            console.error("Error reloading places source:", e);
        }
    }
}

// Map styles toggler
function changeMapStyle(styleName) {
    document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.style-btn[onclick*="'${styleName}'"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (styleName === 'streets') {
        map.setStyle('https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json');
        map.setPitch(30);
    } else if (styleName === 'satellite') {
        map.setStyle('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json');
        map.setPitch(0);
    } else if (styleName === '3d') {
        map.setStyle('https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json');
        map.setPitch(60);
        map.setBearing(-15);
    } else if (styleName === 'traffic') {
        map.setStyle('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json');
        map.setPitch(30);
    }
}

// Checkbox Category Filters
//
// Loc theo `amenity`/`tourism`, KHONG loc theo `type`. /api/places chi dat
// properties.type = 'poi' | 'accommodation', nen ban truoc day day cac gia tri
// 'restaurant' / 'cafe' / 'other' vao filter theo `type` -> khong bao gio khop:
// 3 trong 5 checkbox khong co tac dung, va "Diem tham quan" (loc 'poi') thi an
// luon ca nha hang va ca phe vi chung cung la poi.
const FILTER_RESTAURANT = ['restaurant', 'fast_food'];
const FILTER_CAFE       = ['cafe'];
const FILTER_ATTRACTION = ['attraction', 'viewpoint', 'museum', 'theme_park'];

function toggleFilter(layerName) {
    if (!map.getLayer('db-places-layer')) return;

    const on = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    const inList = (prop, values) => ['in', ['get', prop], ['literal', values]];

    // "Khac" = poi khong thuoc nha hang / ca phe / diem tham quan
    const isOther = ['all',
        ['==', ['get', 'type'], 'poi'],
        ['!', inList('amenity', FILTER_RESTAURANT.concat(FILTER_CAFE))],
        ['!', inList('tourism', FILTER_ATTRACTION)]
    ];

    const clauses = [];
    if (on('filter-hotel'))      clauses.push(['==', ['get', 'type'], 'accommodation']);
    if (on('filter-restaurant')) clauses.push(inList('amenity', FILTER_RESTAURANT));
    if (on('filter-cafe'))       clauses.push(inList('amenity', FILTER_CAFE));
    if (on('filter-attraction')) clauses.push(inList('tourism', FILTER_ATTRACTION));
    if (on('filter-other'))      clauses.push(isOther);

    if (clauses.length === 0) {
        // Bo hết -> an tat ca
        map.setFilter('db-places-layer', ['==', ['get', 'type'], '__none__']);
    } else {
        map.setFilter('db-places-layer', ['any'].concat(clauses));
    }
}

// Search radius picker
function setSearchRadius(radius) {
    document.querySelectorAll('.radius-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.radius-btn[onclick*="${radius}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    console.log("Tìm kiếm quanh đây:", radius, "meters");
}

// Locate User on GPS
function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const coords = [position.coords.longitude, position.coords.latitude];
            map.flyTo({ center: coords, zoom: 14 });
            
            // Pulse current position marker
            const el = document.createElement('div');
            el.className = 'pulse-dot';
            el.style.width = '14px';
            el.style.height = '14px';
            el.style.background = '#2563eb';
            el.style.border = '2px solid white';
            el.style.borderRadius = '50%';
            
            new maplibregl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map);
        }, (err) => {
            alert("Không thể truy cập quyền định vị GPS.");
        });
    } else {
        alert("Trình duyệt không hỗ trợ Geolocation.");
    }
}

// Zoom helpers
function mapZoomIn() {
    if (map) map.zoomIn();
}

function mapZoomOut() {
    if (map) map.zoomOut();
}
