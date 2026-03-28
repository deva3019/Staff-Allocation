/**
 * StaffSync - Landing Page UI & Animation Logic
 * Developed by Deva Veera Kumaran
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Dynamic Footer Year ---
    document.getElementById('year').textContent = new Date().getFullYear();

    // --- 2. Theme Management (Dark/Light Mode) ---
    const themeToggleBtn = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;
    
    // Initialize theme based on localStorage or system preference
    const initializeTheme = () => {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            htmlElement.classList.add('dark');
        } else {
            htmlElement.classList.remove('dark');
        }
    };

    initializeTheme();

    // Toggle theme event
    themeToggleBtn.addEventListener('click', () => {
        htmlElement.classList.toggle('dark');
        localStorage.theme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    });


    // --- 3. Navbar Scroll Effect (Glassmorphism) ---
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            navbar.classList.add('glass-nav');
            navbar.classList.remove('border-transparent');
        } else {
            navbar.classList.remove('glass-nav');
            navbar.classList.add('border-transparent');
        }
    });


    // --- 4. Mobile Menu Toggle ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    let isMenuOpen = false;

    mobileMenuBtn.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        if (isMenuOpen) {
            mobileMenu.classList.remove('hidden');
            // Change icon to 'X'
            mobileMenuBtn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
        } else {
            mobileMenu.classList.add('hidden');
            // Change icon back to hamburger
            mobileMenuBtn.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>`;
        }
    });


    // --- 5. Scroll Reveal Animations (Intersection Observer) ---
    const revealElements = document.querySelectorAll('.reveal-up');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Animate only once for performance
            }
        });
    }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Trigger when 15% of element is visible
    });

    revealElements.forEach(el => revealObserver.observe(el));


    // --- 6. Number Counter Animation for Stats ---
    const statCounters = document.querySelectorAll('.stat-counter');
    let hasCounted = false;

    const animateCounters = () => {
        statCounters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 2000; // 2 seconds
            const increment = target / (duration / 16); // 60fps
            let current = 0;

            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.innerText = Math.ceil(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.innerText = target;
                    // Format large numbers with 'k' or '+'
                    if(target >= 1000) {
                        counter.innerText = (target / 1000).toFixed(0) + 'k+';
                    }
                }
            };
            updateCounter();
        });
    };

    // Trigger counters when stats section is visible
    const statsSection = document.querySelector('.grid-cols-2'); // Parent of counters
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasCounted) {
                animateCounters();
                hasCounted = true;
            }
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }
});