const bcrypt = require('bcrypt');
const hash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
const pass = 'password';

console.log('Testing existing hash...');
bcrypt.compare(pass, hash).then(res => {
    console.log('Match with existing hash:', res);
    if (!res) {
        console.log('Generating new compatible hash...');
        bcrypt.hash(pass, 10).then(newHash => {
            console.log('New Hash for "password":', newHash);
        });
    }
}).catch(err => {
    console.error('Error comparing:', err);
});
