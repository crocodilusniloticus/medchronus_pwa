const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ================= CONFIGURATION =================
// Define the files/folders we want to version-control aggressively
const MANAGED_ROOT_FILES = ['renderer.js', 'styles.css']; // Files in root
const MANAGED_SUBFOLDERS = ['js']; // Folders to scan for JS files
// =================================================

// 1. Read package.json & Increment Version
const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');
pkg.version = newVersion;

console.log(`🚀 Bumping version to v${newVersion} (NUCLEAR MODE)...`);
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// Helper: Find current file on disk matching a base name
// e.g., looks for "renderer*.js" -> returns "renderer-v2.2.4.js"
function findCurrentFile(dir, baseName, ext) {
    const files = fs.readdirSync(dir);
    // Regex finds: baseName + optional version + extension
    const pattern = new RegExp(`^${baseName}.*\\.${ext}$`);
    return files.find(f => pattern.test(f));
}

// 2. RENAME FILES & BUILD MAP
// We create a map of { oldFileName: newFileName, baseName: newFileName }
const fileMap = []; // Array of objects: { dir, oldName, newName, baseName, ext }

// A. Scan Root Files
MANAGED_ROOT_FILES.forEach(filename => {
    const ext = filename.split('.').pop(); // 'js' or 'css'
    const base = filename.replace(`.${ext}`, ''); // 'renderer' or 'styles'
    
    const current = findCurrentFile(__dirname, base, ext);
    if (current) {
        const newName = `${base}-v${newVersion}.${ext}`;
        fileMap.push({
            dir: __dirname,
            oldName: current,
            newName: newName,
            baseName: base,
            ext: ext,
            isRoot: true
        });
    }
});

// B. Scan JS Subfolder
MANAGED_SUBFOLDERS.forEach(sub => {
    const dirPath = path.join(__dirname, sub);
    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
        files.forEach(f => {
            // Logic: if file is "timers-v2.2.4.js", base is "timers"
            // If file is "timers.js", base is "timers"
            let base = f.replace('.js', '');
            if (base.includes('-v')) {
                base = base.split('-v')[0];
            }
            
            const newName = `${base}-v${newVersion}.js`;
            fileMap.push({
                dir: dirPath,
                oldName: f,
                newName: newName,
                baseName: base,
                ext: 'js',
                isRoot: false,
                subFolder: sub
            });
        });
    }
});

// C. Execute Renames
console.log(`☢️  Renaming ${fileMap.length} files...`);
fileMap.forEach(file => {
    if (file.oldName !== file.newName) {
        fs.renameSync(path.join(file.dir, file.oldName), path.join(file.dir, file.newName));
        console.log(`   ${file.oldName} -> ${file.newName}`);
    }
});

// 3. UPDATE REFERENCES (The "Find & Replace" Logic)
// We need to look for strings that reference the Base Name and update them to New Name

// Helper: Global Replace function
function updateContent(filePath, maps) {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    maps.forEach(map => {
        // Regex Explanation:
        // 1. Prefix: quotes, slash, or whitespace
        // 2. Base name (e.g. "renderer" or "timers")
        // 3. Optional old version string (-v2.2.4)
        // 4. Extension
        // 5. Suffix: quotes or whitespace
        
        // This handles: href="styles.css", href="styles-v2.2.4.css", import ... './js/timers.js'
        
        const safeBase = map.baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
        const regex = new RegExp(`(['"/\\s])(${safeBase})(-v[0-9\\.]+)?\\.${map.ext}(['"])`, 'g');
        
        content = content.replace(regex, `$1${map.newName}$4`);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`   📝 Updated refs in: ${path.basename(filePath)}`);
    }
}

// A. Update index.html
updateContent(path.join(__dirname, 'index.html'), fileMap);

// B. Update service-worker.js (+ Cache Name)
const swPath = path.join(__dirname, 'service-worker.js');
if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    // Update Cache Name
    swContent = swContent.replace(/const CACHE_NAME = ['"].*['"];/, `const CACHE_NAME = 'medchronos-v${newVersion}-production';`);
    fs.writeFileSync(swPath, swContent);
    // Update File Refs
    updateContent(swPath, fileMap);
}

// C. Update ALL JS files (to fix imports)
// We scan the *new* filenames now
fileMap.forEach(file => {
    if (file.ext === 'js') {
        updateContent(path.join(file.dir, file.newName), fileMap);
    }
});

// 4. Git Commit & Tag
try {
    console.log('📦 Staging files...');
    // We must add the new files and "delete" the old ones (git handles rename detection usually, but "add ." catches all)
    execSync('git add .');
    
    console.log('📦 Committing...');
    execSync(`git commit -m "🔖 Release v${newVersion}: Renamed ALL assets"`);
    
    console.log('🏷️  Tagging...');
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`✅ Tagged v${newVersion}`);

    console.log(`\n🎉 DONE! Run: git push origin main --follow-tags`);
    
} catch (error) {
    console.error('❌ Git failed:', error.message);
    process.exit(1);
}