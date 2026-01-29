// Function to load HTML components
async function loadComponent(elementId, filePath, callback) {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Failed to load ${filePath}`);
        const html = await response.text();
        element.innerHTML = html;
        if (callback) callback();
    } catch (error) {
        console.error(`Error loading ${elementId}:`, error);
    }
}

// Initialize global components
document.addEventListener("DOMContentLoaded", () => {
    // Load Header
    loadComponent("global-header", "components/header.html", () => {
        // After header is loaded

        // Dispatch 'headerLoaded' event so script.js or other scripts can react (e.g., attach mobile menu listeners)
        document.dispatchEvent(new Event('headerLoaded'));

        // Highlight active menu item based on URL
        highlightActiveMenu();
    });

    // Load Footer
    loadComponent("global-footer", "components/footer.html");

    // Load Admin Sidebar
    loadComponent("sidebar", "components/admin_sidebar.html", () => {
        highlightAdminMenu();
    });

    // Load Global Settings (Colors, Fonts, Site Info)
    applyGlobalSettings();
});

function highlightActiveMenu() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPath || (currentPath === "index.html" && href === "#home")) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

function highlightAdminMenu() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const sidebarLinks = document.querySelectorAll(".sidebar-menu a");

    sidebarLinks.forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPath) {
            link.classList.add("active");
        } else {
            // Also check for sub-pages if strictly needed, but basic match is ok
            link.classList.remove("active");
        }
    });
}

async function applyGlobalSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();

        const root = document.documentElement;

        // 1. Theme Colors
        if (settings.theme_primary_color) {
            root.style.setProperty('--primary-color', settings.theme_primary_color);
            // Calculate dark/light variants if possible, or just leave as default for now
            // Simple approach for darker variant: use color-mix (modern browser) or just rely on transparency
            // For compatibility, we might just set primary.
        }
        if (settings.theme_secondary_color) {
            root.style.setProperty('--secondary-color', settings.theme_secondary_color);
        }

        // 2. Fonts
        if (settings.font_main) {
            root.style.setProperty('--font-main', settings.font_main);
        }
        if (settings.font_size_base) {
            root.style.fontSize = settings.font_size_base + 'px';
        }

        // 3. Site Info (Title & Meta) - Only for public pages usually? 
        // Or if we want to prefix admin title?
        // Let's affect document.title if it's "Home" or empty, or append?
        // Current: "บริการ - คณะครุศาสตร์"
        // Let's replace suffix " - คณะครุศาสตร์" or " - CMS Admin" ?
        // Or just set meta description

        if (settings.site_name) {
            // Maybe append to existing title or replace?
            // Simple: document.title += " - " + settings.site_name; 
            // But usually title is static in HTML. 
            // Let's just log it for now or strictly update meta description.
        }

        if (settings.meta_description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = "description";
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = settings.meta_description;
        }

    } catch (e) {
        console.error("Error applying settings:", e);
    }
}
