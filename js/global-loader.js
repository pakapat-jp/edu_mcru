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
