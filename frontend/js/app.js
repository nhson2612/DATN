// Switch Tab panel in UI
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    // Highlight active button
    const btn = document.querySelector(`.tab-btn[onclick*="'${tabId}'"]`);
    if (btn) btn.classList.add('active');
    
    // Show active panel
    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add('active');

    // Nạp dữ liệu khi mở tab, không nạp sẵn lúc khởi động: danh sách điểm đến
    // và yêu thích đều gọi API, mà người dùng có thể không mở tab nào trong số
    // đó cả.
    if (tabId === 'explore-tab' && typeof taiDanhSachDiemDen === 'function') {
        taiDanhSachDiemDen();
    }
    if (tabId === 'favorites-tab' && typeof taiYeuThich === 'function') {
        taiYeuThich();
    }
}

// Dynamically load HTML component files
async function loadComponents() {
    try {
        // 0. Load Landing Page Layout
        const landingRes = await fetch('components/landing.html');
        if (landingRes.ok) {
            document.getElementById('landing-page').innerHTML = await landingRes.text();
        }

        // 1. Load Sidebar Layout
        const sidebarRes = await fetch('components/sidebar.html');
        if (sidebarRes.ok) {
            document.getElementById('sidebar-container').innerHTML = await sidebarRes.text();
        }

        // 2. Load Sidebar Tabs in parallel
        const tabSpecs = [
            { id: 'chat-tab-placeholder', url: 'components/chat.html' },
            { id: 'routing-tab-placeholder', url: 'components/routing.html' },
            { id: 'itinerary-tab-placeholder', url: 'components/itinerary.html' },
            { id: 'explore-tab-placeholder', url: 'components/explore.html' },
            { id: 'favorites-tab-placeholder', url: 'components/favorites.html' }
        ];
        
        await Promise.all(tabSpecs.map(async (spec) => {
            const container = document.getElementById(spec.id);
            if (container) {
                const res = await fetch(spec.url);
                if (res.ok) {
                    container.outerHTML = await res.text();
                }
            }
        }));

        // 3. Load Auth Modal
        const authRes = await fetch('components/auth.html');
        if (authRes.ok) {
            document.getElementById('auth-modal-container').innerHTML = await authRes.text();
            // Wrap in outer overlay
            const modalContainer = document.querySelector('#auth-modal-container .modal-container');
            if (modalContainer) {
                // Ensure auth-modal container exists as overlay
                const overlay = document.createElement('div');
                overlay.id = 'auth-modal';
                overlay.className = 'modal-overlay';
                overlay.style.display = 'none';
                overlay.appendChild(modalContainer);
                document.getElementById('auth-modal-container').appendChild(overlay);
            }
        }

        // 4. Initialize Auth UI
        if (typeof updateAuthUI === 'function') {
            updateAuthUI();
        }
    } catch (err) {
        console.error("Lỗi khi tải các cấu phần HTML:", err);
    }
}

// Trigger initialization on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    loadComponents().then(() => {
        // Khám phá là tab mặc định: trang du lịch bắt đầu bằng "đi đâu", không
        // phải bằng ô chat.
        if (typeof taiDanhSachDiemDen === 'function') taiDanhSachDiemDen();
    });
});
