const fs = require('fs');
let code = fs.readFileSync('step1.txt', 'utf8');

// The exact target string with backslash-escaped quotes
const target = '((_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false;}))';
const replacement = '((_L55c0Y[_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false);}))';
const replacementFunc = '(((()=>{})[_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false);}))';

console.log("Checking target in step1.txt:");
if (code.includes(target)) {
    console.log("Target found!");
    // Let's replace it with the correct function one
    code = code.replace(target, replacementFunc);
    fs.writeFileSync('step1.txt', code, 'utf8');
    console.log("Successfully replaced and wrote to step1.txt!");
} else {
    console.log("Target not found!");
    // Let's print around 13030 to see what is there
    const idx = code.indexOf('_Izgl5ltm=>{');
    if (idx !== -1) {
        console.log("Context around _Izgl5ltm=> :");
        console.log(code.substring(idx, idx + 150));
    }
}
