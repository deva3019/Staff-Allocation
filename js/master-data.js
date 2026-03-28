/**
 * StaffSync - Master Data Management & CRUD Engine
 * Developed by Deva Veera Kumaran
 * * Capabilities:
 * - Multi-Sheet Excel/CSV parsing via SheetJS
 * - Intelligent dynamic header detection
 * - LocalStorage state management
 * - Full CRUD (Create, Read, Update, Delete)
 * - Pagination & Real-time search
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration & State ---
    const STORAGE_KEY = 'MASTER_STAFF_DATA';
    const ITEMS_PER_PAGE = 50;
    
    let masterData = [];         // Source of truth
    let filteredData = [];       // View state (after search)
    let currentPage = 1;
    let selectedFile = null;

    // --- DOM Elements ---
    const tableBody = document.getElementById('staffTableBody');
    const totalCountBadge = document.getElementById('totalCountBadge');
    const searchInput = document.getElementById('searchInput');
    const pageInfo = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    // Upload Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const processFileBtn = document.getElementById('processFileBtn');
    
    // Form Elements
    const addStaffForm = document.getElementById('addStaffForm');
    
    // Modal Elements
    const editModal = document.getElementById('editModal');
    const editModalContent = document.getElementById('editModalContent');
    const editStaffForm = document.getElementById('editStaffForm');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // --- Utility: Theme & Footer ---
    document.getElementById('year').textContent = new Date().getFullYear();
    const initializeTheme = () => {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };
    initializeTheme();
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });
    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('STAFFSYNC_SESSION');
            window.location.href = 'login.html';
        });
    }

    // --- Utility: Toast Notifications ---
    const showToast = (message, type = 'success') => {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-primary-600';
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transform transition-all translate-y-10 opacity-0 duration-300 z-50`;
        
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

    // --- Core Data Management ---
    const loadData = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try { masterData = JSON.parse(stored); } 
            catch (e) { masterData = []; console.error("Data corrupted"); }
        } else {
            masterData = [];
        }
        applyFiltersAndRender();
    };

    const saveData = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(masterData));
        applyFiltersAndRender();
    };

    // --- CRUD: Read & Display (Pagination) ---
    const applyFiltersAndRender = () => {
        const query = searchInput.value.toLowerCase().trim();
        
        if (query === '') {
            filteredData = [...masterData];
        } else {
            filteredData = masterData.filter(staff => 
                (staff.id && staff.id.toLowerCase().includes(query)) ||
                (staff.name && staff.name.toLowerCase().includes(query)) ||
                (staff.school && staff.school.toLowerCase().includes(query)) ||
                (staff.phone && staff.phone.toString().includes(query))
            );
        }

        totalCountBadge.textContent = `${masterData.length} Records`;
        
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        renderTable();
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        
        if (filteredData.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="7" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    No matching records found.
                </td></tr>`;
            updatePaginationUI();
            return;
        }

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
        const pageData = filteredData.slice(startIndex, endIndex);

        pageData.forEach((staff, index) => {
            const sNo = startIndex + index + 1; 
            
            let badgeClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
            if (staff.designation.toLowerCase().includes("chief") && !staff.designation.toLowerCase().includes("asst")) badgeClass = "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800";
            else if (staff.designation.toLowerCase().includes("asst") || staff.designation.toLowerCase().includes("assistant")) badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800";
            else badgeClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800";

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border-b border-slate-100 dark:border-slate-800 last:border-0";
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-slate-500">${sNo}</td>
                <td class="px-6 py-4 font-semibold text-primary-600 dark:text-primary-400">${staff.id}</td>
                <td class="px-6 py-4 font-medium">${staff.name}</td>
                <td class="px-6 py-4 truncate max-w-[200px]" title="${staff.school}">${staff.school}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-xs font-bold ${badgeClass}">${staff.designation}</span></td>
                <td class="px-6 py-4">${staff.phone}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="window.openEditModal('${staff.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onclick="window.deleteRecord('${staff.id}')" class="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        updatePaginationUI();
    };

    const updatePaginationUI = () => {
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
        const startIndex = filteredData.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
        const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length);
        
        pageInfo.textContent = `Showing ${startIndex} - ${endIndex} of ${filteredData.length}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    };

    prevPageBtn.addEventListener('click', () => { if(currentPage > 1) { currentPage--; renderTable(); }});
    nextPageBtn.addEventListener('click', () => { 
        const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
        if(currentPage < totalPages) { currentPage++; renderTable(); }
    });
    searchInput.addEventListener('input', () => { currentPage = 1; applyFiltersAndRender(); });

    // --- CRUD: Create ---
    addStaffForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('addId').value.trim();
        if (masterData.some(s => s.id === id)) return showToast('Staff ID already exists!', 'error');

        masterData.push({
            id: id,
            name: document.getElementById('addName').value.trim(),
            school: document.getElementById('addSchool').value.trim(),
            designation: document.getElementById('addDesignation').value,
            phone: document.getElementById('addPhone').value.trim()
        });
        saveData();
        addStaffForm.reset();
        showToast('Staff member added successfully!');
    });

    // --- CRUD: Update ---
    window.openEditModal = (id) => {
        const staff = masterData.find(s => s.id === id);
        if(!staff) return;

        document.getElementById('editOriginalId').value = staff.id;
        document.getElementById('editId').value = staff.id;
        document.getElementById('editName').value = staff.name;
        document.getElementById('editSchool').value = staff.school;
        
        const desigSelect = document.getElementById('editDesignation');
        if(staff.designation.toLowerCase().includes('asst')) desigSelect.value = "Assistant Chief";
        else if(staff.designation.toLowerCase().includes('chief')) desigSelect.value = "Chief";
        else desigSelect.value = "Invigilator";

        document.getElementById('editPhone').value = staff.phone === "N/A" ? "" : staff.phone;

        editModal.classList.remove('hidden');
        editModalContent.classList.add('modal-enter-active');
    };

    const closeEditModal = () => {
        editModalContent.classList.remove('modal-enter-active');
        setTimeout(() => editModal.classList.add('hidden'), 300);
    };

    closeModalBtn.addEventListener('click', closeEditModal);
    cancelEditBtn.addEventListener('click', closeEditModal);

    editStaffForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const originalId = document.getElementById('editOriginalId').value;
        const newId = document.getElementById('editId').value.trim();

        if (originalId !== newId && masterData.some(s => s.id === newId)) return showToast('New Staff ID already exists!', 'error');

        const index = masterData.findIndex(s => s.id === originalId);
        if (index !== -1) {
            masterData[index] = {
                id: newId,
                name: document.getElementById('editName').value.trim(),
                school: document.getElementById('editSchool').value.trim(),
                designation: document.getElementById('editDesignation').value,
                phone: document.getElementById('editPhone').value.trim() || "N/A"
            };
            saveData();
            closeEditModal();
            showToast('Record updated successfully!');
        }
    });

    // --- CRUD: Delete ---
    window.deleteRecord = (id) => {
        if(confirm(`Are you sure you want to delete staff ID ${id}?`)) {
            masterData = masterData.filter(s => s.id !== id);
            saveData();
            showToast('Record deleted.');
        }
    };

    clearAllBtn.addEventListener('click', () => {
        if(confirm('WARNING: This will delete ALL staff records. Are you absolutely sure?')) {
            masterData = [];
            saveData();
            showToast('Database cleared.', 'error');
        }
    });

    // --- FILE UPLOAD LOGIC (EXCEL/CSV via SheetJS) ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) handleFileSelection(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelection(e.target.files[0]);
    });

    const handleFileSelection = (file) => {
        if (!file.name.match(/\.(csv|xlsx|xls)$/i)) return showToast('Invalid file format. Please upload Excel or CSV.', 'error');
        selectedFile = file;
        dropZone.querySelector('p.font-medium').textContent = `Selected: ${file.name}`;
        dropZone.querySelector('p.font-medium').classList.add('text-primary-600', 'dark:text-primary-400');
        processFileBtn.disabled = false;
    };

    // 🌟 THE BULLETPROOF MULTI-SHEET PARSER
    processFileBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        const reader = new FileReader();
        processFileBtn.textContent = "Processing...";
        processFileBtn.disabled = true;

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let targetSheet = null;
                let headerRowIndex = 0;

                // 1. Scan ALL sheets in the workbook
                for (let sheetName of workbook.SheetNames) {
                    const ws = workbook.Sheets[sheetName];
                    const rawArray = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

                    // Scan the first 20 rows of this sheet
                    for (let i = 0; i < Math.min(20, rawArray.length); i++) {
                        const rowString = rawArray[i].join('').toLowerCase();
                        // Look for key identifiers (must be lowercase)
                        if ((rowString.includes('staff') || rowString.includes('id')) && rowString.includes('name') && rowString.includes('designation')) {
                            targetSheet = ws;
                            headerRowIndex = i;
                            break;
                        }
                    }
                    if (targetSheet) break; // Found it! Stop searching other sheets.
                }

                if (!targetSheet) {
                    showToast('Could not find a sheet containing Staff Data (ID, Name, Designation).', 'error');
                    resetUploader();
                    return;
                }

                // 2. Parse the correct sheet starting from the detected header row
                const rawJson = XLSX.utils.sheet_to_json(targetSheet, { range: headerRowIndex, defval: "" });
                
                if (rawJson.length === 0) {
                    showToast('The staff data sheet is empty.', 'error');
                    resetUploader();
                    return;
                }

                // 3. Smart Header Mapping
                const mappedData = rawJson.map(row => {
                    const keys = Object.keys(row);
                    const getVal = (possibleNames) => {
                        const matchedKey = keys.find(k => possibleNames.some(pn => k.toLowerCase().includes(pn)));
                        return matchedKey ? String(row[matchedKey]).trim() : "N/A";
                    };

                    return {
                        id: getVal(['staff id', 'id', 'emp no', 'staff no']),
                        name: getVal(['name', 'staff name', 'full name']),
                        school: getVal(['school name', 'school', 'institution', 'college']),
                        designation: getVal(['designation', 'role', 'post', 'position']),
                        phone: getVal(['ph no', 'phone', 'mobile', 'contact', 'ph']) 
                    };
                }).filter(staff => staff.id !== "N/A" && staff.id !== ""); // Filter out blank rows

                if (mappedData.length === 0) {
                    showToast('Found the sheet, but could not read the rows properly.', 'error');
                    resetUploader();
                    return;
                }

                // 4. Save Logic (Overwrite vs Append)
                const mode = document.querySelector('input[name="importMode"]:checked').value;
                if (mode === 'overwrite') {
                    masterData = mappedData;
                } else {
                    let newAdds = 0;
                    mappedData.forEach(newStaff => {
                        if (!masterData.some(existing => existing.id === newStaff.id)) {
                            masterData.push(newStaff);
                            newAdds++;
                        }
                    });
                    showToast(`Imported ${newAdds} new records (Skipped duplicates).`);
                }

                saveData();
                if(mode === 'overwrite') showToast(`Successfully imported ${mappedData.length} records.`);
                resetUploader();

            } catch (error) {
                console.error(error);
                showToast('Error processing file. Ensure it is a valid Excel/CSV.', 'error');
                resetUploader();
            }
        };

        reader.readAsArrayBuffer(selectedFile);
    });

    const resetUploader = () => {
        selectedFile = null;
        fileInput.value = "";
        dropZone.querySelector('p.font-medium').textContent = "Click to upload or drag and drop";
        dropZone.querySelector('p.font-medium').classList.remove('text-primary-600', 'dark:text-primary-400');
        processFileBtn.textContent = "Process File";
        processFileBtn.disabled = true;
    };

    // --- Run on Load ---
    loadData();
});