/**
 * StaffSync - Advanced Allocation Engine & Dashboard
 * Developed by Deva Veera Kumaran
 * * Features:
 * - Smart Local Search Engine (Debounced)
 * - Real-time Rule Validation
 * - Auto-Fill Algorithm
 * - Production-grade PDF Generation (jsPDF + autoTable)
 * - Excel Export (SheetJS)
 * - Session & State Persistence
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. CONFIGURATION & STATE INITIALIZATION
    // ==========================================
    const KEYS = {
        MASTER: 'MASTER_STAFF_DATA',
        SESSION: 'STAFFSYNC_SESSION',
        CURRENT_ALLOC: 'STAFFSYNC_CURRENT_ALLOC',
        DRAFTS: 'STAFFSYNC_DRAFTS'
    };

    // State Container
    const state = {
        masterData: [],
        allocation: [], // Array of staff objects currently allocated
        rules: { chief: 1, asst: 1, invig: 20 },
        docParams: { school: '', title: 'Staff Invigilation Duty List', date: '' }
    };

    // ==========================================
    // 2. AUTHENTICATION & UI SETUP
    // ==========================================
    const sessionData = JSON.parse(sessionStorage.getItem(KEYS.SESSION));
    if (!sessionData) {
        window.location.href = 'login.html'; // Protect route
        return;
    }

    // Set UI Details
    document.getElementById('userNameDisplay').textContent = sessionData.name;
    document.getElementById('userAvatar').textContent = sessionData.name.charAt(0).toUpperCase();

    // Theme Management
    const htmlEl = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlEl.classList.add('dark');
    }
    document.getElementById('themeToggle').addEventListener('click', () => {
        htmlEl.classList.toggle('dark');
        localStorage.theme = htmlEl.classList.contains('dark') ? 'dark' : 'light';
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem(KEYS.SESSION);
        window.location.href = 'login.html';
    });

    // Default Date to Today
    document.getElementById('docDate').valueAsDate = new Date();

    // ==========================================
    // 3. UTILITY FUNCTIONS
    // ==========================================
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-primary-600';
        
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 transform transition-all translate-y-10 opacity-0 duration-300 pointer-events-auto max-w-sm`;
        
        const icon = type === 'success' ? `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : 
                     type === 'warning' ? `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>` :
                     `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
            
        toast.innerHTML = `${icon} <span class="text-sm font-medium">${message}</span>`;
        container.appendChild(toast);
        
        requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
        setTimeout(() => { toast.classList.add('opacity-0', 'scale-95'); setTimeout(() => toast.remove(), 300); }, 3500);
    };

    // Data Loaders
    const loadMasterData = () => {
        const data = localStorage.getItem(KEYS.MASTER);
        if (data) state.masterData = JSON.parse(data);
        if (state.masterData.length === 0) showToast('Master Data is empty. Please import staff data first.', 'warning');
    };

    const loadSavedState = () => {
        const saved = localStorage.getItem(KEYS.CURRENT_ALLOC);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.allocation = parsed.allocation || [];
            if (parsed.docParams) {
                document.getElementById('docSchoolName').value = parsed.docParams.school;
                document.getElementById('docCenterId').value = parsed.docParams.centerId;
                document.getElementById('docTitle').value = parsed.docParams.title;
                document.getElementById('docDate').value = parsed.docParams.date;
            }
            if(parsed.rules) {
                document.getElementById('ruleChief').value = parsed.rules.chief;
                document.getElementById('ruleAsst').value = parsed.rules.asst;
                document.getElementById('ruleInvig').value = parsed.rules.invig;
                applyRules(); // Updates state object
            }
        }
    };

    const saveCurrentState = () => {
        state.docParams = {
            school: document.getElementById('docSchoolName').value,
            centerId: document.getElementById('docCenterId').value,
            title: document.getElementById('docTitle').value,
            date: document.getElementById('docDate').value
        };
        localStorage.setItem(KEYS.CURRENT_ALLOC, JSON.stringify({
            allocation: state.allocation,
            rules: state.rules,
            docParams: state.docParams
        }));
    };

    // ==========================================
    // 4. SMART AUTO-SUGGEST ENGINE
    // ==========================================
    const smartInput = document.getElementById('smartInput');
    const suggestDropdown = document.getElementById('suggestDropdown');
    const suggestList = document.getElementById('suggestList');
    
    let debounceTimer;

    smartInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 2) {
            suggestDropdown.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(() => {
            // Filter: Match ID or Name, AND ensure they aren't already in the allocation
            const results = state.masterData.filter(staff => {
                const isMatch = staff.id.toLowerCase().includes(query) || staff.name.toLowerCase().includes(query);
                const isNotAllocated = !state.allocation.some(a => a.id === staff.id);
                return isMatch && isNotAllocated;
            }).slice(0, 10); // Limit to top 10 for perf

            renderSuggestions(results);
        }, 150); // 150ms debounce
    });

    const renderSuggestions = (results) => {
        suggestList.innerHTML = '';
        if (results.length === 0) {
            suggestList.innerHTML = `<li class="px-4 py-3 text-sm text-slate-500">No available matches found.</li>`;
        } else {
            results.forEach(staff => {
                const li = document.createElement('li');
                li.className = "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition flex justify-between items-center group";
                
                // Determine badge color
                let bColor = "bg-slate-100 text-slate-600";
                if(staff.designation.toLowerCase().includes('chief')) bColor = "bg-purple-100 text-purple-700";
                if(staff.designation.toLowerCase().includes('asst')) bColor = "bg-blue-100 text-blue-700";
                if(staff.designation.toLowerCase().includes('invigilator')) bColor = "bg-green-100 text-green-700";

                li.innerHTML = `
                    <div>
                        <div class="font-bold text-sm text-primary-600 dark:text-primary-400 group-hover:text-primary-700">${staff.id}</div>
                        <div class="text-xs font-medium">${staff.name} <span class="text-slate-400 font-normal">(${staff.school})</span></div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${bColor}">${staff.designation}</span>
                `;
                li.addEventListener('click', () => {
                    addStaffToAllocation(staff);
                    smartInput.value = '';
                    suggestDropdown.classList.add('hidden');
                    smartInput.focus();
                });
                suggestList.appendChild(li);
            });
        }
        suggestDropdown.classList.remove('hidden');
    };

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!smartInput.contains(e.target) && !suggestDropdown.contains(e.target)) {
            suggestDropdown.classList.add('hidden');
        }
    });

    // ==========================================
    // 5. ALLOCATION ENGINE & RENDERING
    // ==========================================
    
    // Categorize role strictly for UI rendering
    const determineRole = (designation) => {
        const d = designation.toLowerCase();
        if (d.includes('asst') || d.includes('assistant')) return 'asst';
        if (d.includes('chief') || d.includes('hm') || d.includes('head')) return 'chief';
        return 'invig';
    };

    const addStaffToAllocation = (staffRecord, customRole = null) => {
        if (state.allocation.some(s => s.id === staffRecord.id)) {
            showToast(`Staff ${staffRecord.id} is already allocated.`, 'error');
            return false;
        }

        // Assign role based on designation or custom override
        const role = customRole || determineRole(staffRecord.designation);
        
        state.allocation.push({ ...staffRecord, allocatedRole: role });
        saveCurrentState();
        updateUI();
        showToast(`Added ${staffRecord.name} to allocation.`);
        return true;
    };

    // Global exposed function for row-level actions
    window.removeStaff = (id) => {
        state.allocation = state.allocation.filter(s => s.id !== id);
        saveCurrentState();
        updateUI();
    };

    window.changeAllocatedRole = (id, selectElement) => {
        const newRole = selectElement.value;
        const index = state.allocation.findIndex(s => s.id === id);
        if (index > -1) {
            state.allocation[index].allocatedRole = newRole;
            saveCurrentState();
            updateUI();
            showToast('Staff role updated for this session.');
        }
    };

    // Core Render Loop
    const updateUI = () => {
        const emptyState = document.getElementById('emptyState');
        const tablesContainer = document.getElementById('tablesContainer');

        if (state.allocation.length === 0) {
            emptyState.classList.remove('hidden');
            tablesContainer.classList.add('hidden');
            updateProgress(0, 0, 0);
            return;
        }

        emptyState.classList.add('hidden');
        tablesContainer.classList.remove('hidden');

        // Reset Tables
        const tBodies = { chief: document.getElementById('tbodyChief'), asst: document.getElementById('tbodyAsst'), invig: document.getElementById('tbodyInvig') };
        Object.values(tBodies).forEach(tb => tb.innerHTML = '');

        const counts = { chief: 0, asst: 0, invig: 0 };

        state.allocation.forEach(staff => {
            const role = staff.allocatedRole;
            counts[role]++;
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition fade-in";
            
            // Build the Role Select dropdown for override
            const roleSelectHTML = `
                <select onchange="window.changeAllocatedRole('${staff.id}', this)" class="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="chief" ${role === 'chief' ? 'selected' : ''}>Chief</option>
                    <option value="asst" ${role === 'asst' ? 'selected' : ''}>Asst Chief</option>
                    <option value="invig" ${role === 'invig' ? 'selected' : ''}>Invigilator</option>
                </select>
            `;

            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-slate-500">${counts[role]}</td>
                <td class="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">${staff.id}</td>
                <td class="px-4 py-3 font-medium">${staff.name}</td>
                <td class="px-4 py-3 text-slate-500 truncate max-w-[150px]" title="${staff.school}">${staff.school}</td>
                <td class="px-4 py-3">${roleSelectHTML}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="window.removeStaff('${staff.id}')" class="text-slate-400 hover:text-red-500 transition p-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </td>
            `;
            tBodies[role].appendChild(tr);
        });

        // Update Badges
        document.getElementById('countBadgeChief').textContent = counts.chief;
        document.getElementById('countBadgeAsst').textContent = counts.asst;
        document.getElementById('countBadgeInvig').textContent = counts.invig;

        // Update Progress Bars
        updateProgress(counts.chief, counts.asst, counts.invig);
    };

    const updateProgress = (c, a, i) => {
        const updateBar = (idSuffix, current, target, colors) => {
            const bar = document.getElementById(`progBar${idSuffix}`);
            const txt = document.getElementById(`progText${idSuffix}`);
            let percent = target > 0 ? (current / target) * 100 : 100;
            if(percent > 100) percent = 100;
            
            bar.style.width = `${percent}%`;
            txt.textContent = `${current} / ${target}`;
            
            // Color logic: Orange if over-allocated, Red if 0, Green/Default if perfectly met
            if (current > target) { bar.className = `h-2.5 rounded-full transition-all duration-500 bg-orange-500`; txt.classList.add('text-orange-500', 'font-bold'); }
            else if (current === target && target > 0) { bar.className = `h-2.5 rounded-full transition-all duration-500 bg-green-500`; txt.classList.remove('text-orange-500'); txt.classList.add('text-green-600', 'dark:text-green-400', 'font-bold'); }
            else { bar.className = `h-2.5 rounded-full transition-all duration-500 ${colors}`; txt.className = 'text-slate-500 font-bold'; }
        };

        updateBar('Chief', c, state.rules.chief, 'bg-purple-600');
        updateBar('Asst', a, state.rules.asst, 'bg-blue-600');
        updateBar('Invig', i, state.rules.invig, 'bg-green-600');
    };

    // ==========================================
    // 6. RULES & ADVANCED ACTIONS
    // ==========================================
    const applyRules = () => {
        state.rules = {
            chief: parseInt(document.getElementById('ruleChief').value) || 0,
            asst: parseInt(document.getElementById('ruleAsst').value) || 0,
            invig: parseInt(document.getElementById('ruleInvig').value) || 0
        };
        saveCurrentState();
        updateUI(); // Triggers progress bar recount
    };
    document.getElementById('applyRulesBtn').addEventListener('click', () => {
        applyRules();
        showToast('Allocation rules updated.');
    });

    // Auto-Fill Magic Button
    document.getElementById('autoFillBtn').addEventListener('click', () => {
        if(state.masterData.length === 0) {
            showToast('No Master Data available to auto-fill from.', 'error');
            return;
        }

        // Calculate missing
        const currentCounts = { chief: 0, asst: 0, invig: 0 };
        state.allocation.forEach(s => currentCounts[s.allocatedRole]++);

        let added = 0;
        const addMissing = (role, targetCount) => {
            let missing = targetCount - currentCounts[role];
            if (missing <= 0) return;

            // Find available staff in master data that match this role natively
            const available = state.masterData.filter(m => 
                !state.allocation.some(a => a.id === m.id) && determineRole(m.designation) === role
            );

            // Shuffle and pick
            const shuffled = available.sort(() => 0.5 - Math.random());
            const toAdd = shuffled.slice(0, missing);
            
            toAdd.forEach(staff => {
                state.allocation.push({ ...staff, allocatedRole: role });
                added++;
            });
        };

        addMissing('chief', state.rules.chief);
        addMissing('asst', state.rules.asst);
        addMissing('invig', state.rules.invig);

        if (added > 0) {
            saveCurrentState();
            updateUI();
            showToast(`Magic Auto-Fill added ${added} staff members!`);
        } else {
            // Check if we didn't add because we lacked specific roles in master data
            showToast('Could not fill slots. Either targets are met, or no matching staff left in Master Data.', 'warning');
        }
    });

    // Bulk CSV Upload for specific session
    document.getElementById('csvUploadInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            // Split by newline, remove quotes/spaces, ignore empties
            const ids = text.split(/\r?\n/).map(row => row.replace(/['"]/g, '').trim().split(',')[0]).filter(id => id);
            
            let successCount = 0;
            let missingCount = 0;

            ids.forEach(id => {
                const staffRecord = state.masterData.find(m => m.id.toLowerCase() === id.toLowerCase());
                if(staffRecord) {
                    if(addStaffToAllocation(staffRecord)) successCount++;
                } else {
                    missingCount++;
                }
            });

            if(successCount > 0) showToast(`Bulk Imported ${successCount} IDs.`);
            if(missingCount > 0) showToast(`${missingCount} IDs were not found in Master Data.`, 'warning');
            
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    });

    document.getElementById('clearAllocationBtn').addEventListener('click', () => {
        if(confirm('Are you sure you want to clear the entire allocation board? This cannot be undone.')) {
            state.allocation = [];
            saveCurrentState();
            updateUI();
            showToast('Allocation board cleared.');
        }
    });


    // ==========================================
    // 7. EXPORT ENGINE: PDF & EXCEL
    // ==========================================
    
    // PDF Generation using jsPDF and autoTable
    // PDF Generation using jsPDF and autoTable
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        if(state.allocation.length === 0) { showToast('Cannot generate PDF. Allocation is empty.', 'error'); return; }

        const docSchool = document.getElementById('docSchoolName').value.trim() || 'Institution Name Not Set';
        const docCenterId = document.getElementById('docCenterId').value.trim() || 'N/A';
        const docTitle = document.getElementById('docTitle').value.trim() || 'Staff Allocation List';
        const docDate = document.getElementById('docDate').value || new Date().toISOString().split('T')[0];

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const primaryColor = [79, 70, 229];

        // --- NEW Header Section ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(docSchool, pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text(docTitle, pageWidth / 2, 28, { align: 'center' });

        doc.setFontSize(10);
        // Print Date on the left, Center ID on the right
        doc.text(`Exam Date: ${docDate}`, 14, 36);
        doc.text(`Exam Center ID: ${docCenterId}`, pageWidth - 14, 36, { align: 'right' });
        
        doc.setLineWidth(0.5);
        doc.line(14, 40, pageWidth - 14, 40);

        let currentY = 47; // Adjusted starting Y to account for the new header spacing

        // Helper to draw tables
        const drawCategoryTable = (roleKey, titleText) => {
            const data = state.allocation.filter(a => a.allocatedRole === roleKey);
            if (data.length === 0) return;

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(titleText, 14, currentY);
            currentY += 4;

            const tableBody = data.map((staff, index) => [
                index + 1,
                staff.id,
                staff.name,
                staff.school,
                staff.phone || 'N/A'
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['S.No', 'Staff ID', 'Name', 'School Name', 'Phone Number']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 4: { cellWidth: 35 } },
                didDrawPage: (data) => {
                    const str = 'Page ' + doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
                }
            });

            currentY = doc.lastAutoTable.finalY + 15;
        };

        drawCategoryTable('chief', 'Chief Superintendent (HM)');
        drawCategoryTable('asst', 'Assistant Chief Superintendent');
        drawCategoryTable('invig', 'Invigilators');

        // --- NEW Signature Area ---
        if (currentY > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            currentY = 30;
        }
        
        currentY += 25; // Add some space for the signature to be signed
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        // Print just "Signature" aligned perfectly to the right side
        doc.text("Signature", pageWidth - 14, currentY, { align: 'right' });

        const filename = `${docSchool.replace(/\s+/g, '_')}_Allocation_${docDate}.pdf`;
        doc.save(filename);
        showToast('PDF Generated Successfully!');
    });

    // Excel Export via SheetJS
    document.getElementById('exportExcelBtn').addEventListener('click', () => {
        if(state.allocation.length === 0) { showToast('Cannot export. Allocation is empty.', 'error'); return; }

        // Format data for excel
        const excelData = state.allocation.map((staff, i) => ({
            'S.No': i + 1,
            'Allocated Role': staff.allocatedRole.toUpperCase(),
            'Staff ID': staff.id,
            'Name': staff.name,
            'Original Designation': staff.designation,
            'School Name': staff.school,
            'Phone Number': staff.phone
        }));

        // Sort by Role to keep things organized
        const roleOrder = { chief: 1, asst: 2, invig: 3 };
        excelData.sort((a, b) => roleOrder[a['Allocated Role'].toLowerCase()] - roleOrder[b['Allocated Role'].toLowerCase()]);

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Auto-size columns slightly
        const wscols = [{wch:6}, {wch:15}, {wch:15}, {wch:25}, {wch:20}, {wch:40}, {wch:15}];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Allocation List");
        
        const docDate = document.getElementById('docDate').value || new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Allocation_Export_${docDate}.xlsx`);
        showToast('Excel Exported Successfully!');
    });


    // ==========================================
    // 8. DRAFT HISTORY MANAGEMENT
    // ==========================================
    document.getElementById('saveDraftBtn').addEventListener('click', () => {
        if (state.allocation.length === 0) { showToast('Nothing to save.', 'warning'); return; }
        
        const title = document.getElementById('docTitle').value || 'Untitled Draft';
        const school = document.getElementById('docSchoolName').value || 'Unknown School';
        const date = new Date().toLocaleString(); // Time of save

        const newDraft = {
            id: 'draft_' + Date.now(),
            dateSaved: date,
            title: title,
            school: school,
            allocation: [...state.allocation],
            docParams: { ...state.docParams }
        };

        let drafts = JSON.parse(localStorage.getItem(KEYS.DRAFTS)) || [];
        drafts.unshift(newDraft); // Add to top
        localStorage.setItem(KEYS.DRAFTS, JSON.stringify(drafts));
        
        showToast('Allocation saved to Drafts.');
    });

    document.getElementById('viewHistoryBtn').addEventListener('click', () => {
        const modal = document.getElementById('historyModal');
        const list = document.getElementById('draftList');
        const drafts = JSON.parse(localStorage.getItem(KEYS.DRAFTS)) || [];

        list.innerHTML = '';
        if(drafts.length === 0) {
            list.innerHTML = `<li class="text-center text-slate-500 py-10">No saved drafts yet.</li>`;
        } else {
            drafts.forEach(draft => {
                const li = document.createElement('li');
                li.className = "p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition";
                li.innerHTML = `
                    <div>
                        <h4 class="font-bold text-primary-600 dark:text-primary-400">${draft.title}</h4>
                        <p class="text-xs text-slate-500">${draft.school} • Saved: ${draft.dateSaved} • Staff Count: ${draft.allocation.length}</p>
                    </div>
                    <button class="text-sm font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 rounded hover:bg-slate-800 transition shadow" onclick="window.loadDraft('${draft.id}')">Load</button>
                `;
                list.appendChild(li);
            });
        }
        modal.classList.remove('hidden');
    });

    window.loadDraft = (draftId) => {
        const drafts = JSON.parse(localStorage.getItem(KEYS.DRAFTS)) || [];
        const draft = drafts.find(d => d.id === draftId);
        if(draft) {
            state.allocation = draft.allocation;
            document.getElementById('docSchoolName').value = draft.docParams.school;
            document.getElementById('docTitle').value = draft.docParams.title;
            // Retain current rules but load allocation
            saveCurrentState();
            updateUI();
            document.getElementById('historyModal').classList.add('hidden');
            showToast('Draft loaded successfully!');
        }
    };


    // ==========================================
    // 9. BOOTSTRAP EXECUTION
    // ==========================================
    loadMasterData();
    loadSavedState();
    updateUI(); // Initial render

});