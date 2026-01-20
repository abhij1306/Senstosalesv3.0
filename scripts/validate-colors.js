import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../frontend');
const FORBIDDEN_PATTERNS = [
    /text-(red|green|blue|slate|gray|amber|yellow|orange|purple|pink|indigo)-[0-9]/,
    /bg-(red|green|blue|slate|gray|amber|yellow|orange|purple|pink|indigo)-[0-9]/,
    /border-(red|green|blue|slate|gray|amber|yellow|orange|purple|pink|indigo)-[0-9]/,
    /#[0-9a-fA-F]{3,6}/,
    /rgb\(|rgba\(|hsl\(|hsla\(/
];

const IGNORE_DIRS = ['node_modules', '.next', 'out', 'public', '.git'];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(ROOT_DIR);
let violationCount = 0;

console.log('--- Color Token Validation ---');

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.resolve(__dirname, '..'), file);

    FORBIDDEN_PATTERNS.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
            console.error(`[VIOLATION] ${relativePath}: Found forbidden pattern "${match[0]}"`);
            violationCount++;
        }
    });
});

if (violationCount > 0) {
    console.error(`\nFound ${violationCount} color violations.`);
    process.exit(1);
} else {
    console.log('✅ No color token violations found.');
    process.exit(0);
}
