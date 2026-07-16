const { execSync } = require('child_process');
const fs = require('fs');

try {
  const status = execSync('git status', { encoding: 'utf8' });
  const log = execSync('git log --oneline -n 20', { encoding: 'utf8' });
  fs.writeFileSync('git_status_log.txt', `=== STATUS ===\n${status}\n\n=== LOG ===\n${log}`);
  console.log('Successfully wrote git_status_log.txt');
} catch (error) {
  fs.writeFileSync('git_status_log.txt', `ERROR: ${error.message}\n${error.stack}`);
  console.error('Error:', error);
}
