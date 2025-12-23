const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 1. Read package.json to get current version ---
const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// --- 2. Increment version (Patch level: 1.3.2 -> 1.3.3) ---
const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');
pkg.version = newVersion;

console.log(`🚀 Bumping version to ${newVersion}...`);

// --- 3. Save new package.json ---
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// --- 4. Update service-worker.js ---
const swPath = path.join(__dirname, 'service-worker.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(
    /const CACHE_NAME = ['"].*['"];/, 
    `const CACHE_NAME = 'medchronos-v${newVersion}-production';`
);
fs.writeFileSync(swPath, swContent);
console.log(`✅ Service Worker cache updated.`);

// --- 5. Update index.html (Asset Busting) ---
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
// Updates .css?v=... and .js?v=...
indexContent = indexContent.replace(
    /(\.css|\.js)(["'])/g, 
    `$1?v=${newVersion}$2`
);
// Cleanup existing query strings if they doubled up
indexContent = indexContent.replace(/\?v=[0-9\.]+\?v=/, '?v='); 

fs.writeFileSync(indexPath, indexContent);
console.log(`✅ Index.html assets tagged.`);

// --- 6. NEW: Update JS Import Statements (The Fix for Renderer Crash) ---
// This scans renderer.js and all files in /js/ to tag relative imports
const jsDir = path.join(__dirname, 'js');
let filesToScan = [];

// Add renderer.js
if (fs.existsSync(path.join(__dirname, 'renderer.js'))) {
    filesToScan.push(path.join(__dirname, 'renderer.js'));
}

// Add all .js files in js/ folder
if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    filesToScan = filesToScan.concat(jsFiles.map(f => path.join(jsDir, f)));
}

console.log(`🔍 Scanning ${filesToScan.length} JS files for imports...`);

filesToScan.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Regex Logic:
    // 1. Look for: from '   OR   from "
    // 2. Look for: ./... .js   OR   ../... .js
    // 3. Capture the file path ($1)
    // 4. Ignore existing ?v= numbers
    // 5. Replace with: path + ?v=newVersion
    
    content = content.replace(
        /(from\s+['"]\..*?\.js)(\?v=[0-9\.]+)?(['"])/g,
        `$1?v=${newVersion}$3`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`   👉 Updated imports in: ${path.basename(filePath)}`);
    }
});

// --- 7. Auto-Git & Tagging ---
try {
    console.log('📦 Staging files...');
    execSync('git add .');
    
    console.log('📦 Committing...');
    execSync(`git commit -m "🔖 Release v${newVersion}: Auto-bumped"`);
    
    console.log('🏷️  Creating Git Tag...');
    // -a creates an annotated tag (required for --follow-tags to work)
    try {
        execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`);
        console.log(`✅ Tagged v${newVersion}`);
    } catch (tagError) {
        console.log(`⚠️  Tagging failed (Tag might exist). Continuing...`);
    }

    console.log(`\n🎉 DONE! Run this to push code AND tags:\n`);
    console.log(`    git push origin main --follow-tags`);
    
} catch (error) {
    console.error('❌ Git automation failed:', error.message);
    process.exit(1);
}