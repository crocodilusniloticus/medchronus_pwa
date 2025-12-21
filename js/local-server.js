const express = require('express');
const app = express();
const path = require('path');

app.use((req, res, next) => {
    // 1. THE CRITICAL HEADER
    // This allows the Google Popup to verify it's coming from your site.
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    
    // 2. REMOVE THE CONFLICTING HEADER
    // We do NOT set Cross-Origin-Embedder-Policy. 
    // Setting it to 'unsafe-none' explicitly can cause issues. 
    // Letting it default to null is safer here.

    // 3. STANDARD HEADERS
    res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");

    // 4. NO CACHE (Keep this to ensure updates apply)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    next();
});

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use(express.static(path.join(__dirname, '../')));

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`   Fix applied: Removed Embedder-Policy conflict.`);
});