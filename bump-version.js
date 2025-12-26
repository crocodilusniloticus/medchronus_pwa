const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// ================= CONFIGURATION =================
const LOCAL_JS_FILES = [
    'authModal', 'bump-version', 'charts', 'database', 'dataManager', 'fa', 
    'googleSync', 'listeners', 'local-server', 'manual', 'modals', 'quotes', 
    'state', 'supabaseClient', 'syncModal', 'timers', 'tools', 'uiRefs', 'utils', 'views'
];
const HISTORY_FILE = '.release-history.json'; // Hidden file (starts with dot)
// =================================================

// Helper: input prompt
const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

(async () => {
    try {
        // 0. PREPARE & CALCULATE VERSION
        const packagePath = path.join(__dirname, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const versionParts = pkg.version.split('.');
        versionParts[2] = parseInt(versionParts[2]) + 1;
        const newVersion = versionParts.join('.');

        console.log(`\n🚀 Preparing v${newVersion}...`);

        // =================================================
        // 1. ASK FOR DESCRIPTION (THE NEW FEATURE)
        // =================================================
        const description = await askQuestion(`📝 Enter description for v${newVersion}: `);
        
        if (!description.trim()) {
            console.log('⚠️  No description provided. Aborting to keep history clean.');
            process.exit(1);
        }

        // SAVE TO HIDDEN HISTORY FILE
        const historyPath = path.join(__dirname, HISTORY_FILE);
        let history = [];
        if (fs.existsSync(historyPath)) {
            try {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            } catch (e) { /* ignore corrupt file */ }
        }

        const logEntry = {
            version: newVersion,
            date: new Date().toISOString(),
            note: description
        };

        // Add new entry to the top
        history.unshift(logEntry);
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log(`💾 Saved note to ${HISTORY_FILE}`);

        // =================================================

        // 2. WRITE PACKAGE.JSON
        pkg.version = newVersion;
        fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

        // Helper: Find file on disk
        function findFileOnDisk(dir, base, ext) {
            const files = fs.readdirSync(dir);
            const regex = new RegExp(`^${base}(?:-v[0-9\\.]+)?\\.${ext}$`);
            return files.find(f => regex.test(f));
        }

        // 3. RENAME LOCAL FILES (Nuclear Strategy)
        const fileMap = []; 

        // A. Root Files
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

        // 4. UPDATE REFERENCES
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

            // B. Update LOCAL FILE References
            fileMap.forEach(map => {
                const safeBase = map.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(['"/\\s])(${safeBase})(?:-v[0-9\\.]+)?\\.${map.ext}(?:\\?v=[0-9\\.]+)?(['"])`, 'g');
                content = content.replace(regex, `$1${map.newName}$3`);
            });

            // C. Update CDN/External References
            content = content.replace(
                /(\.css|\.js)\?v=[0-9\.]+(["'])/g, 
                `$1?v=${newVersion}$2`
            );

            if (content !== original) {
                fs.writeFileSync(filePath, content);
            }
        });

        // 5. GIT COMMIT & TAG
        console.log('📦 Committing & Tagging...');
        execSync('git add .');
        
        // We include the description in the commit message body for extra safety
        const commitMsg = `🔖 Release v${newVersion}\n\n${description}`;
        
        execSync(`git commit -m "${commitMsg}"`);
        execSync(`git tag -a v${newVersion} -m "${description}"`);
        console.log('🚀 Pushing to origin/main...');
        execSync('git push origin main --follow-tags');
        console.log(`\n🎉 DONE! v${newVersion} shipped.`);
        console.log(`📝 Note: "${description}"`);
        console.log(`👉 Run: git push origin main --follow-tags`);

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
})();