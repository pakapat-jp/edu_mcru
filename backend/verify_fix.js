const mysql = require('mysql2/promise');
require('dotenv').config();

async function verify() {
    console.log('Verifying site_settings table...');

    // Try connection
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'edu_mcru'
    };

    let connection;
    try {
        // Try localhost first since we are running potentially on host
        connection = await mysql.createConnection(dbConfig);
    } catch (e) {
        console.log('Localhost failed, trying db host (if in docker)...');
        try {
            dbConfig.host = 'db';
            connection = await mysql.createConnection(dbConfig);
        } catch (e2) {
            console.error('Could not connect to DB:', e2.message);
            return;
        }
    }

    try {
        // 1. Check if table exists
        const [tables] = await connection.query("SHOW TABLES LIKE 'site_settings'");
        if (tables.length === 0) {
            console.error("FAIL: Table 'site_settings' does not exist.");
            return;
        }
        console.log("SUCCESS: Table 'site_settings' exists.");

        // 2. Try INSERT/UPDATE
        await connection.query("INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?", ['test_check', 'passed', 'passed']);
        console.log("SUCCESS: Inserted test value.");

        // 3. Try SELECT
        const [rows] = await connection.query("SELECT * FROM site_settings WHERE setting_key = 'test_check'");
        if (rows.length > 0 && rows[0].setting_value === 'passed') {
            console.log("SUCCESS: Retrieved test value correctly.");
        } else {
            console.error("FAIL: Retrieved value mismatch or empty.");
        }

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        if (connection) await connection.end();
    }
}

verify();
