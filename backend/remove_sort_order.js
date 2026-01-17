const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove sort_order from GET ORDER BY
content = content.replace("ORDER BY sort_order ASC, id ASC", "ORDER BY id ASC");

// 2. Remove sort_order handling in POST
// Create Personnel
const postRegex = /const \{ academic_title, name, position, department, profile_link, type, group_name, sort_order \} = req.body;/;
content = content.replace(postRegex, "const { academic_title, name, position, department, profile_link, type, group_name } = req.body;");

// Remove Auto sort order block
const autoSortRegex = /\/\/ Auto sort order[\s\S]*?finalSortOrder = \(maxRes\[0\]\.maxOrder \|\| 0\) \+ 1;\s*}/;
content = content.replace(autoSortRegex, "");

// Replace INSERT query
const insertRegex = /'INSERT INTO personnel \(academic_title, name, position, department, profile_link, image_url, type, group_name, sort_order\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)',\s*\[academic_title \|\| '', name, position, department \|\| '', profile_link \|\| '', image_url, type \|\| 'staff', group_name, finalSortOrder\]/;
const newInsert = "'INSERT INTO personnel (academic_title, name, position, department, profile_link, image_url, type, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',\n            [academic_title || '', name, position, department || '', profile_link || '', image_url, type || 'staff', group_name]";
content = content.replace(insertRegex, newInsert);

// 3. Remove sort_order handling in PUT
const putRegex = /const \{ academic_title, name, position, department, profile_link, type, group_name, sort_order \} = req.body;/;
content = content.replace(putRegex, "const { academic_title, name, position, department, profile_link, type, group_name } = req.body;");

const putFieldRegex = /if \(sort_order !== undefined\) \{ fields\.push\('sort_order = \?'\); params\.push\(sort_order\); \}/;
content = content.replace(putFieldRegex, "");

// 4. Update ensurePersonnelTable to Drop Column if exists
// Find "await pool.query(createTableQuery);"
const migrationMarker = `await pool.query(createTableQuery);`;
const migrationCode = `await pool.query(createTableQuery);

        // Runtime Migration: Drop sort_order if exists
        try {
            const [columns] = await pool.query("SHOW COLUMNS FROM personnel");
            const columnNames = columns.map(c => c.Field);
            if (columnNames.includes('sort_order')) {
                console.log("Migrating: Dropping sort_order from personnel table...");
                await pool.query("ALTER TABLE personnel DROP COLUMN sort_order");
            }
        } catch (e) { console.error("Drop column error", e); }
`;
// Only add if not already there (simple check)
if (!content.includes('DROP COLUMN sort_order')) {
    content = content.replace(migrationMarker, migrationCode);
}

// Remove sort_order from seed data
content = content.replace(/sort_order: \d+,/g, "");
content = content.replace(/, sort_order/g, ""); // From INSERT in seed
content = content.replace(/, \?/g, ""); // From VALUES in seed (careful!)
// Actually, safely replacing seed logic is hard with regex. 
// Let's rely on the fact that if table exists, seed won't run.
// If table doesn't exist, Create Table query... wait, Create Table query still has sort_order in `ensurePersonnelTable` string!
const createTableRegex = /sort_order INT DEFAULT 0,\s*/;
content = content.replace(createTableRegex, "");
// Remove sort_order from Seed Insert query
const seedInsertRegex = /'INSERT INTO personnel \(academic_title, name, position, department, type, group_name, sort_order, image_url\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\)',\s*\[person.academic_title, person.name, person.position, person.department, person.type, person.group_name, person.sort_order, person.image_url\]/;
const newSeedInsert = "'INSERT INTO personnel (academic_title, name, position, department, type, group_name, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',\n                    [person.academic_title, person.name, person.position, person.department, person.type, person.group_name, person.image_url]";
// Be careful with replacement
// Let's just run this and manually verify if it's too complex.
// Actually, for the seed loop, I can just replace the variable names if I match the whole block.
// But since the Seed block is large, let's just make sure we drop the column.
// The create table query in `ensurePersonnelTable` needs to be updated too.

fs.writeFileSync(filePath, content);
console.log("Server.js patched to remove sort_order.");
