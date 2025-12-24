import { supabase } from './supabaseClient-v2.2.17.js';
import { syncWithSupabase } from './dataManager-v2.2.17.js';

const modalHTML = `
<div id="auth-modal" class="modal-overlay">
    <div class="modal-content" style="width: 350px;">
        <h2 id="auth-title">Cloud Account</h2>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:15px;">
            Sync your study memory across devices.
        </p>
        
        <div class="input-group">
            <input type="email" id="auth-email" class="modern-input" placeholder="Email Address">
        </div>
        <div class="input-group" style="margin-top:10px;">
            <input type="password" id="auth-password" class="modern-input" placeholder="Password">
        </div>

        <div id="auth-error" class="error-message"></div>

        <div class="modal-footer" style="flex-direction: column; gap: 10px;">
            <button id="btn-login" class="btn btn-primary" style="width:100%">Log In</button>
            <button id="btn-signup" class="btn btn-outline" style="width:100%">Sign Up</button>
            <button id="btn-auth-cancel" class="btn btn-ghost" style="width:100%">Cancel</button>
        </div>
    </div>
</div>
`;

export function injectAuthModal() {
    if (!document.getElementById('auth-modal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        setupListeners();
    }
}

export function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-error').textContent = '';
}

export function hideAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function setupListeners() {
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const errBox = document.getElementById('auth-error');

    document.getElementById('btn-auth-cancel').addEventListener('click', hideAuthModal);

    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        if(!email || !password) { errBox.textContent = "Please fill all fields"; return; }
        
        errBox.textContent = "Logging in...";
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            errBox.textContent = error.message;
        } else {
            errBox.textContent = "Success!";
            hideAuthModal();
            syncWithSupabase(); // Trigger sync immediately
            updateAuthButtonState(true);
        }
    });

    document.getElementById('btn-signup').addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        if(!email || !password) { errBox.textContent = "Please fill all fields"; return; }

        errBox.textContent = "Creating account...";
        const { data, error } = await supabase.auth.signUp({ email, password });
        
        if (error) {
            errBox.textContent = error.message;
        } else {
            errBox.textContent = "Account created! You are logged in.";
            hideAuthModal();
            syncWithSupabase();
            updateAuthButtonState(true);
        }
    });
}

// Helper to toggle the UI button text
export function updateAuthButtonState(isLoggedIn) {
    const btn = document.getElementById('cloud-auth-btn');
    if (btn) {
        if (isLoggedIn) {
            btn.textContent = "Cloud: Active";
            btn.classList.add('btn-success');
            btn.classList.remove('btn-outline');
        } else {
            btn.textContent = "Cloud Login";
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline');
        }
    }
}