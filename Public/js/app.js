// Global state
let currentSchedule = {
    staff: [], // Now array of objects: {name, status, notes}
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    schedule: {},
    holidays: {},
    budgetHours: 0,
    currentDay: null,
    currentShift: null,
    activeTemplateId: null,
    currentEditingStaffIndex: null
};

// Prevent multiple initializations
let isInitialized = false;

// Utility function to convert 24-hour time to 12-hour format with AM/PM
function formatTime12Hour(time24) {
    if (!time24) return '';

    const [hours, minutes] = time24.split(':');
    let hour = parseInt(hours, 10);
    const minute = minutes;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'

    return `${hour}:${minute} ${ampm}`;
}

// Initialize
async function init() {
    if (isInitialized) {
        console.log('Already initialized, skipping...');
        return;
    }

    isInitialized = true;
    console.log('Initializing app...');

    await loadFromDatabase();
    checkTemplateStatus();
    renderStaffList();
    renderSchedule();
    updateStats();
}

function checkTemplateStatus() {
    if (currentSchedule.budgetHours === 0 || currentSchedule.activeTemplateId === null) {
        // No template active, show welcome screen
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('scheduleView').style.display = 'none';
    } else {
        // Template is active, show schedule
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('scheduleView').style.display = 'block';
    }
}

function showScheduleView() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('scheduleView').style.display = 'block';
}

// Staff Management
function openAddStaffModal() {
    document.getElementById('newStaffName').value = '';
    document.getElementById('newStaffStatus').value = 'active';
    document.getElementById('newStaffNotes').value = '';
    openModal('addStaffModal');
}

function saveNewStaff() {
    const name = document.getElementById('newStaffName').value.trim();
    const status = document.getElementById('newStaffStatus').value;
    const notes = document.getElementById('newStaffNotes').value.trim();

    if (!name) {
        alert('Please enter a staff name');
        return;
    }

    // Check if staff already exists
    const existingStaff = currentSchedule.staff.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingStaff) {
        alert('A staff member with this name already exists');
        return;
    }

    try {
        currentSchedule.staff.push({
            name: name,
            status: status,
            notes: notes
        });

        renderStaffList();
        saveToDatabase();
        closeModal('addStaffModal');
    } catch (error) {
        console.error('Error adding staff:', error);
        alert('Error adding staff member: ' + error.message);
    }
}

function openEditStaffModal() {
    renderStaffEditList();
    openModal('editStaffListModal');
}

function renderStaffEditList() {
    const container = document.getElementById('staffEditList');
    const emptyState = document.getElementById('emptyStaffState');

    if (currentSchedule.staff.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = currentSchedule.staff.map((staffMember, index) => `
        <div class="staff-edit-item" onclick="openIndividualStaffEdit(${index})">
            <div class="staff-edit-info">
                <div class="staff-edit-name">${escapeHtml(staffMember.name)}</div>
                <div class="staff-edit-status ${staffMember.status}">${staffMember.status === 'active' ? 'Active' : 'Inactive'}</div>
            </div>
            <div class="staff-edit-arrow">›</div>
        </div>
    `).join('');
}

function openIndividualStaffEdit(index) {
    currentSchedule.currentEditingStaffIndex = index;
    const staffMember = currentSchedule.staff[index];

    document.getElementById('editStaffNameField').value = staffMember.name;
    document.getElementById('editStaffStatus').value = staffMember.status;
    document.getElementById('editStaffNotes').value = staffMember.notes || '';

    closeModal('editStaffListModal');
    openModal('editIndividualStaffModal');
}

function saveStaffEdits() {
    const index = currentSchedule.currentEditingStaffIndex;
    const name = document.getElementById('editStaffNameField').value.trim();
    const status = document.getElementById('editStaffStatus').value;
    const notes = document.getElementById('editStaffNotes').value.trim();

    if (!name) {
        alert('Please enter a staff name');
        return;
    }

    const oldName = currentSchedule.staff[index].name;

    // Check if new name conflicts with another staff member
    if (name.toLowerCase() !== oldName.toLowerCase()) {
        const existingStaff = currentSchedule.staff.find((s, i) =>
            i !== index && s.name.toLowerCase() === name.toLowerCase()
        );
        if (existingStaff) {
            alert('A staff member with this name already exists');
            return;
        }
    }

    // Update staff member
    currentSchedule.staff[index] = {
        name: name,
        status: status,
        notes: notes
    };

    // If name changed, update all schedule entries
    if (name !== oldName) {
        updateStaffNameInSchedule(oldName, name);
    }

    renderStaffList();
    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('editIndividualStaffModal');
}

function deleteStaffMember() {
    const index = currentSchedule.currentEditingStaffIndex;
    const staffMember = currentSchedule.staff[index];

    if (!confirm(`Delete ${staffMember.name}? This will remove them from all scheduled shifts.`)) {
        return;
    }

    const staffName = staffMember.name;

    // Remove from staff list
    currentSchedule.staff.splice(index, 1);

    // Remove from all shifts
    currentSchedule.days.forEach(day => {
        if (currentSchedule.schedule[day]) {
            ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
                if (currentSchedule.schedule[day][shift]) {
                    currentSchedule.schedule[day][shift].forEach(entry => {
                        entry.staff = entry.staff.filter(name => name !== staffName);
                    });

                    currentSchedule.schedule[day][shift] = currentSchedule.schedule[day][shift].filter(
                        entry => entry.staff.length > 0
                    );
                }
            });
        }
    });

    renderStaffList();
    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('editIndividualStaffModal');
}

