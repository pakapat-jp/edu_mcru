let slideIndex = 1;
let slideInterval;

document.addEventListener('DOMContentLoaded', () => {
    // Start Slider
    if (document.querySelector('.slideshow-container')) {
        loadHeroSliders();
    }

    // Scroll Animations
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right').forEach((el) => observer.observe(el));

    // --- Dynamic Content Loading ---
    if (document.getElementById('news')) loadNewsForHome();
});

// Event Delegation for Mobile Menu (Handles dynamic elements)
document.addEventListener('click', (e) => {
    const mobileMenuTrigger = e.target.closest('#mobile-menu');
    const navLink = e.target.closest('.nav-link');

    if (mobileMenuTrigger) {
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
            navMenu.classList.toggle('active');
            mobileMenuTrigger.classList.toggle('active');
        }
    }

    if (navLink) {
        const navMenu = document.querySelector('.nav-menu');
        const mobileMenu = document.getElementById('mobile-menu');
        if (navMenu) navMenu.classList.remove('active');
        if (mobileMenu) mobileMenu.classList.remove('active');
    }
});

// Listen for the custom 'headerLoaded' event from global-loader.js
document.addEventListener('headerLoaded', () => {
    loadMenus();
});

// --- Dynamic Functions ---

async function loadMenus() {
    try {
        const res = await fetch('/api/menus');
        if (!res.ok) return;
        const menus = await res.json();
        const navMenu = document.querySelector('.nav-menu');

        // Filter visible menus and sort
        const visibleMenus = menus.filter(m => m.status === 1).sort((a, b) => a.sort_order - b.sort_order);

        // Build Tree
        const buildMenuParams = (parentId) => {
            return visibleMenus.filter(m => m.parent_id === parentId).map(m => {
                const children = buildMenuParams(m.id);
                return { ...m, children };
            });
        };
        const tree = buildMenuParams(0);

        // Recursive Render
        const renderMenuItem = (item, level = 0) => {
            const hasChildren = item.children.length > 0;

            if (level === 0) {
                // Top Level
                if (hasChildren) {
                    return `
                        <li class="dropdown">
                            <a href="${item.url}" class="nav-link">${item.title} <i class="fa-solid fa-chevron-down"></i></a>
                            <ul class="dropdown-menu">
                                ${item.children.map(child => renderMenuItem(child, level + 1)).join('')}
                            </ul>
                        </li>
                    `;
                } else {
                    return `<li><a href="${item.url}" class="nav-link">${item.title}</a></li>`;
                }
            } else {
                // Sub Levels
                if (hasChildren) {
                    return `
                        <li class="dropdown-submenu">
                            <a href="${item.url}" class="dropdown-item dropdown-submenu-toggle">${item.title}</a>
                            <ul class="dropdown-menu">
                                ${item.children.map(child => renderMenuItem(child, level + 1)).join('')}
                            </ul>
                        </li>
                    `;
                } else {
                    return `<li><a href="${item.url}">${item.title}</a></li>`;
                }
            }
        };

        navMenu.innerHTML = tree.map(item => renderMenuItem(item)).join('');

    } catch (e) { console.error('Error loading menus:', e); }
}

