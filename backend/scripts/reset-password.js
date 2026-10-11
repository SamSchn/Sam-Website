// Reset a user's password from the command line (there is no email reset).
// Usage, from the backend folder:  npm run reset-password
// Run it wherever the database lives (locally, or on the server for the live site).
const readline = require('readline');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/init');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // don't echo the password as it's typed
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  const db = getDb();
  const users = db.prepare('SELECT username, display_name FROM users ORDER BY id').all();
  if (!users.length) {
    console.log('No accounts yet. Register the first account from the site instead.');
    process.exit(1);
  }
  console.log('Accounts:', users.map(u => `${u.username} (${u.display_name})`).join(', '));

  const username = (await ask('Username: ')).trim();
  if (!users.some(u => u.username === username)) {
    console.log(`No account called "${username}".`);
    process.exit(1);
  }
  const password = await ask('New password (min 8 characters): ', true);
  if (password.length < 8) {
    console.log('Password must be at least 8 characters.');
    process.exit(1);
  }
  const again = await ask('Repeat new password: ', true);
  if (password !== again) {
    console.log("Passwords didn't match.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);
  console.log(`Password updated for ${username}. You can log in now (Esc → Owner login).`);
})();
