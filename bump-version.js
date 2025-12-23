const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ================= CONFIGURATION =================
const LOCAL_JS_FILES = [
    'authModal', 'bump-version', 'charts', 'database', 'dataManager', 'fa', 
    'googleSync', 'listeners', 'local-server', 'manual', 'modals', 'quotes', 
    'state', 'supabaseClient', 'syncModal', 'timers', 'tools', 'uiRefs', 'utils', 'views'
];
// =================================================

// 1. Increment Version
const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');
pkg.version = newVersion;
console.log(`🚀 Bumping to v${newVersion}...`);
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// Helper: Find file on disk
function findFileOnDisk(dir, base, ext) {
    const files = fs.readdirSync(dir);
    const regex = new RegExp(`^${base}(?:-v[0-9\\.]+)?\\.${ext}$`);
    return files.find(f => regex.test(f));
}

// 2. RENAME LOCAL FILES (Nuclear Strategy)
const fileMap = []; 

// A. Root Files (renderer.js, styles.css)
['renderer', 'styles'].forEach(base => {
    let ext = base === 'styles' ? 'css' : 'js';
    const oldName = findFileOnDisk(__dirname, base, ext);
    if (oldName) {
        fileMap.push({ base, ext, oldName, newName: `${base}-v${newVersion}.${ext}`, dir: __dirname });
    }
});

// B. JS Folder Files
const jsDir = path.join(__dirname, 'js');
if (fs.existsSync(jsDir)) {
    LOCAL_JS_FILES.forEach(base => {
        const oldName = findFileOnDisk(jsDir, base, 'js');
        if (oldName) {
            fileMap.push({ base, ext: 'js', oldName, newName: `${base}-v${newVersion}.js`, dir: jsDir });
        }
    });
}

// C. Execute Renames
console.log(`☢️  Renaming ${fileMap.length} local files...`);
fileMap.forEach(f => {
    if (f.oldName !== f.newName) {
        fs.renameSync(path.join(f.dir, f.oldName), path.join(f.dir, f.newName));
    }
});

// 3. UPDATE REFERENCES (HTML, SW, JS Imports)
const filesToUpdate = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'service-worker.js'),
    ...fileMap.filter(f => f.ext === 'js').map(f => path.join(f.dir, f.newName))
];

console.log(`📝 Updating references...`);

filesToUpdate.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // A. Fix Service Worker Cache Name
    if (filePath.includes('service-worker.js')) {
        content = content.replace(/const CACHE_NAME = ['"].*['"];/, `const CACHE_NAME = 'medchronos-v${newVersion}-production';`);
    }

    // B. Update LOCAL FILE References (Renaming)
    fileMap.forEach(map => {
        const safeBase = map.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Regex: Matches quotes/space + base + optional version + extension + optional query + quote
        // e.g., "./renderer.js" OR "./renderer-v2.2.8.js"
        const regex = new RegExp(`(['"/\\s])(${safeBase})(?:-v[0-9\\.]+)?\\.${map.ext}(?:\\?v=[0-9\\.]+)?(['"])`, 'g');
        content = content.replace(regex, `$1${map.newName}$3`);
    });

    // C. Update CDN/External References (Query String Only)
    // Matches any .css or .js that IS NOT in our local fileMap, and updates ?v=...
    // This targets things like 'airbnb.css?v=...' or 'echarts.min.js?v=...'
    content = content.replace(
        /(\.css|\.js)\?v=[0-9\.]+(["'])/g, 
        `$1?v=${newVersion}$2`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content);
    }
});

// 4. Git Commit & Tag
try {
    console.log('📦 Committing & Tagging...');
    execSync('git add .');
    execSync(`git commit -m "🔖 Release v${newVersion}"`);
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`\n🎉 DONE! Run: git push origin main --follow-tags`);
} catch (e) {
    console.error('Git error:', e.message);
}