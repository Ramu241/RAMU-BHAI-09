const fs = require('fs');
let content = fs.readFileSync('run_deob.cjs', 'utf8');

const target = '!==false;}))';
const replacement = '!==false);}))';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('run_deob.cjs', content, 'utf8');
    console.log("Successfully fixed the parentheses mismatch!");
} else {
    console.log("Target pattern '!==false;}))' not found!");
}
