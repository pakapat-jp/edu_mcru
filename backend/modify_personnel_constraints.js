const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function modifyPersonnelConstraints() {
    console.log('Connecting to database...');

    const pool = mysql.createPool({
        host: 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'root',
        database: process.env.MYSQL_DATABASE || 'edu_mcru',
        port: process.env.DB_PORT || 3306,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Modifying personnel table constraints...');

        // 1. academic_title NOT NULL
        await pool.query("ALTER TABLE personnel MODIFY COLUMN academic_title VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");
        console.log('Verified: academic_title is NOT NULL');

        // 2. name NOT NULL (Already set usually, but reinforcing)
        await pool.query("ALTER TABLE personnel MODIFY COLUMN name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");
        console.log('Verified: name is NOT NULL');

        // 3. position NOT NULL
        await pool.query("ALTER TABLE personnel MODIFY COLUMN position VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");
        console.log('Verified: position is NOT NULL');


    } catch (error) {
        console.error("Error modifying constraints:", error.sqlMessage || error);
    } finally {
        await pool.end();
        console.log('Done.');
    }
}

modifyPersonnelConstraints();
