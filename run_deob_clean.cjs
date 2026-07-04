const fs = require('fs');

// 1. Read current run_deob.cjs
let content = fs.readFileSync('run_deob.cjs', 'utf8');

// Undo the corrupting replacement: replace '!==false);}))' with '!==false;}))'
const corruptPattern = '!==false);}))';
const originalPattern = '!==false;}))';

if (content.includes(corruptPattern)) {
    content = content.replace(corruptPattern, originalPattern);
    console.log("Successfully restored run_deob.cjs to pristine state in memory!");
} else {
    console.log("Could not find corrupt pattern. It might already be in pristine or modified state.");
}

// 2. Now let's do the surgical, correct deobfuscation in memory
// Surgical fix 1: Remove the rogue \" after _Y1j23()
// In the original file, it is '_Y1j23()\\"[_WZWjLh7l2()]' (double escaped backslash and quote)
// Let's replace '_Y1j23()\\"[_WZWjLh7l2()]' with '_Y1j23()[_WZWjLh7l2()]'
const badQuote = '_Y1j23()\\"[_WZWjLh7l2()]';
const goodQuote = '_Y1j23()[_WZWjLh7l2()]';

if (content.includes(badQuote)) {
    content = content.replace(badQuote, goodQuote);
    console.log("Fixed rogue quote in memory!");
} else {
    // Let's try single escaped backslash
    const badQuoteSingle = '_Y1j23()\\"[_WZWjLh7l2()]';
    if (content.includes(badQuoteSingle)) {
        content = content.replace(badQuoteSingle, goodQuote);
        console.log("Fixed rogue quote (single) in memory!");
    } else {
        console.log("Could not find rogue quote pattern in memory!");
    }
}

// Surgical fix 2: Replace '((_WZWjLh7l2(2)](\"_L55c0Y\",_Izgl5ltm)(_L55c0Y))!==false;}))' 
// with '(((()=>{})[_WZWjLh7l2(2)](\"_L55c0Y\",_Izgl5ltm)(_L55c0Y))!==false);}))'
// Note that in run_deob.cjs on disk, the quotes inside that string are escaped as \\" (double escaped backslash and quote)
const badSyntax = '((_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false;}))';
const goodSyntax = '(((()=>{})[_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false);}))';

if (content.includes(badSyntax)) {
    content = content.replace(badSyntax, goodSyntax);
    console.log("Fixed syntax parenthesis mismatch in memory!");
} else {
    console.log("Could not find bad syntax pattern in memory!");
}

// 3. Write this memory-repaired code to a temporary file 'run_deob_repaired.cjs' and execute it
fs.writeFileSync('run_deob_repaired.cjs', content, 'utf8');
console.log("Wrote repaired code to run_deob_repaired.cjs!");

// Let's execute it!
console.log("Executing run_deob_repaired.cjs...");
try {
    // Set up global hook for captured Function calls
    global.window = global;
    global.addEventListener = () => {};
    global.removeEventListener = () => {};
    global.document = {
        characterSet: 'UTF-8',
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    const originalFunction = global.Function;
    let callCount = 0;

    global.Function = function(...args) {
        callCount++;
        const code = args[args.length - 1];
        const filename = `step${callCount}.txt`;
        fs.writeFileSync(filename, code);
        console.log(`Captured call ${callCount} in ${filename}! Length:`, code.length);
        
        const fn = originalFunction(...args);
        return function(...callArgs) {
            console.log(`Executing captured function ${callCount}...`);
            try {
                return fn.apply(this, callArgs);
            } catch (e) {
                console.error(`Error running captured function ${callCount}:`, e);
            }
        };
    };

    // Run the repaired file
    require('./run_deob_repaired.cjs');
} catch (e) {
    console.error("Execution error:", e);
}
