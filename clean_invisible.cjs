const fs = require('fs');

// Read step1 code
let code = fs.readFileSync('step1.txt', 'utf8');

// Replace all zero-width spaces (u200b) with empty string
const initialLength = code.length;
code = code.replace(/\u200b/g, '');
const finalLength = code.length;

console.log(`Removed ${initialLength - finalLength} zero-width space characters from step1.txt!`);

// Let's write the cleaned code back
fs.writeFileSync('step1.txt', code, 'utf8');