function updateStaffNameInSchedule(oldName, newName) {
    currentSchedule.days.forEach(day => {
        if (currentSchedule.schedule[day]) {
            ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
                if (currentSchedule.schedule[day][shift]) {
                    currentSchedule.schedule[day][shift].forEach(entry => {
                        entry.staff = entry.staff.map(name => name === oldName ? newName : name);
                    });
                }
            });
        }
    });
}

function addStaff() {
    // Legacy function - redirects to new modal
    openAddStaffModal();
}

function handleStaffEnter(event) {
    // Legacy function - no longer used
    if (event.key === 'Enter') {
        openAddStaffModal();
    }
}

function removeStaff(name) {
    // Legacy function - now handled through edit modal
    const index = currentSchedule.staff.findIndex(s => s.name === name);
    if (index !== -1) {
        currentSchedule.currentEditingStaffIndex = index;
        deleteStaffMember();
    }
}

function renderStaffList() {
    const container = document.getElementById('staffList');

    // Filter to show only active staff
    const activeStaff = currentSchedule.staff.filter(s => s.status === 'active');

    if (activeStaff.length === 0) {
        container.innerHTML = '<div style="color: #999; padding: 10px;">No active staff members. Add staff to get started.</div>';
        return;
    }

    container.innerHTML = activeStaff.map(staffMember => `
        <div class="staff-chip" onclick="openStaffNotesModal('${escapeHtml(staffMember.name)}')">
            <span>${escapeHtml(staffMember.name)}</span>
            ${staffMember.notes ? '<span style="font-size: 12px;">📝</span>' : ''}
        </div>
    `).join('');
}

// Staff Notes Modal Functions
let currentNotesStaffName = null;

function openStaffNotesModal(staffName) {
    const staffMember = currentSchedule.staff.find(s => s.name === staffName);
    if (!staffMember) return;

    currentNotesStaffName = staffName;
    document.getElementById('staffNotesTitle').textContent = `Notes for ${staffName}`;
    document.getElementById('staffNotesTextarea').value = staffMember.notes || '';
    openModal('staffNotesModal');
}

function saveStaffNotes() {
    if (!currentNotesStaffName) return;

    const notes = document.getElementById('staffNotesTextarea').value.trim();
    const staffMember = currentSchedule.staff.find(s => s.name === currentNotesStaffName);

    if (staffMember) {
        staffMember.notes = notes;
        renderStaffList();
        saveToDatabase();
        closeModal('staffNotesModal');
        alert('Notes saved successfully!');
    }
}

function deleteStaffNotes() {
    if (!currentNotesStaffName) return;

    if (!confirm('Delete all notes for this staff member?')) return;

    const staffMember = currentSchedule.staff.find(s => s.name === currentNotesStaffName);

    if (staffMember) {
        staffMember.notes = '';
        document.getElementById('staffNotesTextarea').value = '';
        renderStaffList();
        saveToDatabase();
        closeModal('staffNotesModal');
        alert('Notes deleted successfully!');
    }
}

