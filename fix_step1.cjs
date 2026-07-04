const fs = require('fs');
let code = fs.readFileSync('step1.txt', 'utf8');

// 1. Remove the rogue quote after _Y1j23()
const badQuote = '_Y1j23()"';
const cleanQuote = '_Y1j23()';

if (code.includes(badQuote)) {
    code = code.replace(badQuote, cleanQuote);
    console.log("Fixed rogue quote after _Y1j23()!");
} else {
    console.log("Rogue quote not found in step1.txt!");
}

// 2. Fix the parenthesis mismatch
const badParen = '!==false;}))';
const cleanParen = '!==false);}))';

if (code.includes(badParen)) {
    code = code.replace(badParen, cleanParen);
    console.log("Fixed parenthesis mismatch!");
} else {
    console.log("Parenthesis mismatch not found in step1.txt!");
}

fs.writeFileSync('step1.txt', code, 'utf8');
