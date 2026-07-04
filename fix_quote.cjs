const fs = require('fs');
let content = fs.readFileSync('run_deob.cjs', 'utf8');

// We replace the bad quote
const target = '_Y1j23()\\"[_WZWjLh7l2()]';
const replacement = '_Y1j23()[_WZWjLh7l2()]';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('run_deob.cjs', content, 'utf8');
    console.log("Successfully fixed the quote inside run_deob.cjs!");
} else {
    console.log("Target not found inside run_deob.cjs!");
    // Let's try replacing without backslash just in case
    const target2 = '_Y1j23()\"[_WZWjLh7l2()]';
    if (content.includes(target2)) {
        content = content.replace(target2, replacement);
        fs.writeFileSync('run_deob.cjs', content, 'utf8');
        console.log("Successfully fixed the quote (target2) inside run_deob.cjs!");
    } else {
        console.log("Target2 not found either!");
    }
}