// Schedule Rendering
function renderSchedule() {
    const container = document.getElementById('scheduleGrid');

    container.innerHTML = currentSchedule.days.map(day => {
        const isHoliday = currentSchedule.holidays[day];
        const daySchedule = currentSchedule.schedule[day] || {};
        const dayHours = calculateDayHours(day);

        // Check if title is long (more than 15 characters with holiday text)
        const dayTitle = `${day}${isHoliday ? ' - Day Off' : ''}`;
        const isLongTitle = dayTitle.length > 15;

        return `
            <div class="day-card ${isHoliday ? 'holiday' : ''}">
                <div class="day-header">
                    <div class="day-title ${isLongTitle ? 'long-title' : ''}">${dayTitle}</div>
                    <div class="day-hours">${dayHours.toFixed(1)}h</div>
                </div>
                ${isHoliday ? renderHolidayDisplay(isHoliday) : renderShifts(day, daySchedule)}
            </div>
        `;
    }).join('');
}

function renderHolidayDisplay(holidayName) {
    return `
        <div class="holiday-display">
            <div class="holiday-name">${escapeHtml(holidayName)}</div>
        </div>
    `;
}

function renderShifts(day, daySchedule) {
    const shifts = ['Morning', 'Afternoon', 'PM Meeting'];

    return shifts.map(shift => {
        const entries = daySchedule[shift] || [];

        return `
            <div class="shift-section">
                <div class="shift-header" onclick="openShiftModal('${day}', '${shift}')">
                    + ${shift}
                </div>
                ${entries.map((entry, entryIndex) => {
            // Sort staff alphabetically
            const sortedStaff = [...entry.staff].sort((a, b) => a.localeCompare(b));

            // Format times to 12-hour format
            const formattedStartTime = formatTime12Hour(entry.startTime);
            const formattedEndTime = formatTime12Hour(entry.endTime);

            // Create individual tiles for each staff member
            return sortedStaff.map((staffName) => `
                        <div class="shift-entry">
                            <div class="shift-entry-header">
                                <span class="shift-time" title="Time range">${formattedStartTime} - ${formattedEndTime}</span>
                                <span class="remove-shift" onclick="removeStaffFromShift('${day}', '${shift}', ${entryIndex}, '${escapeHtml(staffName)}')">Remove</span>
                            </div>
                            <div class="shift-staff" onclick="openEditShiftModal('${day}', '${shift}', ${entryIndex}, '${escapeHtml(staffName)}')" style="cursor: pointer;" title="Click to edit shift">${escapeHtml(staffName)}</div>
                        </div>
                    `).join('');
        }).join('')}
            </div>
        `;
    }).join('');
}

// Shift Management
function openShiftModal(day, shift) {
    const activeStaff = currentSchedule.staff.filter(s => s.status === 'active');

    if (activeStaff.length === 0) {
        alert('Please add active staff members first!');
        return;
    }

    currentSchedule.currentDay = day;
    currentSchedule.currentShift = shift;

    document.getElementById('shiftType').value = shift;
    renderDayCheckboxes(day);
    renderStaffCheckboxes();
    openModal('shiftModal');
}

function renderDayCheckboxes(selectedDay) {
    const container = document.getElementById('dayCheckboxes');
    container.innerHTML = '';

    currentSchedule.days.forEach(day => {
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `day-${day}`;
        input.value = day;
        input.checked = day === selectedDay;

        const label = document.createElement('label');
        label.htmlFor = `day-${day}`;
        label.textContent = day;

        checkbox.appendChild(input);
        checkbox.appendChild(label);
        container.appendChild(checkbox);
    });
}

function renderStaffCheckboxes() {
    const container = document.getElementById('staffCheckboxes');
    container.innerHTML = '';

    // Filter to show only active staff
    const activeStaff = currentSchedule.staff.filter(s => s.status === 'active');

    activeStaff.forEach(staffMember => {
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `staff-${staffMember.name}`;
        input.value = staffMember.name;

        const label = document.createElement('label');
        label.htmlFor = `staff-${staffMember.name}`;
        label.textContent = staffMember.name;

        // Add notes indicator if notes exist
        if (staffMember.notes) {
            label.title = `Notes: ${staffMember.notes}`;
            label.style.cursor = 'help';
            const noteIcon = document.createElement('span');
            noteIcon.textContent = ' 📝';
            noteIcon.style.fontSize = '12px';
            label.appendChild(noteIcon);
        }

        checkbox.appendChild(input);
        checkbox.appendChild(label);
        container.appendChild(checkbox);
    });
}

