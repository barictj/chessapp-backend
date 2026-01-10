// scripts/seed_test_user.js
import bcrypt from 'bcryptjs';
import { createUser } from '../src/db/users.js'; // path based on your repo layout

(async () => {
    try {
        const username = 'ci_test';
        const email = 'ci_test@example.com';
        const password = 'ci_test_password';

        // hash password with bcrypt (10 rounds)
        const passwordHash = bcrypt.hashSync(password, 10);

        // createUser expects passwordHash (it will handle username uniqueness)
        const id = await createUser({ username, email, passwordHash });
        console.log('created user id=', id);
        process.exit(0);
    } catch (err) {
        console.error('ERROR creating test user:', err && err.message ? err.message : err);
        process.exit(2);
    }
})();
