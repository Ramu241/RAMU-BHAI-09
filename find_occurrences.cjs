const fs = require('fs');
const code = fs.readFileSync('step1.txt', 'utf8');

const regex = /_L55c0Y/g;
let match;
while ((match = regex.exec(code)) !== null) {
    const start = Math.max(0, match.index - 50);
    const end = Math.min(code.length, match.index + 50);
    console.log(`Match at index ${match.index}:`);
    console.log(`   ${code.substring(start, end)}`);
}
