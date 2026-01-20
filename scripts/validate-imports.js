import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../frontend');
const FORBIDDEN_PATTERNS = [
    /from ["']@\/components\/ui\/[^"']+["']/,
    /from ["']\.\.\/ui\/[^"']+["']/,
    /from ["']\.\.\/components\/ui\/[^"']+["']/
];

const IGNORE_DIRS = ['node_modules', '.next', 'out', 'public', '.git'];
// common/index.ts is allowed to re-export from ui
const ALLOWED_FILES = ['index.ts'];

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
                // Check if it's common/index.ts
                if (fullPath.endsWith('components\\common\\index.ts') || fullPath.endsWith('components/common/index.ts')) {
                    return;
                }
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

const files = getAllFiles(ROOT_DIR);
let violationCount = 0;

console.log('--- Import Validation ---');

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(path.resolve(__dirname, '..'), file);

    FORBIDDEN_PATTERNS.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
            console.error(`[VIOLATION] ${relativePath}: Deep import detected "${match[0]}"`);
            violationCount++;
        }
    });
});

if (violationCount > 0) {
    console.error(`\nFound ${violationCount} import violations.`);
    process.exit(1);
} else {
    console.log('✅ No import violations found.');
    process.exit(0);
}
