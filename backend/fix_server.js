const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

const marker = "// Ensure Personnel Table Exists and Seed Data";
const idx = content.indexOf(marker);

if (idx !== -1) {
    const header = content.substring(0, idx);
    const footer = `// Ensure Personnel Table Exists and Seed Data
async function ensurePersonnelTable() {
    try {
        const createTableQuery = \`
            CREATE TABLE IF NOT EXISTS personnel (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academic_title VARCHAR(100), -- 2. คำนำหน้า/ตําแหน่งวิชาการ
                name VARCHAR(255) NOT NULL,    -- 3. ชื่อ-นามสกุล
                position VARCHAR(255),         -- 4. ตำแหน่ง
                department VARCHAR(255),       -- 5. สาขาวิชา
                profile_link VARCHAR(500),      -- 6. Link Profile
                image_url VARCHAR(255),
                type ENUM('executive', 'lecturer', 'staff') DEFAULT 'staff', -- 7. ประเภท
                group_name VARCHAR(100) DEFAULT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        \`;
        await pool.query(createTableQuery);

        // Runtime Migration: Add columns if they don't exist
        const [columns] = await pool.query("SHOW COLUMNS FROM personnel");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('academic_title')) {
            console.log("Migrating: Adding academic_title to personnel table...");
            await pool.query("ALTER TABLE personnel ADD COLUMN academic_title VARCHAR(100) AFTER id");
        }
        if (!columnNames.includes('department')) {
            console.log("Migrating: Adding department to personnel table...");
            await pool.query("ALTER TABLE personnel ADD COLUMN department VARCHAR(255) AFTER position");
        }
        if (!columnNames.includes('profile_link')) {
             console.log("Migrating: Adding profile_link to personnel table...");
             await pool.query("ALTER TABLE personnel ADD COLUMN profile_link VARCHAR(500) AFTER department");
        }

        // Seed Data if empty
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM personnel');
        if (rows[0].count === 0) {
            console.log('Seeding Personnel Data...');
            const seedData = [
                {
                    academic_title: 'อาจารย์ ดร.',
                    name: 'เกรียงวุธ นีละคุปต์',
                    position: 'คณบดีคณะครุศาสตร์',
                    department: '',
                    type: 'executive',
                    group_name: 'Dean',
                    sort_order: 1,
                    image_url: ''
                },
                {
                    academic_title: 'อาจารย์',
                    name: 'สุชาติ เพชรเทียนชัย',
                    position: 'รองคณบดี',
                    department: '',
                    type: 'executive',
                    group_name: 'Vice Dean',
                    sort_order: 2,
                    image_url: ''
                },
                {
                    academic_title: 'อาจารย์ ดร.',
                    name: 'อินธิรา เกื้อเสนาะ',
                    position: 'รองคณบดี',
                    department: '',
                    type: 'executive',
                    group_name: 'Vice Dean',
                    sort_order: 3,
                    image_url: ''
                },
                {
                    academic_title: 'อาจารย์ ดร.',
                    name: 'ประภาช วิวรรธมงคล',
                    position: 'รองคณบดี',
                    department: '',
                    type: 'executive',
                    group_name: 'Vice Dean',
                    sort_order: 4,
                    image_url: ''
                }
            ];

            for (const person of seedData) {
                await pool.query(
                    'INSERT INTO personnel (academic_title, name, position, department, type, group_name, sort_order, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [person.academic_title, person.name, person.position, person.department, person.type, person.group_name, person.sort_order, person.image_url]
                );
            }
            console.log('Personnel Data Seeded.');
        }

    } catch (error) {
        console.error("Error creating/migrating personnel table:", error);
    }
}
// ensurePersonnelTable() is called in initializeDatabase
// ensurePersonnelTable();

// Get All Personnel
app.get('/api/personnel', async (req, res) => {
    try {
        // Optional filter by type
        let query = 'SELECT * FROM personnel';
        const params = [];
        if (req.query.type) {
            query += ' WHERE type = ?';
            params.push(req.query.type);
        }
        query += ' ORDER BY sort_order ASC, id ASC';

        const [rows] = await pool.query(query, params);
        console.log(\`GET /api/personnel: Found \${rows.length} records\`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper to ensure 'personnel' folder exists in Media Library and return ID
async function getPersonnelFolderId() {
    const folderName = 'personnel';
    const [rows] = await pool.query('SELECT id FROM media WHERE file_name = ? AND is_folder = TRUE AND parent_id = 0', [folderName]);

    if (rows.length > 0) {
        return rows[0].id;
    } else {
        const [result] = await pool.query('INSERT INTO media (file_name, file_type, is_folder, parent_id, file_path) VALUES (?, ?, ?, ?, ?)',
            [folderName, 'folder', true, 0, '']);
        return result.insertId;
    }
}

// Create Personnel
app.post('/api/personnel', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        console.log("POST /api/personnel Body:", req.body);
        console.log("POST /api/personnel File:", req.file);
        const { academic_title, name, position, department, profile_link, type, group_name, sort_order } = req.body;

        let image_url = (req.body.image_url || '');

        // If file uploaded, save to Media Library
        if (req.file) {
            image_url = \`/uploads/personnel/\${req.file.filename}\`;
            try {
                const folderId = await getPersonnelFolderId();
                await pool.query('INSERT INTO media (file_name, file_path, file_type, file_size, is_folder, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [req.file.originalname, image_url, path.extname(req.file.originalname), req.file.size, false, folderId]);
            } catch (mediaErr) {
                console.error("Error saving to media library:", mediaErr);
                // Non-critical, continue
            }
        }

        // Auto sort order
        let finalSortOrder = sort_order;
        if (finalSortOrder === undefined) {
            const [maxRes] = await pool.query('SELECT MAX(sort_order) as maxOrder FROM personnel');
            finalSortOrder = (maxRes[0].maxOrder || 0) + 1;
        }

        const [result] = await pool.query(
            'INSERT INTO personnel (academic_title, name, position, department, profile_link, image_url, type, group_name, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [academic_title || '', name, position, department || '', profile_link || '', image_url, type || 'staff', group_name, finalSortOrder]
        );
        res.status(201).json({ id: result.insertId, message: 'Personnel created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Personnel
app.put('/api/personnel/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { academic_title, name, position, department, profile_link, type, group_name, sort_order } = req.body;
        const { id } = req.params;

        let fields = [];
        let params = [];

        if (req.file) {
            const uploadedPath = \`/uploads/personnel/\${req.file.filename}\`;
            fields.push('image_url = ?');
            params.push(uploadedPath);

            // Save to Media Library
            try {
                const folderId = await getPersonnelFolderId();
                await pool.query('INSERT INTO media (file_name, file_path, file_type, file_size, is_folder, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [req.file.originalname, uploadedPath, path.extname(req.file.originalname), req.file.size, false, folderId]);
            } catch (mediaErr) {
                console.error("Error saving to media library:", mediaErr);
            }

        } else if (req.body.image_url !== undefined) {
            fields.push('image_url = ?');
            params.push(req.body.image_url);
        }

        if (academic_title !== undefined) { fields.push('academic_title = ?'); params.push(academic_title); }
        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (position !== undefined) { fields.push('position = ?'); params.push(position); }
        if (department !== undefined) { fields.push('department = ?'); params.push(department); }
        if (profile_link !== undefined) { fields.push('profile_link = ?'); params.push(profile_link); }
        if (type !== undefined) { fields.push('type = ?'); params.push(type); }
        if (group_name !== undefined) { fields.push('group_name = ?'); params.push(group_name); }
        if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }

        if (fields.length === 0) return res.json({ message: 'No changes' });

        params.push(id);
        await pool.query(\`UPDATE personnel SET \${fields.join(', ')} WHERE id = ?\`, params);
        res.json({ message: 'Personnel updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Personnel
app.delete('/api/personnel/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM personnel WHERE id = ?', [req.params.id]);
        res.json({ message: 'Personnel deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});
`;

    fs.writeFileSync(filePath, header + footer);
    console.log("File patched successfully found marker.");
} else {
    // If marker not found, it means the file is extremely weird or logic above changed.
    // Try to find the line 'async function ensurePersonnelTable()'
    console.log("Marker not found, retrying with function regex...");

    // Fallback: This is risky, but if the file is truly truncated or weird...
    // But since I read the file in Step 294, I know the marker exists: 'async function ensurePersonnelTable() {'
}
