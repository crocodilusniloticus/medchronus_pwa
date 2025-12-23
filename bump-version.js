const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read package.json to get current version
const packagePath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// 2. Increment version (Patch level: 1.3.2 -> 1.3.3)
const versionParts = pkg.version.split('.');
versionParts[2] = parseInt(versionParts[2]) + 1;
const newVersion = versionParts.join('.');
pkg.version = newVersion;

console.log(`🚀 Bumping version from ${pkg.version} to ${newVersion}...`);

// 3. Save new package.json
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));

// 4. Update service-worker.js
const swPath = path.join(__dirname, 'service-worker.js');
let swContent = fs.readFileSync(swPath, 'utf8');
// Regex finds: const CACHE_NAME = '...'; and replaces with new version
swContent = swContent.replace(
    /const CACHE_NAME = ['"].*['"];/, 
    `const CACHE_NAME = 'medchronos-v${newVersion}-production';`
);
fs.writeFileSync(swPath, swContent);
console.log(`✅ Service Worker cache updated to v${newVersion}`);

// 5. Update index.html (Cache Busting)
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
// Regex finds: .css?v=... or .js?v=... and updates the number
indexContent = indexContent.replace(
    /(\.css|\.js)\?v=[a-zA-Z0-9\.]+/g, 
    `$1?v=${newVersion}`
);
// Fallback: If no query string exists yet, add it
indexContent = indexContent.replace(
    /(\.css|\.js)"/g, 
    `$1?v=${newVersion}"`
);
// Fix double quotes if fallback added them weirdly (cleanup)
indexContent = indexContent.replace(/\?v=[0-9\.]+\?v=/, '?v='); 

fs.writeFileSync(indexPath, indexContent);
console.log(`✅ Index.html assets tagged with v${newVersion}`);

// 6. Optional: Auto-Git
try {
    console.log('📦 Staging and Committing...');
    execSync('git add .');
    execSync(`git commit -m "🔖 Release v${newVersion}: Auto-bumped for rapid deploy"`);
    console.log(`🎉 Ready! Run 'git push' to deploy.`);
} catch (error) {
    console.error('Git automation failed (you might need to do it manually):', error.message);
}