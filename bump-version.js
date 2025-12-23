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

// --- 3. NUCLEAR OPTION: Rename styles.css ---
// Find the current styles file (e.g., styles.css OR styles-v2.2.5.css)
const rootDir = __dirname;
const allFiles = fs.readdirSync(rootDir);
const styleFile = allFiles.find(f => f.startsWith('styles') && f.endsWith('.css'));

let newStyleFileName = `styles-v${newVersion}.css`;

if (styleFile) {
    const oldStylePath = path.join(rootDir, styleFile);
    const newStylePath = path.join(rootDir, newStyleFileName);
    fs.renameSync(oldStylePath, newStylePath);
    console.log(`☢️  Renamed CSS: ${styleFile} -> ${newStyleFileName}`);
} else {
    console.error("⚠️  Could not find styles.css to rename! Check your file structure.");
    // Fallback if file is missing (creates it empty to prevent crash, but you should check)
    newStyleFileName = 'styles.css'; 
}

// --- 4. Update Index.html (Point to NEW filename) ---
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Replace href="styles....css?v=..." with href="styles-v2.2.7.css"
    indexContent = indexContent.replace(
        /(href=["'])styles.*?\.css(\?v=[0-9\.]+)?(["'])/g, 
        `$1${newStyleFileName}$3`
    );
    
    // Also tag JS files while we're here
    indexContent = indexContent.replace(
        /(\.js)(\?v=[0-9\.]+)?(["'])/g, 
        `$1?v=${newVersion}$3`
    );

    fs.writeFileSync(indexPath, indexContent);
    console.log(`✅ Index.html updated to link to ${newStyleFileName}`);
}

// --- 5. Update Service Worker (Cache NEW filename) ---
const swPath = path.join(__dirname, 'service-worker.js');
if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    
    // Update Cache Name
    swContent = swContent.replace(
        /const CACHE_NAME = ['"].*['"];/, 
        `const CACHE_NAME = 'medchronos-v${newVersion}-production';`
    );

    // Update Stylesheet reference in cache list
    swContent = swContent.replace(
        /['"]\.\/styles.*?\.css(\?v=[0-9\.]+)?['"]/, 
        `'./${newStyleFileName}'`
    );

    // Tag JS files
    swContent = swContent.replace(
        /(\.js)(\?v=[0-9\.]+)?(['"])/g, 
        `$1?v=${newVersion}$3`
    );

    fs.writeFileSync(swPath, swContent);
    console.log(`✅ Service Worker updated.`);
}

// --- 6. Update JS Imports (Fix Renderer Crash) ---
const jsDir = path.join(__dirname, 'js');
let filesToScan = [];
if (fs.existsSync(path.join(__dirname, 'renderer.js'))) filesToScan.push(path.join(__dirname, 'renderer.js'));
if (fs.existsSync(jsDir)) {
    filesToScan = filesToScan.concat(fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f)));
}

filesToScan.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    content = content.replace(
        /(from\s+['"].*?\.js)(\?v=[0-9\.]+)?(['"])/g,
        `$1?v=${newVersion}$3`
    );
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`   👉 Imports updated in: ${path.basename(filePath)}`);
    }
});

// --- 7. Git Commit & Tag ---
try {
    console.log('📦 Staging files...');
    execSync('git add .');
    
    console.log('📦 Committing...');
    execSync(`git commit -m "🔖 Release v${newVersion}: Renamed CSS to bust cache"`);
    
    console.log('🏷️  Tagging...');
    execSync(`git tag -a v${newVersion} -m "Version ${newVersion}"`);
    console.log(`✅ Tagged v${newVersion}`);

    console.log(`\n🎉 DONE! Deploying...`);
    
} catch (error) {
    console.error('❌ Git failed:', error.message);
    process.exit(1);
}