function saveShift() {
    const shiftType = document.getElementById('shiftType').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!startTime || !endTime) {
        alert('Please enter start and end times');
        return;
    }

    const selectedDays = Array.from(document.querySelectorAll('#dayCheckboxes input:checked')).map(cb => cb.value);
    const selectedStaff = Array.from(document.querySelectorAll('#staffCheckboxes input:checked')).map(cb => cb.value);

    if (selectedDays.length === 0) {
        alert('Please select at least one day');
        return;
    }

    if (selectedStaff.length === 0) {
        alert('Please select at least one staff member');
        return;
    }

    selectedDays.forEach(day => {
        if (!currentSchedule.schedule[day]) {
            currentSchedule.schedule[day] = {};
        }
        if (!currentSchedule.schedule[day][shiftType]) {
            currentSchedule.schedule[day][shiftType] = [];
        }

        const existingEntry = currentSchedule.schedule[day][shiftType].find(
            entry => entry.startTime === startTime && entry.endTime === endTime
        );

        if (existingEntry) {
            selectedStaff.forEach(staff => {
                if (!existingEntry.staff.includes(staff)) {
                    existingEntry.staff.push(staff);
                }
            });
        } else {
            currentSchedule.schedule[day][shiftType].push({
                startTime,
                endTime,
                staff: [...selectedStaff]
            });
        }
    });

    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('shiftModal');

    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
}

function removeStaffFromShift(day, shift, entryIndex, staffName) {
    if (!confirm(`Remove ${staffName} from this shift?`)) return;

    const entry = currentSchedule.schedule[day][shift][entryIndex];
    entry.staff = entry.staff.filter(name => name !== staffName);

    if (entry.staff.length === 0) {
        currentSchedule.schedule[day][shift].splice(entryIndex, 1);
    }

    renderSchedule();
    updateStats();
    saveToDatabase();
}

function openEditShiftModal(day, shift, entryIndex, staffName) {
    const entry = currentSchedule.schedule[day][shift][entryIndex];
    const staffMember = currentSchedule.staff.find(s => s.name === staffName);

    document.getElementById('editStaffName').value = staffName;
    document.getElementById('editDay').value = day;
    document.getElementById('editShiftType').value = shift;
    document.getElementById('editStartTime').value = entry.startTime;
    document.getElementById('editEndTime').value = entry.endTime;

    // Display staff notes if they exist
    const notesDisplay = document.getElementById('staffNotesDisplay');
    const notesContent = document.getElementById('editStaffNotesDisplay');

    if (staffMember && staffMember.notes) {
        notesContent.textContent = staffMember.notes;
        notesDisplay.style.display = 'block';
    } else {
        notesDisplay.style.display = 'none';
    }

    currentSchedule.currentDay = day;
    currentSchedule.currentShift = shift;
    currentSchedule.currentEntryIndex = entryIndex;
    currentSchedule.currentStaffName = staffName;

    openModal('editShiftModal');
}

function saveEditedShift() {
    const day = currentSchedule.currentDay;
    const oldShift = currentSchedule.currentShift;
    const entryIndex = currentSchedule.currentEntryIndex;
    const staffName = currentSchedule.currentStaffName;

    const newShiftType = document.getElementById('editShiftType').value;
    const newStartTime = document.getElementById('editStartTime').value;
    const newEndTime = document.getElementById('editEndTime').value;

    if (!newStartTime || !newEndTime) {
        alert('Please enter start and end times');
        return;
    }

    const oldEntry = currentSchedule.schedule[day][oldShift][entryIndex];
    oldEntry.staff = oldEntry.staff.filter(name => name !== staffName);

    if (oldEntry.staff.length === 0) {
        currentSchedule.schedule[day][oldShift].splice(entryIndex, 1);
    }

    if (!currentSchedule.schedule[day][newShiftType]) {
        currentSchedule.schedule[day][newShiftType] = [];
    }

    const existingEntry = currentSchedule.schedule[day][newShiftType].find(
        entry => entry.startTime === newStartTime && entry.endTime === newEndTime
    );

    if (existingEntry) {
        if (!existingEntry.staff.includes(staffName)) {
            existingEntry.staff.push(staffName);
        }
    } else {
        currentSchedule.schedule[day][newShiftType].push({
            startTime: newStartTime,
            endTime: newEndTime,
            staff: [staffName]
        });
    }

    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('editShiftModal');
}

