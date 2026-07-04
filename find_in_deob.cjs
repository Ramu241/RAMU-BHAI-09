const fs = require('fs');
const content = fs.readFileSync('run_deob.cjs', 'utf8');

const regexes = [/_Y1j23/g, /_WZWjLh7l2/g];

regexes.forEach(regex => {
    let match;
    console.log(`Searching for ${regex.source}:`);
    while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + 50);
        console.log(`Match at index ${match.index}:`);
        console.log(`   ${content.substring(start, end)}`);
    }
});
