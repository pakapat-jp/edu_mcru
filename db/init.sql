CREATE DATABASE IF NOT EXISTS edu_mcru;
USE edu_mcru;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO users (username, password, email, role) VALUES 
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@example.com', 'admin');
-- Password is 'password'

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO categories (name) VALUES 
('ข่าวประชาสัมพันธ์'), 
('กิจกรรมคณะ'), 
('ทุนการศึกษา'),
('ประวัติความเป็นมา'),
('ปรัชญา วิสัยทัศน์ พันธกิจ'),
('โครงสร้าง'),
('คณะกรรมการประจำคณะ'),
('ทำเนียบคณบดี'),
('ผู้บริหาร อาจารย์ บุคลากร'),
('แผนการดำเนินงาน'),
('ผลการดำเนินงาน'),
('ประกันคุณภาพการศึกษา'),
('ความโปร่งใส่ (ITA)'),
('หลักสูตร'),
('ศูนย์พัฒนาวิชาชีพครู'),
('โรงเรียนสาธิตอนุบาลทานตะวัน'),
('เอกสารเผยแพร่'),
('บริการ');

-- News Table (Legacy - Consider migrating to articles)
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    image_url VARCHAR(255),
    category_id INT,
    publish_date DATE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Articles Table (New Standard)
CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE COMMENT 'URL friendly alias',
    content LONGTEXT COMMENT 'Stores HTML content including tabs and layouts',
    image_url VARCHAR(255) COMMENT 'Cover image path',
    category_id INT,
    status TINYINT(1) DEFAULT 1 COMMENT '1=Published, 0=Draft, -1=Trash',
    publish_date DATETIME,
    author_id INT,
    gallery_images JSON COMMENT 'JSON Array of image URLs',
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Menus Table
CREATE TABLE IF NOT EXISTS menus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    slug VARCHAR(100),
    type ENUM('link', 'heading') DEFAULT 'link',
    parent_id INT DEFAULT 0,
    url VARCHAR(255),
    sort_order INT DEFAULT 0,
    status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO menus (id, title, slug, type, parent_id, url, sort_order, status) VALUES 
(1, 'หน้าหลัก', 'home', 'link', 0, 'index.html', 1, 1),
(2, 'เกี่ยวกับคณะ', 'about', 'link', 0, '#', 2, 1),
(3, 'ข้อมูลทั่วไป', 'general-info', 'link', 2, '#', 1, 1),
(4, 'ประวัติความเป็นมา', 'history', 'link', 3, 'history.html', 1, 1),
(5, 'ปรัชญา วิสัยทัศน์ พันธกิจ', 'vision', 'link', 3, 'vision.html', 2, 1),
(6, 'การบริหาร', 'administration', 'link', 2, '#', 2, 1),
(7, 'โครงสร้าง', 'structure', 'link', 6, 'structure.html', 1, 1),
(8, 'คณะกรรมการประจำคณะ', 'board', 'link', 6, 'board.html', 2, 1),
(9, 'ทำเนียบคณบดี', 'deans-list', 'link', 6, 'deans_list.html', 3, 1),
(10, 'ผู้บริหาร อาจารย์ บุคลากร', 'personnel', 'link', 6, 'personnel.html', 4, 1),
(11, 'แผนการดำเนินงาน', 'operation-plan', 'link', 2, 'operation_plan.html', 3, 1),
(12, 'ผลการดำเนินงาน', 'operation-results', 'link', 2, 'operation_results.html', 4, 1),
(13, 'ประกันคุณภาพการศึกษา', 'qa', 'link', 2, 'qa.html', 5, 1),
(14, 'ความโปร่งใส่ (ITA)', 'ita', 'link', 2, 'ita.html', 6, 1),
(15, 'หลักสูตร', 'courses', 'link', 0, 'courses.html', 3, 1),
(16, 'หน่วยงาน', 'departments', 'link', 0, '#', 4, 1),
(17, 'ศูนย์พัฒนาวิชาชีพครู', 'teacher-pro-dev', 'link', 16, 'teacher_pro_dev.html', 1, 1),
(18, 'โรงเรียนสาธิตอนุบาลทานตะวัน', 'thantawan-school', 'link', 16, 'thantawan_school.html', 2, 1),
(19, 'เอกสารเผยแพร่', 'documents', 'link', 0, 'documents.html', 5, 1),
(20, 'บริการ', 'services', 'link', 0, 'services.html', 6, 1),
(21, 'ติดต่อเรา', 'contact', 'link', 0, '#contact', 7, 1);

-- Site Settings Table (Key-Value)
CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    setting_group VARCHAR(50)
);

INSERT IGNORE INTO site_settings (setting_key, setting_value, setting_group) VALUES 
('site_name', 'คณะครุศาสตร์ มหาวิทยาลัยราชภัฏหมู่บ้านจอมบึง', 'general'),
('meta_description', 'เว็บไซต์คณะครุศาสตร์ MCRU', 'general'),
('site_offline', '0', 'general'),
('theme_primary_color', '#2255a4', 'theme'),
('theme_secondary_color', '#ffc107', 'theme'),
('font_main', 'Kanit', 'theme');

-- Media Table
CREATE TABLE IF NOT EXISTS media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    is_folder BOOLEAN DEFAULT FALSE,
    parent_id INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hero Sliders Table
CREATE TABLE IF NOT EXISTS hero_sliders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    button_text VARCHAR(100),
    button_link VARCHAR(255),
    overlay_enabled BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO hero_sliders (image_url, title, subtitle, button_text, button_link, overlay_enabled, sort_order, is_active) VALUES 
('https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80', 'ครุศาสตร์ สร้างครู ครูสร้างชาติเพื่อการพัฒนาที่ยั่งยืน', 'คณะครุศาสตร์ มหาวิทยาลัยราชภัฏหมู่บ้านจอมบึง', 'หลักสูตร', 'courses.html', true, 1, true),
('https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80', '', '', '', '', true, 2, true);
