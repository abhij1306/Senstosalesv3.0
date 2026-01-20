import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../frontend');
// Check for HTML primitives that should likely be components
const WARNING_PATTERNS = [
    { pattern: /<button\b/, message: "Use <Button> component" },
    { pattern: /<input\b/, message: "Use <Input> component" },
];

const IGNORE_DIRS = ['node_modules', '.next', 'out', 'public', '.git', 'ui'];

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
            if (file.endsWith('.tsx')) { // Components only
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(ROOT_DIR);
let violationCount = 0;

console.log('--- Component Usage Validation ---');

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.resolve(__dirname, '..'), file);

    WARNING_PATTERNS.forEach(({ pattern, message }) => {
        if (pattern.test(content)) {
            console.error(`[VIOLATION] ${relativePath}: Found HTML primitive matching ${pattern}. ${message}`);
            violationCount++;
        }
    });
});

if (violationCount > 0) {
    console.error(`\nFound ${violationCount} component usage violations.`);
    process.exit(1);
} else {
    console.log('✅ No component usage violations found.');
    process.exit(0);
}