function calculateDayHours(day) {
    if (currentSchedule.holidays[day]) return 0;

    const daySchedule = currentSchedule.schedule[day] || {};
    let totalHours = 0;

    ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
        const entries = daySchedule[shift] || [];
        entries.forEach(entry => {
            const hours = calculateHours(entry.startTime, entry.endTime);
            totalHours += hours * entry.staff.length;
        });
    });

    return totalHours;
}

function calculateTotalHours() {
    let total = 0;
    currentSchedule.days.forEach(day => {
        total += calculateDayHours(day);
    });
    return total;
}

function calculateHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return (endMinutes - startMinutes) / 60;
}

function updateStats() {
    const totalHours = calculateTotalHours();
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    document.getElementById('budgetHours').textContent = currentSchedule.budgetHours.toFixed(1);
}

// Template Management
async function openTemplateModal() {
    await loadTemplatesFromDatabase();
    openModal('templateModal');
}

async function loadTemplatesFromDatabase() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token for loading templates');
        return;
    }

    try {
        console.log('Loading templates from:', `${API_URL}/api/templates`);

        const response = await fetch(`${API_URL}/api/templates`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Template response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Templates loaded:', data);
            renderTemplateList(data.templates || []);
        } else {
            console.error('Failed to load templates:', response.status, response.statusText);
            const errorData = await response.json().catch(() => ({}));
            console.error('Error details:', errorData);
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

function renderTemplateList(templates) {
    const container = document.getElementById('templateList');
    const emptyState = document.getElementById('emptyTemplateState');

    if (!templates || templates.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = templates.map((template, index) => `
        <div class="template-item ${currentSchedule.activeTemplateId === index ? 'active' : ''}">
            <div class="template-info">
                <div class="template-name">${escapeHtml(template.name)}</div>
                <div class="template-meta">${template.budgetHours}h budget</div>
            </div>
            <div class="template-actions">
                <button class="btn btn-primary btn-sm" onclick="loadTemplate(${index})">Load</button>
                <button class="btn btn-danger btn-sm" onclick="deleteTemplate(${index})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function loadTemplate(index) {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/templates/${index}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const template = data.template;

            currentSchedule.activeTemplateId = index;
            currentSchedule.staff = [...(template.staff || [])];
            currentSchedule.schedule = JSON.parse(JSON.stringify(template.schedule || {}));
            currentSchedule.holidays = {...(template.holidays || {})};
            currentSchedule.budgetHours = template.budgetHours || 0;

            await saveToDatabase();
            renderStaffList();
            renderSchedule();
            updateStats();
            checkTemplateStatus();
            closeModal('templateModal');
        }
    } catch (error) {
        console.error('Error loading template:', error);
        alert('Failed to load template');
    }
}

async function deleteTemplate(index) {
    if (!confirm('Delete this template? This cannot be undone.')) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/api/templates/${index}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            await loadTemplatesFromDatabase();
            if (currentSchedule.activeTemplateId === index) {
                currentSchedule.activeTemplateId = null;
                currentSchedule.budgetHours = 0;
                checkTemplateStatus();
            }
        }
    } catch (error) {
        console.error('Error deleting template:', error);
        alert('Failed to delete template');
    }
}

async function saveCurrentSchedule() {
    const templateName = prompt('Enter a name for this template:');
    if (!templateName) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token for saving template');
        return;
    }

    try {
        console.log('Saving template:', templateName);
        console.log('Template data:', {
            name: templateName,
            staff: currentSchedule.staff,
            schedule: currentSchedule.schedule,
            holidays: currentSchedule.holidays,
            budgetHours: currentSchedule.budgetHours
        });

        const response = await fetch(`${API_URL}/api/templates`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: templateName,
                staff: currentSchedule.staff,
                schedule: currentSchedule.schedule,
                holidays: currentSchedule.holidays,
                budgetHours: currentSchedule.budgetHours
            })
        });

        console.log('Save template response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('Template saved successfully:', data);
            currentSchedule.activeTemplateId = data.templateId;
            await saveToDatabase();
            alert('Template saved successfully!');
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to save template:', response.status, errorData);
            alert('Failed to save template: ' + (errorData.msg || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving template:', error);
        alert('Failed to save template: ' + error.message);
    }
}

// Holidays
function openHolidaysModal() {
    renderHolidayCheckboxes();
    openModal('holidaysModal');
}

function renderHolidayCheckboxes() {
    const container = document.getElementById('holidayDays');
    container.innerHTML = '';

    currentSchedule.days.forEach(day => {
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `holiday-${day}`;
        input.value = day;
        input.checked = !!currentSchedule.holidays[day];

        const label = document.createElement('label');
        label.htmlFor = `holiday-${day}`;
        label.textContent = day;

        checkbox.appendChild(input);
        checkbox.appendChild(label);
        container.appendChild(checkbox);
    });
}

function saveHoliday() {
    const holidayName = document.getElementById('holidayName').value.trim();
    if (!holidayName) {
        alert('Please enter a holiday name');
        return;
    }

    const selectedDays = Array.from(document.querySelectorAll('#holidayDays input:checked')).map(cb => cb.value);

    if (selectedDays.length === 0) {
        alert('Please select at least one day');
        return;
    }

    selectedDays.forEach(day => {
        currentSchedule.holidays[day] = holidayName;
    });

    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('holidaysModal');
    document.getElementById('holidayName').value = '';
}

function clearAllHolidays() {
    if (!confirm('Clear all holidays?')) return;

    currentSchedule.holidays = {};
    renderSchedule();
    updateStats();
    saveToDatabase();
    closeModal('holidaysModal');
}

// Create Template
function openCreateTemplateModal() {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    document.getElementById('templateStartDate').value = monday.toISOString().split('T')[0];
    document.getElementById('templateEndDate').value = friday.toISOString().split('T')[0];
    document.getElementById('templateBudget').value = '';

    openModal('createTemplateModal');
}

async function confirmCreateTemplate() {
    const startDate = document.getElementById('templateStartDate').value;
    const endDate = document.getElementById('templateEndDate').value;
    const budget = parseFloat(document.getElementById('templateBudget').value);

    if (!startDate || !endDate) {
        alert('Please select start and end dates');
        return;
    }

    if (!budget || budget <= 0) {
        alert('Please enter a valid budget (greater than 0)');
        return;
    }

    currentSchedule.schedule = {};
    currentSchedule.holidays = {};
    currentSchedule.budgetHours = budget;
    currentSchedule.staff = [];
    currentSchedule.activeTemplateId = null;

    await saveToDatabase();
    renderSchedule();
    updateStats();
    showScheduleView();
    closeModal('createTemplateModal');
}

// PDF Generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Weekly Schedule', margin, margin + 7);

    const startDate = document.getElementById('templateStartDate')?.value || 'N/A';
    const endDate = document.getElementById('templateEndDate')?.value || 'N/A';
    const dateRange = `${startDate} to ${endDate}`;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(dateRange, margin, margin + 13);

    const totalHours = calculateTotalHours();
    const budgetHours = currentSchedule.budgetHours;
    doc.text(`Total Hours: ${totalHours.toFixed(1)} / Budget: ${budgetHours.toFixed(1)}`, margin, margin + 18);

    const days = currentSchedule.days;
    const staffList = currentSchedule.staff;

    const startY = margin + 25;
    const staffColWidth = 40;
    const dayWidth = (pageWidth - margin * 2 - staffColWidth) / days.length;
    const cellHeight = 8;

    doc.setFillColor(200, 200, 200);
    doc.rect(margin, startY, staffColWidth, cellHeight, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('Staff', margin + 2, startY + 5.5);

    days.forEach((day, index) => {
        const x = margin + staffColWidth + (index * dayWidth);
        doc.setFillColor(200, 200, 200);
        doc.rect(x, startY, dayWidth, cellHeight, 'F');
        doc.text(day, x + dayWidth / 2, startY + 5.5, { align: 'center' });
    });

    let currentY = startY + cellHeight;

    staffList.forEach((staffName) => {
        const schedule = {};

        days.forEach(day => {
            const isHoliday = currentSchedule.holidays[day];
            if (isHoliday) {
                schedule[day] = 'OFF';
                return;
            }

            const daySchedule = currentSchedule.schedule[day] || {};
            const staffShifts = [];

            ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
                const entries = daySchedule[shift] || [];
                entries.forEach(entry => {
                    if (entry.staff.includes(staffName)) {
                        const start = formatTime12Hour(entry.startTime);
                        const end = formatTime12Hour(entry.endTime);
                        staffShifts.push(`${start}-${end}`);
                    }
                });
            });

            schedule[day] = staffShifts.length > 0 ? staffShifts.join('\n') : '';
        });

        const shiftsPerDay = days.map(day => (schedule[day] || '').split('\n').length);
        const maxShifts = Math.max(...shiftsPerDay, 1);
        const maxCellHeight = maxShifts * cellHeight;

        if (currentY + maxCellHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
        }

        doc.setFillColor(255, 255, 255);
        doc.rect(margin, currentY, staffColWidth, maxCellHeight, 'FD');
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(staffName, margin + 2, currentY + maxCellHeight / 2 + 2);

        doc.setFont(undefined, 'normal');
        days.forEach((day, index) => {
            const x = margin + staffColWidth + (index * dayWidth);
            const timeOrOff = schedule[day] || '';
            const holidayName = currentSchedule.holidays[day];

            if (timeOrOff === 'OFF' || holidayName) {
                doc.setFillColor(255, 255, 255);
                doc.rect(x, currentY, dayWidth, maxCellHeight, 'FD');
                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(9);

                if (holidayName && holidayName !== true) {
                    doc.text('Off', x + dayWidth / 2, currentY + maxCellHeight / 2 - 1, { align: 'center' });
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(7);
                    doc.text(holidayName, x + dayWidth / 2, currentY + maxCellHeight / 2 + 3, { align: 'center' });
                    doc.setFontSize(9);
                } else {
                    doc.text('Off', x + dayWidth / 2, currentY + maxCellHeight / 2 + 2, { align: 'center' });
                }

                doc.setFont(undefined, 'normal');
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(255, 255, 255);
                doc.rect(x, currentY, dayWidth, maxCellHeight, 'FD');
                if (timeOrOff) {
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(8);
                    const timeLines = timeOrOff.split('\n');
                    if (timeLines.length > 1) {
                        let textY = currentY + 6;
                        timeLines.forEach(line => {
                            doc.text(line, x + dayWidth / 2, textY, { align: 'center' });
                            textY += cellHeight;
                        });
                    } else {
                        doc.text(timeOrOff, x + dayWidth / 2, currentY + maxCellHeight / 2 + 2, { align: 'center' });
                    }
                }
            }
        });

        currentY += maxCellHeight;
    });

    doc.save(`schedule-${dateRange.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    alert('PDF generated successfully!');
}

// Clear Schedule
function clearSchedule() {
    if (!confirm('Clear the entire schedule? This cannot be undone.')) return;

    currentSchedule.schedule = {};
    currentSchedule.holidays = {};
    currentSchedule.budgetHours = 0;
    currentSchedule.activeTemplateId = null;
    currentSchedule.staff = [];

    renderSchedule();
    updateStats();
    saveToDatabase();

    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('scheduleView').style.display = 'none';
}

// Modal Management
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// MongoDB Database Operations - PRIMARY DATA SOURCE
async function loadFromDatabase() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/schedule`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            // Load current schedule state from database
            currentSchedule.activeTemplateId = data.currentScheduleId !== undefined ? data.currentScheduleId : null;

            // Convert old staff format to new format if needed
            let staffData = data.staffDirectory || [];
            if (staffData.length > 0 && typeof staffData[0] === 'string') {
                // Old format: array of strings
                // Convert to new format: array of objects
                staffData = staffData.map(name => ({
                    name: name,
                    status: 'active',
                    notes: ''
                }));
                console.log('Converted old staff format to new format');
            }
            currentSchedule.staff = staffData;

            currentSchedule.schedule = data.currentSchedule || {};
            currentSchedule.holidays = data.holidays || {};
            currentSchedule.budgetHours = data.budgetHours || 0;

            console.log('Data loaded from MongoDB');
        } else {
            console.error('Failed to load data from MongoDB');
        }
    } catch (error) {
        console.error('Error loading from database:', error);
    }
}

// Debounce timer for save operations
let saveDebounceTimer = null;

async function saveToDatabase() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token, cannot save');
        return;
    }

    // Clear existing timer
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
    }

    // Debounce: wait 500ms before actually saving
    saveDebounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(`${API_URL}/api/schedule`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    currentScheduleId: currentSchedule.activeTemplateId,
                    staffDirectory: currentSchedule.staff,
                    currentSchedule: currentSchedule.schedule,
                    budgetHours: currentSchedule.budgetHours,
                    holidays: currentSchedule.holidays
                })
            });

            if (response.ok) {
                console.log('Data saved to MongoDB');
            } else {
                console.error('Failed to save to MongoDB');
            }
        } catch (error) {
            console.error('Error saving to database:', error);
        }
    }, 500);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Note: init() is called from auth.js after successful login
// Do not call init() automatically on page load