async function loadNewsForHome() {
    try {
        // Fetch Categories first
        const catRes = await fetch('/api/categories');
        if (!catRes.ok) return;
        const categoriesData = await catRes.json();
        // Filter out 'เมนู'
        const categories = categoriesData.filter(c => c.name !== 'เมนู');

        // Fetch News
        const newsRes = await fetch('/api/news');
        if (!newsRes.ok) return;
        const allNews = await newsRes.json();

        // Containers
        const tabButtonsContainer = document.getElementById('news-tab-buttons');
        const tabContentContainer = document.getElementById('news-tab-content');

        if (!tabButtonsContainer || !tabContentContainer) return;

        // Clear
        tabButtonsContainer.innerHTML = '';
        tabContentContainer.innerHTML = '';

        // Generate Tabs and Content
        categories.forEach((cat, index) => {
            // Create Tab Button
            const btn = document.createElement('button');
            btn.className = `tab-btn ${index === 0 ? 'active' : ''}`;
            // Use cat.id or name as unique key for 'onclick'
            // We'll attach logic via JS instead of inline onclick to be safer with ID strings
            btn.innerText = cat.name;
            btn.onclick = (e) => openTab(e, `cat-${cat.id}`);
            tabButtonsContainer.appendChild(btn);

            // Create Content Div
            const contentDiv = document.createElement('div');
            contentDiv.id = `cat-${cat.id}`;
            contentDiv.className = 'tab-content';
            contentDiv.style.display = index === 0 ? 'block' : 'none';

            // Filter News for this Category
            const filteredNews = allNews.filter(n => n.category_id === cat.id); // Assuming news object has category_id from join or raw
            // Note: Server GET /api/news returns `category_name` and `category_id` (from join? Wait, check server.js)
            // Server query: SELECT news.*, categories.name as category_name ...
            // So `news.category_id` is present if `news.*` includes it. Yes, it should.

            let newsHtml = '';
            if (filteredNews.length === 0) {
                newsHtml = '<p class="text-center" style="grid-column: 1/-1; padding: 20px;">ไม่มีข่าวในหมวดหมู่นี้</p>';
            } else {
                newsHtml = filteredNews.slice(0, 6).map(n => {
                    const date = new Date(n.publish_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                    const img = n.image_url ? (n.image_url.startsWith('http') || n.image_url.startsWith('/') ? n.image_url : `/${n.image_url}`) : 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=500&q=60';

                    return `
                        <div class="card">
                            <div class="card-img" style="background-image: url('${img}');"></div>
                            <div class="card-body">
                                <div style="margin-bottom: 10px;">
                                    <span class="news-date"><i class="fa-regular fa-calendar"></i> ${date}</span>
                                    <span class="news-category"><i class="fa-solid fa-tag"></i> ${n.category_name || 'ทั่วไป'}</span>
                                </div>
                                <h4>${n.title}</h4>
                                <p>${n.content.replace(/<[^>]*>/g, '').substring(0, 80)}...</p>
                                <a href="news-detail.html?id=${n.id}" class="read-more">อ่านต่อ <i class="fa-solid fa-arrow-right"></i></a>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            contentDiv.innerHTML = `<div class="grid-3">${newsHtml}</div>`;
            tabContentContainer.appendChild(contentDiv);
        });

    } catch (e) { console.error('Error loading news:', e); }
}

async function loadHeroSliders() {
    try {
        const res = await fetch('/api/hero-sliders?active=true');
        if (!res.ok) return; // If API fails, maybe fallback to static or do nothing
        const sliders = await res.json();
        const container = document.querySelector('.slideshow-container');

        if (sliders.length === 0) return; // No sliders, maybe keep static or empty?

        // Clear existing static slides if any (except arrows if they are outside? No, they are inside)
        // Actually, let's keep prev/next buttons if we want to reuse them, or re-render them.
        // The current HTML has prev/next inside container.

        let slidesHtml = '';
        let dotsHtml = '';

        sliders.forEach((slide, index) => {
            const indexPlusOne = index + 1;

            // Slide HTML
            slidesHtml += `
                <div class="slide fade">
                    <img src="${slide.image_url}" alt="${slide.title || 'Slide'}">
                    ${slide.overlay_enabled ? `
                    <div class="hero-overlay">
                        ${slide.title ? `<h2 class="fade-in-up">${slide.title}</h2>` : ''}
                        ${slide.subtitle ? `<p class="fade-in-up" style="transition-delay: 0.2s;">${slide.subtitle}</p>` : ''}
                        
                        ${(slide.button_text && slide.button_link) ? `
                        <div class="hero-buttons fade-in-up" style="transition-delay: 0.4s;">
                            <a href="${slide.button_link}" class="btn btn-primary">${slide.button_text}</a>
                        </div>` : ''}
                    </div>
                    ` : ''}
                </div>
            `;

            // Dot HTML
            dotsHtml += `<span class="dot" onclick="currentSlide(${indexPlusOne})"></span>`;
        });

        // Add Controls
        const controlsHtml = `
            <a class="prev" onclick="plusSlides(-1)">&#10094;</a>
            <a class="next" onclick="plusSlides(1)">&#10095;</a>
            <div class="dots-container">
                ${dotsHtml}
            </div>
        `;

        container.innerHTML = slidesHtml + controlsHtml;

        // Re-attach Observer for Animations
        const observerOptions = { threshold: 0.1 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, observerOptions);
        container.querySelectorAll('.fade-in-up').forEach((el) => observer.observe(el));

        // Restart Slider Logic
        slideIndex = 1;
        showSlides(slideIndex);
        startAutoSlide();

    } catch (e) {
        console.error("Error loading sliders:", e);
    }
}

// --- Helper Functions ---
function plusSlides(n) { showSlides(slideIndex += n); resetInterval(); }
function currentSlide(n) { showSlides(slideIndex = n); resetInterval(); }

function showSlides(n) {
    let i;
    let slides = document.getElementsByClassName("slide");
    let dots = document.getElementsByClassName("dot");
    if (slides.length === 0) return;

    if (n > slides.length) { slideIndex = 1 }
    if (n < 1) { slideIndex = slides.length }
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
        slides[i].classList.remove('active');
    }
    for (i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
    }
    if (slides[slideIndex - 1]) {
        slides[slideIndex - 1].style.display = "block";
        slides[slideIndex - 1].classList.add('active');
    }
    if (dots.length > 0) dots[slideIndex - 1].className += " active";
}

function openTab(evt, tabName) {
    let i, tabContent, tabBtn;
    tabContent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabContent.length; i++) {
        tabContent[i].style.display = "none";
    }
    tabBtn = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tabBtn.length; i++) {
        tabBtn[i].className = tabBtn[i].className.replace(" active", "");
    }
    const target = document.getElementById(tabName);
    if (target) target.style.display = "block";
    if (evt) evt.currentTarget.className += " active";
}

function startAutoSlide() { slideInterval = setInterval(() => { plusSlides(1); }, 5000); }
function resetInterval() { clearInterval(slideInterval); startAutoSlide(); }

// Load dynamic page content based on Category Name
async function loadPageContent(categoryName, containerId = 'content-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-center">กำลังโหลดข้อมูล...</p>';

        // Fetch all news
        const res = await fetch(`/api/news?status=1`); // Assuming we might add status filter in future, currently client-side filter
        if (!res.ok) throw new Error('API Error');

        const allNews = await res.json();

        // Filter by Category ID = 10 (Menu) and match Title
        // Taking the latest one
        const article = allNews
            .filter(n => n.category_id == 10 && n.title === categoryName && n.status == 1)
            .sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date))[0];

        if (article) {
            const date = new Date(article.publish_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

            let html = `
                <div class="page-article">
                    <h1 class="section-title" style="margin-bottom: 10px;">${article.title}</h1>
                    <div class="meta" style="color:#666; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                        <span><i class="fa-regular fa-calendar"></i> ${date}</span>
                        <span style="margin-left: 15px;"><i class="fa-regular fa-user"></i> ${article.author_name || 'Admin'}</span>
                    </div>
                    
                    ${article.image_url ? `<img src="${article.image_url}" style="width:100%; max-height:500px; object-fit:cover; border-radius:8px; margin-bottom:20px;" alt="${article.title}">` : ''}

                    <div class="content">
                        ${article.content}
                    </div>
                </div>
            `;
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px; background: #f9f9f9; border-radius: 8px;">
                    <i class="fa-regular fa-file-lines" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                    <h3>ยังไม่มีข้อมูลในส่วนนี้</h3>
                    <p>ผู้ดูแลระบบอยู่ระหว่างการปรับปรุงข้อมูล (หมวดหมู่: ${categoryName})</p>
                </div>
            `;
        }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-center">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}
// Accordion Functionality for Custom Content
document.addEventListener('click', function (e) {
    if (e.target && e.target.closest('.custom-accordion-header')) {
        const header = e.target.closest('.custom-accordion-header');
        const content = header.nextElementSibling;

        // Toggle Active Class
        header.classList.toggle('active');

        // Toggle Content Visibility
        if (content.style.display === "block") {
            content.style.display = "none";
        } else {
            content.style.display = "block";
        }
    }
});
