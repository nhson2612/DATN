let token = localStorage.getItem("token") || null;
let currentUser = null;

try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) currentUser = JSON.parse(storedUser);
} catch (e) {
    localStorage.removeItem("user");
}

function updateAuthUI() {
    const authBtn = document.getElementById("auth-btn");
    const userInfo = document.getElementById("user-info-container");
    const userName = document.getElementById("user-name-text");
    const userRole = document.getElementById("user-role-text");
    const adminTabBtn = document.getElementById("admin-tab-btn");
    
    const landingPage = document.getElementById("landing-page");
    const appContainer = document.getElementById("app-container");

    if (token && currentUser) {
        // Logged in
        if (landingPage) landingPage.style.display = "none";
        if (appContainer) appContainer.style.display = "flex";

        if (authBtn) authBtn.style.display = "none";
        if (userInfo) userInfo.style.display = "flex";
        if (userName) userName.innerText = currentUser.full_name;
        
        if (userRole) {
            userRole.innerText = currentUser.role;
            userRole.className = `role-badge ${currentUser.role}`;
        }
        
        if (adminTabBtn) {
            if (currentUser.role === "admin") {
                adminTabBtn.style.display = "flex";
            } else {
                adminTabBtn.style.display = "none";
            }
        }
        
        // Load saved itineraries
        if (typeof loadSavedItineraries === "function") {
            loadSavedItineraries();
        }

        // Trigger map resize since it might have been loaded hidden
        if (typeof map !== 'undefined' && map) {
            setTimeout(() => map.resize(), 100);
        }
    } else {
        // Not logged in -> Show Landing Page
        if (landingPage) landingPage.style.display = "flex";
        if (appContainer) appContainer.style.display = "none";

        // Start landing preview stream
        setTimeout(() => {
            if (typeof streamGeoAIPreview === 'function') {
                streamGeoAIPreview();
            }
        }, 150);

        if (authBtn) authBtn.style.display = "block";
        if (userInfo) userInfo.style.display = "none";
        if (adminTabBtn) adminTabBtn.style.display = "none";
        
        const savedList = document.getElementById("saved-itins-list");
        if (savedList) {
            savedList.innerHTML = `
                <p style="font-size: 11px; color: var(--text-secondary);">Hãy đăng nhập để lưu và quản lý lịch trình cá nhân.</p>
            `;
        }
    }
}

function openAuthModal() {
    document.getElementById("auth-modal").style.display = "flex";
    toggleAuthForm(true);
}

function closeAuthModal() {
    document.getElementById("auth-modal").style.display = "none";
}

function toggleAuthForm(showLogin) {
    const loginPanel = document.getElementById("login-form-panel");
    const regPanel = document.getElementById("register-form-panel");
    const modalTitle = document.getElementById("modal-title");
    
    if (showLogin) {
        loginPanel.style.display = "block";
        regPanel.style.display = "none";
        modalTitle.innerText = "Đăng nhập";
    } else {
        loginPanel.style.display = "none";
        regPanel.style.display = "block";
        modalTitle.innerText = "Đăng ký tài khoản";
    }
}

async function handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ email và mật khẩu.");
        return;
    }
    
    try {
        const res = await apiFetch("/auth/login", {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đăng nhập thất bại.");
            return;
        }
        
        const data = await res.json();
        token = data.token;
        currentUser = data.user;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(currentUser));
        
        closeAuthModal();
        updateAuthUI();
    } catch (e) {
        console.error(e);
        alert("Không thể kết nối đến server.");
    }
}

