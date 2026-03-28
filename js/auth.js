/**
 * StaffSync - Local Authentication & Recovery System
 * Developed by Deva Veera Kumaran
 * Features:
 * - Registration with duplicate prevention
 * - Login validation & Session management
 * - Forgot Password simulation (DOB matching)
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration & Initialization ---
    const DB_KEY = 'STAFFSYNC_USERS';
    const SESSION_KEY = 'STAFFSYNC_SESSION';

    // Theme logic (Dark/Light Mode)
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // Helper: Initialize DB if empty
    if (!localStorage.getItem(DB_KEY)) {
        // Create a default admin for testing purposes immediately
        const defaultUsers = [{
            name: "Default Admin",
            email: "admin@school.edu",
            password: "admin", // simple password for testing
            dob: "1990-01-01",
            role: "Admin"
        }];
        localStorage.setItem(DB_KEY, JSON.stringify(defaultUsers));
    }

    // --- Utility: Toast Notifications ---
    const showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-primary-600';
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transform transition-all translate-y-10 opacity-0 duration-300`;
        
        const icon = type === 'success' 
            ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
            : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
            
        toast.innerHTML = `${icon} <span class="text-sm font-medium">${message}</span>`;
        toastContainer.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('opacity-0', 'scale-95');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // --- Page Logic: SIGNUP ---
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('signupBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;
            btn.disabled = true;

            setTimeout(() => { // Simulate network delay for UX
                const name = document.getElementById('regName').value.trim();
                const email = document.getElementById('regEmail').value.trim().toLowerCase();
                const role = document.getElementById('regRole').value;
                const dob = document.getElementById('regDob').value;
                const password = document.getElementById('regPassword').value;
                const confirm = document.getElementById('regConfirm').value;

                if (password !== confirm) {
                    showToast("Passwords do not match!", "error");
                    resetBtn(); return;
                }

                let users = JSON.parse(localStorage.getItem(DB_KEY)) || [];
                
                // Check if email exists
                if (users.some(u => u.email === email)) {
                    showToast("Email is already registered. Please log in.", "error");
                    resetBtn(); return;
                }

                // Save new user
                users.push({ name, email, role, dob, password });
                localStorage.setItem(DB_KEY, JSON.stringify(users));

                showToast("Account created successfully! Redirecting...");
                setTimeout(() => window.location.href = 'login.html', 1500);
                
            }, 800);

            function resetBtn() { btn.innerHTML = originalText; btn.disabled = false; }
        });
    }

    // --- Page Logic: LOGIN ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // Prevent logged-in users from seeing the login page
        if (sessionStorage.getItem(SESSION_KEY)) {
            window.location.href = 'dashboard.html';
        }

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = `Verifying...`;
            btn.disabled = true;

            setTimeout(() => {
                const email = document.getElementById('loginEmail').value.trim().toLowerCase();
                const password = document.getElementById('loginPassword').value;

                const users = JSON.parse(localStorage.getItem(DB_KEY)) || [];
                const user = users.find(u => u.email === email && u.password === password);

                if (user) {
                    showToast("Login successful!");
                    // Set Session
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email: user.email, role: user.role }));
                    setTimeout(() => window.location.href = 'dashboard.html', 800);
                } else {
                    showToast("Invalid email or password.", "error");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            }, 600);
        });
    }

    // --- Logic: FORGOT PASSWORD (DOB Recovery) ---
    const openForgotBtn = document.getElementById('openForgotBtn');
    const recoveryModal = document.getElementById('recoveryModal');
    const recoveryContent = document.getElementById('recoveryContent');
    const closeRecoveryBtn = document.getElementById('closeRecoveryBtn');
    const recoveryForm = document.getElementById('recoveryForm');
    const recoveryResult = document.getElementById('recoveryResult');
    const backToLoginBtn = document.getElementById('backToLoginBtn');

    if (openForgotBtn && recoveryModal) {
        
        const openModal = () => {
            recoveryModal.classList.remove('hidden');
            setTimeout(() => recoveryContent.classList.add('modal-enter-active'), 10);
            
            // Auto-fill email if typed in login
            const loginEmailVal = document.getElementById('loginEmail').value;
            if(loginEmailVal) document.getElementById('recovEmail').value = loginEmailVal;
        };

        const closeModal = () => {
            recoveryContent.classList.remove('modal-enter-active');
            setTimeout(() => {
                recoveryModal.classList.add('hidden');
                // Reset states
                recoveryForm.classList.remove('hidden');
                recoveryResult.classList.add('hidden');
                recoveryForm.reset();
            }, 300);
        };

        openForgotBtn.addEventListener('click', openModal);
        closeRecoveryBtn.addEventListener('click', closeModal);
        backToLoginBtn.addEventListener('click', closeModal);

        recoveryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('recovEmail').value.trim().toLowerCase();
            const dob = document.getElementById('recovDob').value;

            const users = JSON.parse(localStorage.getItem(DB_KEY)) || [];
            const user = users.find(u => u.email === email);

            if (!user) {
                showToast("Account not found.", "error");
                return;
            }

            if (user.dob === dob) {
                // Success - Reveal Password (Simulation)
                document.getElementById('revealedPassword').textContent = user.password;
                recoveryForm.classList.add('hidden');
                recoveryResult.classList.remove('hidden');
                showToast("Identity verified successfully.");
            } else {
                showToast("Incorrect Date of Birth.", "error");
            }
        });
    }
});