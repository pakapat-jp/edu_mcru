const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetPassword() {
    console.log('Attempting to reset admin password...');

    const dbConfig = {
        host: process.env.DB_HOST || 'localhost', // Default to localhost for manual run, 'db' for container usually needs env or arg
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_NAME || 'edu_mcru',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    // Adjust host if running inside container without env vars being passed explicitly to this script (though dotenv should pick up .env if present)
    // Actually, in docker-compose exec, env vars for the service are usually available.
    // If running locally, we might need to change host to localhost manually if .env isn't set.

    // Check if we can connect
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log(`Connected to database at ${dbConfig.host}`);
    } catch (error) {
        console.error('Failed to connect with default config:', error.message);
        if (dbConfig.host === 'db') {
            console.log('Trying localhost...');
            dbConfig.host = 'localhost';
            try {
                connection = await mysql.createConnection(dbConfig);
                console.log('Connected to database at localhost');
            } catch (retryError) {
                console.error('Failed to connect to localhost:', retryError.message);
                process.exit(1);
            }
        } else {
            console.log('Trying "db" host...');
            dbConfig.host = 'db';
            try {
                connection = await mysql.createConnection(dbConfig);
                console.log('Connected to database at db');
            } catch (retryError) {
                console.error('Failed to connect to db:', retryError.message);
                process.exit(1);
            }
        }
    }

    try {
        const password = 'password';
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(`Generated new hash for '${password}'`);

        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE username = ?',
            [hashedPassword, 'admin']
        );

        if (result.affectedRows > 0) {
            console.log('SUCCESS: Admin password reset to "password"');
        } else {
            console.log('WARNING: Admin user not found. Creating it...');
            await connection.execute(
                'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)',
                ['admin', hashedPassword, 'admin@example.com', 'admin']
            );
            console.log('SUCCESS: Admin user created with password "password"');
        }

    } catch (error) {
        console.error('Error updating password:', error);
    } finally {
        if (connection) await connection.end();
    }
}

resetPassword();