async function handleRegister() {
    const fullName = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    
    if (!fullName || !email || !password) {
        alert("Vui lòng điền đầy đủ thông tin đăng ký.");
        return;
    }
    
    try {
        const res = await apiFetch("/auth/register", {
            method: 'POST',
            body: JSON.stringify({ email, password, full_name: fullName })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đăng ký thất bại.");
            return;
        }
        
        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        toggleAuthForm(true);
    } catch (e) {
        console.error(e);
        alert("Không thể kết nối đến server.");
    }
}

function handleLogout() {
    token = null;
    currentUser = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    updateAuthUI();
}

// Landing Page Specific Auth functions
function toggleLandingAuth(showLogin) {
    const loginPanel = document.getElementById("landing-login-panel");
    const regPanel = document.getElementById("landing-register-panel");
    if (showLogin) {
        loginPanel.style.display = "block";
        regPanel.style.display = "none";
    } else {
        loginPanel.style.display = "none";
        regPanel.style.display = "block";
    }
}

function scrollToLogin() {
    const section = document.getElementById("login-section");
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

async function handleLandingLogin() {
    const email = document.getElementById("landing-email").value.trim();
    const password = document.getElementById("landing-password").value;
    if (!email || !password) {
        alert("Vui lòng nhập đầy đủ email và mật khẩu.");
        return;
    }
    
    try {
        const res = await apiFetch("/auth/login", {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đăng nhập thất bại.");
            return;
        }
        
        const data = await res.json();
        token = data.token;
        currentUser = data.user;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(currentUser));
        
        // Clean values
        document.getElementById("landing-email").value = "";
        document.getElementById("landing-password").value = "";

        updateAuthUI();
    } catch (e) {
        console.error(e);
        alert("Không thể kết nối đến server.");
    }
}

async function handleLandingRegister() {
    const fullName = document.getElementById("landing-reg-name").value.trim();
    const email = document.getElementById("landing-reg-email").value.trim();
    const password = document.getElementById("landing-reg-password").value;
    
    if (!fullName || !email || !password) {
        alert("Vui lòng điền đầy đủ thông tin đăng ký.");
        return;
    }
    
    try {
        const res = await apiFetch("/auth/register", {
            method: 'POST',
            body: JSON.stringify({ email, password, full_name: fullName })
        });
        
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Đăng ký thất bại.");
            return;
        }
        
        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        
        // Clean values
        document.getElementById("landing-reg-name").value = "";
        document.getElementById("landing-reg-email").value = "";
        document.getElementById("landing-reg-password").value = "";

        toggleLandingAuth(true);
    } catch (e) {
        console.error(e);
        alert("Không thể kết nối đến server.");
    }
}

// Handler for Landing Page Showcase tabs
function activateShowcase(featureId) {
    // Deactivate all selectors
    document.querySelectorAll('.showcase-card').forEach(card => card.classList.remove('active'));
    // Deactivate all preview panes
    document.querySelectorAll('.monitor-preview-pane').forEach(pane => pane.classList.remove('active'));

    // Find and activate the clicked card
    const selectedCard = document.querySelector(`.showcase-card[onclick*="'${featureId}'"]`);
    if (selectedCard) selectedCard.classList.add('active');

    // Find and activate preview pane
    const selectedPane = document.getElementById(`preview-${featureId}`);
    if (selectedPane) {
        selectedPane.classList.add('active');
        
        // Restart CSS animations inside the pane
        if (featureId === 'routing') {
            const path = selectedPane.querySelector('.active-route-path');
            if (path) {
                path.style.animation = 'none';
                path.offsetHeight; /* trigger reflow */
                path.style.animation = null;
            }
            initDraggableRoutingDemo();
        } else if (featureId === 'itinerary') {
            const cards = selectedPane.querySelectorAll('.sim-itin-day-card');
            cards.forEach(card => {
                card.style.animation = 'none';
                card.offsetHeight; /* trigger reflow */
                card.style.animation = null;
            });
        } else if (featureId === 'geoai') {
            streamGeoAIPreview();
        }
    }
}

// Global variable to keep track of simulation timeouts
let geoaiSimTimeout = null;

function streamGeoAIPreview() {
    // Clear any active timeouts to prevent conflicts
    if (geoaiSimTimeout) {
        clearTimeout(geoaiSimTimeout);
        geoaiSimTimeout = null;
    }

    const container = document.getElementById("geoai-sim-body");
    if (!container) return;

    // Reset container contents
    container.innerHTML = "";

    // 1. Create agent heading
    const heading = document.createElement("div");
    heading.className = "sim-agent-heading";
    heading.textContent = "GeoAI đã hiểu và tạo truy vấn:";
    container.appendChild(heading);

    // 2. Create columns container
    const columns = document.createElement("div");
    columns.className = "sim-agent-columns";
    container.appendChild(columns);

    // Left Column: Reasoning Steps
    const leftCol = document.createElement("div");
    leftCol.className = "sim-col-reasoning";
    columns.appendChild(leftCol);

    // Right Column: SQL block (initially hidden, will fade in)
    const rightCol = document.createElement("div");
    rightCol.className = "sim-col-sql";
    rightCol.style.opacity = 0;
    rightCol.style.transition = "opacity 0.4s ease";
    columns.appendChild(rightCol);

    // SQL Heading
    const sqlHeader = document.createElement("div");
    sqlHeader.className = "sim-sql-header";
    sqlHeader.textContent = "Spatial SQL (PostGIS)";
    rightCol.appendChild(sqlHeader);

    // SQL Code Block
    const sqlCode = document.createElement("pre");
    sqlCode.className = "sim-sql-code";
    rightCol.appendChild(sqlCode);

    // Typing steps configurations
    const steps = [
        { icon: "fa-brain", text: "1. Phân tích địa điểm: ", bold: "Ngũ Hành Sơn & Bãi biển Mỹ Khê" },
        { icon: "fa-filter", text: "2. Tiêu chí tìm kiếm: ", bold: "Hạng 3 sao & Bán kính < 1km" },
        { icon: "fa-layer-group", text: "3. Đang truy vấn không gian bản đồ GIS...", bold: "" }
    ];

    const sqlText = `SELECT name, star_rating, ST_Distance(geom, beach.geom) AS distance
FROM hotels
WHERE star_rating = 3
AND ST_DWithin(geom, beach.geom, 1000)
ORDER BY distance ASC;`;

    let currentStep = 0;
    
    function typeStep() {
        if (currentStep >= steps.length) {
            // After reasoning steps finish, fade in right column and type SQL
            rightCol.style.opacity = 1;
            geoaiSimTimeout = setTimeout(typeSQLText, 250);
            return;
        }

        const stepData = steps[currentStep];
        const stepEl = document.createElement("div");
        stepEl.className = "sim-reasoning-step";
        stepEl.style.opacity = 1;
        stepEl.style.transform = "none";
        stepEl.style.animation = "none";
        
        stepEl.innerHTML = `<i class="fa-solid ${stepData.icon} text-accent"></i> `;
        
        const textSpan = document.createElement("span");
        stepEl.appendChild(textSpan);
        leftCol.appendChild(stepEl);

        let charIndex = 0;
        const fullText = stepData.text;

        function typeChar() {
            if (charIndex < fullText.length) {
                textSpan.textContent += fullText[charIndex];
                charIndex++;
                geoaiSimTimeout = setTimeout(typeChar, 15);
            } else {
                if (stepData.bold) {
                    const boldEl = document.createElement("strong");
                    boldEl.textContent = stepData.bold;
                    stepEl.appendChild(boldEl);
                }
                currentStep++;
                geoaiSimTimeout = setTimeout(typeStep, 250);
            }
        }

        typeChar();
    }

    function typeSQLText() {
        let sqlIndex = 0;

        function typeChar() {
            if (sqlIndex < sqlText.length) {
                sqlCode.textContent += sqlText[sqlIndex];
                sqlIndex++;
                geoaiSimTimeout = setTimeout(typeChar, 4); // fast typing for code
            } else {
                geoaiSimTimeout = setTimeout(showResults, 400);
            }
        }
        typeChar();
    }

    function showResults() {
        const resultsHeading = document.createElement("div");
        resultsHeading.className = "sim-results-heading";
        resultsHeading.textContent = "Kết quả tìm kiếm";
        container.appendChild(resultsHeading);

        const resultList = document.createElement("div");
        resultList.className = "sim-result-list";
        container.appendChild(resultList);

        const results = [
            { icon: "fa-hotel", text: "Khách sạn Sea View (3 sao) - Cách biển: 450m" },
            { icon: "fa-hotel", text: "Khách sạn Ocean Light (3 sao) - Cách biển: 800m" }
        ];

        let resultIdx = 0;
        function renderResult() {
            if (resultIdx >= results.length) return;
            const resData = results[resultIdx];
            const item = document.createElement("div");
            item.className = "sim-result-item";
            item.style.opacity = 0;
            item.style.transform = "translateY(8px)";
            item.innerHTML = `
                <span class="result-text"><i class="fa-solid ${resData.icon}"></i> ${resData.text}</span>
                <button class="btn-outline-detail" onclick="alert('Hãy đăng nhập để xem thông tin chi tiết địa điểm trên bản đồ')">Xem chi tiết</button>
            `;
            resultList.appendChild(item);

            // Animate fade-in
            setTimeout(() => {
                item.style.transition = "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
                item.style.opacity = 1;
                item.style.transform = "translateY(0)";
            }, 50);

            resultIdx++;
            geoaiSimTimeout = setTimeout(renderResult, 300);
        }

        renderResult();
    }

    typeStep();
}

// Draggable SVG Node helpers for pgRouting Preview
function getSVGCoords(svg, evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 400;
    const y = ((evt.clientY - rect.top) / rect.height) * 200;
    return { x: Math.max(0, Math.min(400, x)), y: Math.max(0, Math.min(200, y)) };
}

// Draggable SVG Node helpers for pgRouting Preview
let isRoutingDemoInitialized = false;
let activeNode = null;
let freshStart = null;
let freshEnd = null;
let svgElement = null;

function getSVGCoords(svg, evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 400;
    const y = ((evt.clientY - rect.top) / rect.height) * 200;
    return { x: Math.max(0, Math.min(400, x)), y: Math.max(0, Math.min(200, y)) };
}

function initDraggableRoutingDemo() {
    const svg = document.querySelector(".routing-svg");
    if (!svg) return;

    svgElement = svg;
    freshStart = document.getElementById("node-start");
    freshEnd = document.getElementById("node-end");

    if (!freshStart || !freshEnd) return;

    // Reset node cursors
    freshStart.style.cursor = "grab";
    freshEnd.style.cursor = "grab";

    if (isRoutingDemoInitialized) {
        // Reset positions to default values on reactivate
        freshStart.setAttribute("cx", 50);
        freshStart.setAttribute("cy", 150);
        freshEnd.setAttribute("cx", 350);
        freshEnd.setAttribute("cy", 50);

        const edge1 = document.getElementById("edge-1");
        const edge2 = document.getElementById("edge-2");
        const edge5 = document.getElementById("edge-5");
        if (edge1) {
            edge1.setAttribute("x1", 50);
            edge1.setAttribute("y1", 150);
        }
        if (edge2) {
            edge2.setAttribute("x1", 50);
            edge2.setAttribute("y1", 150);
        }
        if (edge5) {
            edge5.setAttribute("x2", 350);
            edge5.setAttribute("y2", 50);
        }
        const path = svg.querySelector(".active-route-path");
        if (path) {
            path.setAttribute("d", "M 50 150 L 150 120 L 280 80 L 350 50");
        }
        const overlay = document.querySelector(".sim-distance-overlay");
        if (overlay) {
            overlay.innerHTML = "Distance: 8.4 km (Calculated by Dijkstra)";
        }
        return;
    }

    const onStartDrag = (e) => {
        activeNode = freshStart;
        freshStart.style.cursor = "grabbing";
        e.stopPropagation();
        e.preventDefault();
    };

    const onEndDrag = (e) => {
        activeNode = freshEnd;
        freshEnd.style.cursor = "grabbing";
        e.stopPropagation();
        e.preventDefault();
    };

    // Remove existing inline event listeners by replacing with clones
    const newStart = freshStart.cloneNode(true);
    freshStart.replaceWith(newStart);
    freshStart = newStart;
    freshStart.addEventListener("mousedown", onStartDrag);
    freshStart.addEventListener("touchstart", onStartDrag, { passive: false });

    const newEnd = freshEnd.cloneNode(true);
    freshEnd.replaceWith(newEnd);
    freshEnd = newEnd;
    freshEnd.addEventListener("mousedown", onEndDrag);
    freshEnd.addEventListener("touchstart", onEndDrag, { passive: false });

    // Window level listeners to guarantee smooth tracking
    window.addEventListener("mousemove", handleRoutingMove);
    window.addEventListener("touchmove", handleRoutingMove, { passive: false });
    window.addEventListener("mouseup", handleRoutingEnd);
    window.addEventListener("touchend", handleRoutingEnd);

    isRoutingDemoInitialized = true;
}

function handleRoutingMove(e) {
    if (!activeNode || !svgElement) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;

    const coords = getSVGCoords(svgElement, { clientX, clientY });

    activeNode.setAttribute("cx", coords.x);
    activeNode.setAttribute("cy", coords.y);

    const startX = parseFloat(freshStart.getAttribute("cx"));
    const startY = parseFloat(freshStart.getAttribute("cy"));
    const endX = parseFloat(freshEnd.getAttribute("cx"));
    const endY = parseFloat(freshEnd.getAttribute("cy"));

    if (activeNode === freshStart) {
        const edge1 = document.getElementById("edge-1");
        const edge2 = document.getElementById("edge-2");
        if (edge1) {
            edge1.setAttribute("x1", coords.x);
            edge1.setAttribute("y1", coords.y);
        }
        if (edge2) {
            edge2.setAttribute("x1", coords.x);
            edge2.setAttribute("y1", coords.y);
        }
    } else {
        const edge5 = document.getElementById("edge-5");
        if (edge5) {
            edge5.setAttribute("x2", coords.x);
            edge5.setAttribute("y2", coords.y);
        }
    }

    const path = svgElement.querySelector(".active-route-path");
    if (path) {
        path.setAttribute("d", `M ${startX} ${startY} L 150 120 L 280 80 L ${endX} ${endY}`);
    }

    const seg1 = Math.hypot(startX - 150, startY - 120);
    const seg2 = Math.hypot(150 - 280, 120 - 80);
    const seg3 = Math.hypot(280 - endX, 80 - endY);
    const totalDist = ((seg1 + seg2 + seg3) / 30).toFixed(1);

    const overlay = document.querySelector(".sim-distance-overlay");
    if (overlay) {
        overlay.innerHTML = `Distance: ${totalDist} km (Calculated in real-time)`;
    }
}

function handleRoutingEnd() {
    if (activeNode) {
        activeNode.style.cursor = "grab";
        activeNode = null;
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        if (icon && icon.classList.contains("password-toggle-eye")) {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        }
    } else {
        input.type = "password";
        if (icon && icon.classList.contains("password-toggle-eye")) {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    }
}
