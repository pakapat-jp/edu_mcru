const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Database Connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'edu_mcru',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Automatic Migration for published_at
// Automatic Migration for publish_date (and recovery from published_at)
// Automatic Migration (Disabled as we are switching to 'articles' table driven by init.sql)
// async function migrateDatabase() { ... }

// Ensure Articles Table Exists and has gallery_images (Runtime Migration)
async function ensureTables() {
    try {
        const createTableQuery = `
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
            )
        `;
        await pool.query(createTableQuery);

        // Check for gallery_images column and add if missing
        const [columns] = await pool.query("SHOW COLUMNS FROM articles LIKE 'gallery_images'");
        if (columns.length === 0) {
            console.log("Migrating: Adding gallery_images to articles table...");
            await pool.query("ALTER TABLE articles ADD COLUMN gallery_images JSON COMMENT 'JSON Array of image URLs' AFTER author_id");
        }

        // Hero Sliders Table
        const createSlidersTableQuery = `
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
            )
        `;
        await pool.query(createSlidersTableQuery);

        console.log("Verified 'articles' table schemas.");
    } catch (error) {
        console.error("Error creating/migrating articles table:", error);
    }
}
ensureTables();

// Setup DB Route
app.get('/api/setup-db', async (req, res) => {
    try {
        await ensureTables();
        res.json({ message: 'Database setup verified.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Multer Setup for Image Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'gallery', maxCount: 20 }
]);

// Routes

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(400).json({ message: 'User not found' });

        const user = rows[0];
        // Note: For existing PHP/Laravel bcrypt hashes, this usually works.
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- News ---

// Get All News
app.get('/api/news', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT articles.*, categories.name as category_name, users.username as author_name 
            FROM articles 
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN users ON articles.author_id = users.id
            ORDER BY COALESCE(articles.publish_date, articles.created_at) DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Single News
app.get('/api/news/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT articles.*, categories.name as category_name, users.username as author_name 
            FROM articles 
            LEFT JOIN categories ON articles.category_id = categories.id
            LEFT JOIN users ON articles.author_id = users.id
            WHERE articles.id = ?
        `, [req.params.id]);

        if (rows.length === 0) return res.status(404).json({ message: 'News not found' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/news', authenticateToken, uploadFields, async (req, res) => {
    const { title, content, category_id, publish_date, status, slug, image_url: bodyImageUrl } = req.body;

    // Main Cover Image
    const image_url = (req.files && req.files['image']) ? `/uploads/${req.files['image'][0].filename}` : (bodyImageUrl || null);

    // Gallery Images
    let gallery_images = [];
    if (req.files && req.files['gallery']) {
        gallery_images = req.files['gallery'].map(file => `/uploads/${file.filename}`);
    }
    const galleryJson = JSON.stringify(gallery_images);

    const author_id = req.user.id;

    // Simple slug generation if not provided
    const finalSlug = slug || title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now();

    try {
        const [result] = await pool.query(
            'INSERT INTO articles (title, slug, content, image_url, category_id, publish_date, status, author_id, gallery_images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, finalSlug, content, image_url, category_id, publish_date || new Date(), status || 1, author_id, galleryJson]
        );
        res.status(201).json({ id: result.insertId, message: 'Article created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update News
app.put('/api/news/:id', authenticateToken, uploadFields, async (req, res) => {
    const { title, content, category_id, publish_date, status, slug } = req.body;
    const { id } = req.params;

    try {
        let query = 'UPDATE articles SET title = ?, content = ?, category_id = ?, publish_date = ?, status = ?';
        let params = [title, content, category_id, publish_date, status || 1];

        if (slug) {
            query += ', slug = ?';
            params.push(slug);
        }

        // Handle Main Image
        if (req.files && req.files['image']) {
            query += ', image_url = ?';
            params.push(`/uploads/${req.files['image'][0].filename}`);
        } else if (req.body.image_url !== undefined) {
            query += ', image_url = ?';
            params.push(req.body.image_url);
        }

        // Handle Gallery
        // Strategy: We get 'existing_gallery' (JSON string of kept URLs) from body, 
        // and new files from req.files['gallery']. We merge them.
        let finalGallery = [];

        // 1. Existing
        if (req.body.existing_gallery_images) {
            try {
                finalGallery = JSON.parse(req.body.existing_gallery_images);
                if (!Array.isArray(finalGallery)) finalGallery = [];
            } catch (e) {
                finalGallery = [];
            }
        }

        // 2. New Uploads
        if (req.files && req.files['gallery']) {
            const newPaths = req.files['gallery'].map(file => `/uploads/${file.filename}`);
            finalGallery = [...finalGallery, ...newPaths];
        }

        // 3. Update if changed (always update because logic complex to detect no-change in strict sense, safe to overwrite with current state)
        // Check if we effectively want to update gallery (did frontend send existing_gallery_images? if so, it implies an intent to manage gallery)
        // If frontend didn't send existing_gallery_images, maybe we shouldn't wipe it? 
        // BUT: FormData always sends fields if appended. If empty, it sends empty string.
        // Let's assume frontend ALWAYS sends existing_gallery_images if it supports gallery management.
        if (req.body.existing_gallery_images !== undefined) {
            query += ', gallery_images = ?';
            params.push(JSON.stringify(finalGallery));
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);
        res.json({ message: 'Article updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete News
app.delete('/api/news/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM articles WHERE id = ?', [req.params.id]);
        res.json({ message: 'Article deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Categories ---

app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Menus ---
app.get('/api/menus', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM menus ORDER BY sort_order ASC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/menus', authenticateToken, async (req, res) => {
    try {
        const { title, slug, type, parent_id, url } = req.body;
        // Auto calculate sort_order: max + 1
        const [maxRes] = await pool.query('SELECT MAX(sort_order) as maxOrder FROM menus');
        const sort_order = (maxRes[0].maxOrder || 0) + 1;

        const [result] = await pool.query(
            'INSERT INTO menus (title, slug, type, parent_id, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [title, slug, type, parent_id || 0, url, sort_order]
        );
        res.status(201).json({ id: result.insertId, message: 'Menu created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/menus/:id', authenticateToken, async (req, res) => {
    try {
        const { title, slug, type, parent_id, url, status, sort_order } = req.body;
        // Dynamic update
        let fields = [];
        let params = [];
        if (title !== undefined) { fields.push('title = ?'); params.push(title); }
        if (slug !== undefined) { fields.push('slug = ?'); params.push(slug); }
        if (type !== undefined) { fields.push('type = ?'); params.push(type); }
        if (parent_id !== undefined) { fields.push('parent_id = ?'); params.push(parent_id); }
        if (url !== undefined) { fields.push('url = ?'); params.push(url); }
        if (status !== undefined) { fields.push('status = ?'); params.push(status); }
        if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }

        if (fields.length === 0) return res.json({ message: 'No changes' });

        params.push(req.params.id);
        await pool.query(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Menu updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/menus/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM menus WHERE id = ?', [req.params.id]);
        res.json({ message: 'Menu deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Hero Sliders ---
app.get('/api/hero-sliders', async (req, res) => {
    try {
        // Only active sliders for public? Or all for admin? 
        // Let's return all and let frontend filter if needed, 
        // or add query param ?active=true
        let query = 'SELECT * FROM hero_sliders';
        let params = [];
        if (req.query.active === 'true') {
            query += ' WHERE is_active = TRUE';
        }
        query += ' ORDER BY sort_order ASC, created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/hero-sliders', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, button_text, button_link, overlay_enabled, sort_order, is_active } = req.body;

        if (!req.file && !req.body.image_url) {
            return res.status(400).json({ message: 'Image is required' });
        }

        const image_url = (req.file) ? `/uploads/${req.file.filename}` : req.body.image_url;

        // Auto sort order
        let finalSortOrder = sort_order;
        if (finalSortOrder === undefined) {
            const [maxRes] = await pool.query('SELECT MAX(sort_order) as maxOrder FROM hero_sliders');
            finalSortOrder = (maxRes[0].maxOrder || 0) + 1;
        }

        // Fix boolean parsing from FormData (strings 'true'/'false')
        const overlayBool = overlay_enabled === 'true' || overlay_enabled === true || overlay_enabled === '1';
        const activeBool = (is_active === undefined) ? true : (is_active === 'true' || is_active === true || is_active === '1');

        const [result] = await pool.query(
            'INSERT INTO hero_sliders (image_url, title, subtitle, button_text, button_link, overlay_enabled, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [image_url, title, subtitle, button_text, button_link, overlayBool, finalSortOrder, activeBool]
        );
        res.status(201).json({ id: result.insertId, message: 'Slider created', image_url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/hero-sliders/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { title, subtitle, button_text, button_link, overlay_enabled, sort_order, is_active } = req.body;
        const { id } = req.params;

        let fields = [];
        let params = [];

        if (req.file) {
            fields.push('image_url = ?');
            params.push(`/uploads/${req.file.filename}`);
        } else if (req.body.image_url) {
            fields.push('image_url = ?');
            params.push(req.body.image_url);
        }
        if (title !== undefined) { fields.push('title = ?'); params.push(title); }
        if (subtitle !== undefined) { fields.push('subtitle = ?'); params.push(subtitle); }
        if (button_text !== undefined) { fields.push('button_text = ?'); params.push(button_text); }
        if (button_link !== undefined) { fields.push('button_link = ?'); params.push(button_link); }
        if (overlay_enabled !== undefined) {
            fields.push('overlay_enabled = ?');
            params.push(overlay_enabled === 'true' || overlay_enabled === true || overlay_enabled === '1');
        }
        if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }
        if (is_active !== undefined) {
            fields.push('is_active = ?');
            params.push(is_active === 'true' || is_active === true || is_active === '1');
        }

        if (fields.length === 0) return res.json({ message: 'No changes' });

        params.push(id);
        await pool.query(`UPDATE hero_sliders SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Slider updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/hero-sliders/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM hero_sliders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Slider deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM site_settings');
        // Convert to object { key: value }
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
    try {
        const settings = req.body; // Expect { key: value, key2: value2 }
        const promises = Object.keys(settings).map(key => {
            return pool.query(
                'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [key, settings[key], settings[key]]
            );
        });
        await Promise.all(promises);
        res.json({ message: 'Settings saved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Assets (Physical Folder) ---
app.get('/api/assets-list', (req, res) => {
    const assetsDir = path.join(__dirname, '../assets');
    fs.readdir(assetsDir, (err, files) => {
        if (err) {
            console.error(err);
            // If folder doesn't exist, return empty
            return res.json([]);
        }
        // Filter for images
        const images = files.filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file));
        const fileList = images.map(img => ({
            name: img,
            path: `assets/${img}`,
            type: 'file'
        }));
        res.json(fileList);
    });
});

// --- Media ---
app.get('/api/media', async (req, res) => {
    const parentId = req.query.parent_id || 0;
    try {
        const [rows] = await pool.query('SELECT * FROM media WHERE parent_id = ? ORDER BY is_folder DESC, file_name ASC', [parentId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/media/folder', authenticateToken, async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        await pool.query('INSERT INTO media (file_name, file_type, is_folder, parent_id, file_path) VALUES (?, ?, ?, ?, ?)',
            [name, 'folder', true, parent_id || 0, '']);
        res.json({ message: 'Folder created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { parent_id } = req.body;
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        await pool.query('INSERT INTO media (file_name, file_path, file_type, file_size, is_folder, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
            [req.file.originalname, `/uploads/${req.file.filename}`, path.extname(req.file.originalname), req.file.size, false, parent_id || 0]);

        res.json({ message: 'File uploaded' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
    try {
        // In a real app, you should also delete the actual file from disk
        await pool.query('DELETE FROM media WHERE id = ?', [req.params.id]);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Dashboard Stats ---
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const [newsCount] = await pool.query('SELECT COUNT(*) as count FROM articles');
        const [categoryCount] = await pool.query('SELECT COUNT(*) as count FROM categories');
        const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');

        res.json({
            news_count: newsCount[0].count,
            category_count: categoryCount[0].count,
            user_count: userCount[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize uploads dir
const fs = require('fs');
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// --- User Management ---
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        // Basic validation
        if (!username || !password || !email) return res.status(400).json({ message: 'Missing fields' });

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, email, role || 'user']);

        res.status(201).json({ message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        const { role, email, password } = req.body;
        const { id } = req.params;

        let query = 'UPDATE users SET ';
        const params = [];
        const updates = [];

        if (role) { updates.push('role = ?'); params.push(role); }
        if (email) { updates.push('email = ?'); params.push(email); }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        if (updates.length === 0) return res.json({ message: 'No changes' });

        query += updates.join(', ') + ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);
        res.json({ message: 'User updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        // Prevent deleting self?
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
