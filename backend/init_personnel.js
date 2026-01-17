const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initPersonnel() {
    console.log('Connecting to database...');
    console.log('Host:', process.env.DB_HOST || 'db');
    console.log('User:', process.env.DB_USER || 'root');
    console.log('DB Name:', process.env.DB_NAME || 'edu_mcru');

    const pool = mysql.createPool({
        host: 'localhost', // Run from host, connect to exposed port
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'root',
        database: process.env.MYSQL_DATABASE || 'edu_mcru',
        port: process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // 1. Create Table if not exists (Basic structure first)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS personnel (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                position VARCHAR(255),
                image_url VARCHAR(255),
                type ENUM('executive', 'lecturer', 'staff') DEFAULT 'staff',
                group_name VARCHAR(100) DEFAULT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await pool.query(createTableQuery);
        console.log("Verified 'personnel' table exists.");

        // 2. Add columns if missing
        const [columns] = await pool.query("SHOW COLUMNS FROM personnel");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('academic_title')) {
            console.log("Migrating: Adding academic_title...");
            await pool.query("ALTER TABLE personnel ADD COLUMN academic_title VARCHAR(100) AFTER id");
        } else {
            console.log("Column 'academic_title' exists.");
        }

        if (!columnNames.includes('department')) {
            console.log("Migrating: Adding department...");
            await pool.query("ALTER TABLE personnel ADD COLUMN department VARCHAR(255) AFTER position");
        } else {
            console.log("Column 'department' exists.");
        }

        // 3. Seed Data Check
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
        } else {
            console.log('Personnel table already has data. Skipping seed.');
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
        console.log('Done.');
    }
}

initPersonnel();
