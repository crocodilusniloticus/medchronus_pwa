const modalHTML = `
<div id="sync-onboarding-modal" class="modal-overlay">
    <div class="modal-content">
        <h2 style="border-bottom: 2px solid var(--warning); padding-bottom: 10px; margin-top:0;">⚠️ Google Authorization</h2>
        
        <div style="margin: 20px 0;">
            <p style="margin-bottom: 15px; font-size: 0.95rem; line-height: 1.5;">
                Google will show a "Google hasn't verified this app" warning because MedChronos is free and open-source.
            </p>
            
            <div style="background: var(--bg-body); padding: 15px; border-radius: var(--radius); border: 1px solid var(--border-color); margin-bottom: 20px;">
                <strong style="display:block; margin-bottom:10px; color:var(--text-main); font-size: 0.9rem;">How to proceed:</strong>
                <ol style="margin: 0; padding-left: 20px; line-height: 1.6; color: var(--text-muted); font-size: 0.9rem;">
                    <li>Click <strong>Advanced</strong> (bottom left)</li>
                    <li>Click <strong>Go to MedChronos (unsafe)</strong></li>
                </ol>
            </div>

            <div style="font-size: 0.8rem; color: var(--text-muted);">
                * Don't worry, "unsafe" just means we haven't paid Google for a corporate audit. Your data stays on your computer.
            </div>
        </div>

        <div class="modal-footer">
            <button id="cancel-sync-setup-btn" class="btn btn-ghost">Cancel</button>
            <button id="confirm-sync-setup-btn" class="btn btn-primary">I understand, Login</button>
        </div>
    </div>
</div>
`;

function inject() {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

module.exports = { inject };