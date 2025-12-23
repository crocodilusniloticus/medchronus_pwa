const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 1. Read package.json ---
const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// --- 2. Increment Version ---
const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');
pkg.version = newVersion;

console.log(`🚀 Bumping to v${newVersion}...`);
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// --- 3. Update Service Worker (CACHE NAME + ASSET LIST) ---
const swPath = path.join(__dirname, 'service-worker.js');
if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // A. Update Cache Name
    swContent = swContent.replace(
        /const CACHE_NAME = ['"].*['"];/, 
        `const CACHE_NAME = 'medchronos-v${newVersion}-production';`
    );

    // B. Tag CSS/JS files in the ASSETS_TO_CACHE array
    // This turns './styles.css' into './styles.css?v=2.2.6'
    swContent = swContent.replace(
        /(\.css|\.js)(\?v=[0-9\.]+)?(['"])/g, 
        `$1?v=${newVersion}$3`
    );

    fs.writeFileSync(swPath, swContent);
    console.log(`✅ Service Worker: Cache Name & Asset List updated.`);
}

// --- 4. Update Index.html ---
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    // Updates href="styles.css" to href="styles.css?v=..."
    indexContent = indexContent.replace(
        /(\.css|\.js)(\?v=[0-9\.]+)?(["'])/g, 
        `$1?v=${newVersion}$3`
    );
    fs.writeFileSync(indexPath, indexContent);
    console.log(`✅ Index.html: Links updated.`);
}

// --- 5. Update JS Imports (Renderer & Modules) ---
const jsDir = path.join(__dirname, 'js');
let filesToScan = [];
if (fs.existsSync(path.join(__dirname, 'renderer.js'))) filesToScan.push(path.join(__dirname, 'renderer.js'));
if (fs.existsSync(jsDir)) {
    filesToScan = filesToScan.concat(fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f)));
}

filesToScan.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    // Updates import ... from './timers.js' to './timers.js?v=...'
    content = content.replace(
        /(from\s+['"].*?\.js)(\?v=[0-9\.]+)?(['"])/g,
        `$1?v=${newVersion}$3`
    );
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`   👉 Imports updated in: ${path.basename(filePath)}`);
    }
});

// --- 6. Git Commit & Tag ---
try {
    console.log('📦 Staging files...');
    execSync('git add .');
    
    console.log('📦 Committing...');
    execSync(`git commit -m "🔖 Release v${newVersion}: Fix CSS caching"`);
    
    console.log('🏷️  Tagging...');
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`✅ Tagged v${newVersion}`);

    console.log(`\n🎉 DONE! Run this command to deploy:\n`);
    console.log(`    git push origin main --follow-tags`);
    
} catch (error) {
    console.error('❌ Git failed:', error.message);
    process.exit(1);
}