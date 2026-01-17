const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function reseedPersonnel() {
    console.log('Connecting to database for Reseed...');

    const pool = mysql.createPool({
        host: 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'root',
        database: process.env.MYSQL_DATABASE || 'edu_mcru',
        port: process.env.DB_PORT || 3306,
        charset: 'utf8mb4', // Force UTF-8
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Dropping existing personnel table...');
        await pool.query('DROP TABLE IF EXISTS personnel');

        console.log('Creating personnel table with utf8mb4...');
        const createTableQuery = `
            CREATE TABLE personnel (
                id INT AUTO_INCREMENT PRIMARY KEY,
                academic_title VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
                position VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                department VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                image_url VARCHAR(255),
                type ENUM('executive', 'lecturer', 'staff') DEFAULT 'staff',
                group_name VARCHAR(100) DEFAULT NULL,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `;
        await pool.query(createTableQuery);

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
        console.log('Personnel Data Reseeded Successfully.');

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
        console.log('Done.');
    }
}

reseedPersonnel();
