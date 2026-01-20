import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../frontend');
// Allow text-alignment and text-colors, but forbid size and weight in generic files
const FORBIDDEN_PATTERNS = [
    /className="[^"]*\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b[^"]*"/,
    /className="[^"]*\bfont-(thin|light|normal|medium|semibold|bold|extrabold)\b[^"]*"/
];

const IGNORED_PATHS = [
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage',
    'components/ui', // Shadcn UI components are the source of truth
    'components/typography.tsx', // Definition file
    'components/common/index.ts' // Exports
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        const fullPath = path.join(dirPath, file);
        const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

        // Check if path is ignored
        if (IGNORED_PATHS.some(ignored => relativePath === ignored || relativePath.startsWith(ignored + '/'))) {
            return;
        }

        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // Check if file is typography definition or .tsx/.ts
            if ((file.endsWith('.tsx') || file.endsWith('.ts'))) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(ROOT_DIR);
let violationCount = 0;

console.log('--- Typography Validation ---');

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.resolve(__dirname, '..'), file);

    FORBIDDEN_PATTERNS.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
            console.error(`[VIOLATION] ${relativePath}: Found inline typography "${match[0]}"`);
            violationCount++;
        }
    });
});

if (violationCount > 0) {
    console.error(`\nFound ${violationCount} typography violations.`);
    process.exit(1);
} else {
    console.log('✅ No typography violations found.');
    process.exit(0);
}
