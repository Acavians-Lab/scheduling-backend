// Global state
let currentSchedule = {
    staff: [],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    schedule: {},
    holidays: {},
    budgetHours: 0,
    currentDay: null,
    currentShift: null,
    activeTemplateId: null
};

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
    checkLoginStatus();
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
function addStaff() {
    const input = document.getElementById('staffNameInput');
    const name = input.value.trim();

    if (name && !currentSchedule.staff.includes(name)) {
        currentSchedule.staff.push(name);
        input.value = '';
        renderStaffList();
        saveToLocalStorage();
    }
}

function handleStaffEnter(event) {
    if (event.key === 'Enter') {
        addStaff();
    }
}

function removeStaff(name) {
    if (!confirm(`Remove ${name} from staff list? This will remove them from all scheduled shifts.`)) {
        return;
    }

    // Remove from staff list
    currentSchedule.staff = currentSchedule.staff.filter(s => s !== name);

    // Remove from all shifts, but keep the shift entries for other staff
    currentSchedule.days.forEach(day => {
        if (currentSchedule.schedule[day]) {
            ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
                if (currentSchedule.schedule[day][shift]) {
                    currentSchedule.schedule[day][shift].forEach(entry => {
                        // Remove this staff member from the entry
                        entry.staff = entry.staff.filter(staffName => staffName !== name);
                    });

                    // Remove entries that have no staff left
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
    saveToLocalStorage();
}

function renderStaffList() {
    const container = document.getElementById('staffList');
    if (currentSchedule.staff.length === 0) {
        container.innerHTML = '<div style="color: #999; padding: 10px;">No staff added yet. Add staff members to get started.</div>';
        return;
    }

    container.innerHTML = currentSchedule.staff.map(name => `
        <div class="staff-chip">
            <span>${escapeHtml(name)}</span>
            <span class="remove" onclick="removeStaff('${escapeHtml(name)}')">&times;</span>
        </div>
    `).join('');
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
    if (currentSchedule.staff.length === 0) {
        alert('Please add staff members first!');
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
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        if (day === selectedDay) {
            label.classList.add('selected');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = day;
        checkbox.checked = (day === selectedDay);

        checkbox.addEventListener('change', function() {
            if (this.checked) {
                label.classList.add('selected');
            } else {
                label.classList.remove('selected');
            }
        });

        const span = document.createElement('span');
        span.textContent = day;

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function renderStaffCheckboxes() {
    const container = document.getElementById('staffCheckboxes');
    container.innerHTML = currentSchedule.staff.map(name => `
        <label class="checkbox-item">
            <input type="checkbox" value="${escapeHtml(name)}">
            <span>${escapeHtml(name)}</span>
        </label>
    `).join('');
}

function saveShift() {
    const selectedDays = Array.from(document.querySelectorAll('#dayCheckboxes input:checked')).map(cb => cb.value);
    const selectedStaff = Array.from(document.querySelectorAll('#staffCheckboxes input:checked')).map(cb => cb.value);
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const shiftType = document.getElementById('shiftType').value;

    if (selectedDays.length === 0 || selectedStaff.length === 0 || !startTime || !endTime) {
        alert('Please fill all fields');
        return;
    }

    selectedDays.forEach(day => {
        if (!currentSchedule.schedule[day]) {
            currentSchedule.schedule[day] = {};
        }
        if (!currentSchedule.schedule[day][shiftType]) {
            currentSchedule.schedule[day][shiftType] = [];
        }

        currentSchedule.schedule[day][shiftType].push({
            startTime,
            endTime,
            staff: selectedStaff
        });
    });

    closeModal('shiftModal');
    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

function removeStaffFromShift(day, shift, entryIndex, staffName) {
    const entry = currentSchedule.schedule[day][shift][entryIndex];
    entry.staff = entry.staff.filter(name => name !== staffName);

    if (entry.staff.length === 0) {
        currentSchedule.schedule[day][shift].splice(entryIndex, 1);
    }

    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

// Global variable to store edit context
let editContext = {
    day: null,
    shift: null,
    entryIndex: null,
    staffName: null
};

function openEditShiftModal(day, shift, entryIndex, staffName) {
    const entry = currentSchedule.schedule[day][shift][entryIndex];

    // Store context
    editContext = { day, shift, entryIndex, staffName };

    // Populate modal
    document.getElementById('editStaffName').value = staffName;
    document.getElementById('editDay').value = day;
    document.getElementById('editShiftType').value = shift;
    document.getElementById('editStartTime').value = entry.startTime;
    document.getElementById('editEndTime').value = entry.endTime;

    openModal('editShiftModal');
}

function saveEditedShift() {
    const { day, shift, entryIndex, staffName } = editContext;
    const newShift = document.getElementById('editShiftType').value;
    const newStartTime = document.getElementById('editStartTime').value;
    const newEndTime = document.getElementById('editEndTime').value;

    if (!newStartTime || !newEndTime) {
        alert('Please fill in both start and end times');
        return;
    }

    const entry = currentSchedule.schedule[day][shift][entryIndex];
    const otherStaff = entry.staff.filter(name => name !== staffName);

    // Remove staff from current entry
    if (otherStaff.length > 0) {
        entry.staff = otherStaff;
    } else {
        // Remove the entire entry if this was the only staff member
        currentSchedule.schedule[day][shift].splice(entryIndex, 1);
    }

    // Add staff to new shift (could be same shift with different times)
    if (!currentSchedule.schedule[day][newShift]) {
        currentSchedule.schedule[day][newShift] = [];
    }

    // Check if there's an existing entry with the same times
    const existingEntry = currentSchedule.schedule[day][newShift].find(
        e => e.startTime === newStartTime && e.endTime === newEndTime
    );

    if (existingEntry) {
        // Add to existing entry if times match
        if (!existingEntry.staff.includes(staffName)) {
            existingEntry.staff.push(staffName);
        }
    } else {
        // Create new entry
        currentSchedule.schedule[day][newShift].push({
            startTime: newStartTime,
            endTime: newEndTime,
            staff: [staffName]
        });
    }

    closeModal('editShiftModal');
    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

// Statistics
function updateStats() {
    const totalHours = calculateTotalHours();
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    document.getElementById('budgetHours').textContent = currentSchedule.budgetHours.toFixed(1);
}

function calculateTotalHours() {
    let total = 0;
    currentSchedule.days.forEach(day => {
        total += calculateDayHours(day);
    });
    return total;
}

function calculateDayHours(day) {
    if (currentSchedule.holidays[day]) return 0;

    const daySchedule = currentSchedule.schedule[day] || {};
    let total = 0;

    ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
        const entries = daySchedule[shift] || [];
        entries.forEach(entry => {
            const hours = calculateShiftHours(entry.startTime, entry.endTime);
            total += hours * entry.staff.length;
        });
    });

    return total;
}

function calculateShiftHours(start, end) {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return (endMinutes - startMinutes) / 60;
}

// Holidays
function openHolidaysModal() {
    const container = document.getElementById('holidayDays');
    container.innerHTML = currentSchedule.days.map(day => {
        const isHoliday = currentSchedule.holidays[day];
        return `
            <label class="checkbox-item ${isHoliday ? 'selected' : ''}">
                <input type="checkbox" value="${day}" ${isHoliday ? 'checked' : ''}>
                <span>${day}</span>
            </label>
        `;
    }).join('');

    const existingHolidayName = Object.values(currentSchedule.holidays).find(h => h && h !== true);
    document.getElementById('holidayName').value = existingHolidayName || '';

    openModal('holidaysModal');
}

function saveHoliday() {
    const selectedDays = Array.from(document.querySelectorAll('#holidayDays input:checked')).map(cb => cb.value);
    const holidayName = document.getElementById('holidayName').value.trim();

    currentSchedule.holidays = {};

    selectedDays.forEach(day => {
        currentSchedule.holidays[day] = holidayName || true;
    });

    closeModal('holidaysModal');
    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

function clearAllHolidays() {
    if (confirm('Clear all holidays?')) {
        currentSchedule.holidays = {};
        closeModal('holidaysModal');
        renderSchedule();
        updateStats();
        saveToLocalStorage();
    }
}

// Template Management
function openTemplateModal() {
    renderTemplateList();
    openModal('templateModal');
}

function renderTemplateList() {
    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const container = document.getElementById('templateList');
    const emptyState = document.getElementById('emptyTemplateState');

    if (templates.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = templates.map((template, index) => `
        <div class="template-item ${currentSchedule.activeTemplateId === index ? 'active' : ''}">
            <div class="template-content" onclick="loadTemplate(${index})">
                <div class="template-title">${escapeHtml(template.name)}</div>
                <div class="template-info">${template.dateRange} | ${template.budgetHours}h budget</div>
            </div>
            <div class="template-actions">
                <button class="template-btn" onclick="event.stopPropagation(); renameTemplate(${index})" title="Rename">✏️</button>
                <button class="template-btn" onclick="event.stopPropagation(); deleteTemplate(${index})" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function loadTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    if (!templates[index]) return;

    const template = templates[index];

    currentSchedule.activeTemplateId = index;
    currentSchedule.staff = [...template.staff];
    currentSchedule.schedule = JSON.parse(JSON.stringify(template.schedule));
    currentSchedule.holidays = {...template.holidays};
    currentSchedule.budgetHours = template.budgetHours;

    renderStaffList();
    renderSchedule();
    updateStats();
    saveToLocalStorage();
    showScheduleView();
    closeModal('templateModal');
}

function deleteTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    if (!templates[index]) return;

    if (!confirm(`Delete template "${templates[index].name}"?`)) return;

    templates.splice(index, 1);
    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    if (currentSchedule.activeTemplateId === index) {
        currentSchedule.activeTemplateId = null;
    } else if (currentSchedule.activeTemplateId > index) {
        currentSchedule.activeTemplateId--;
    }

    saveToLocalStorage();
    renderTemplateList();
}

function renameTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    if (!templates[index]) return;

    const newName = prompt('Enter new template name:', templates[index].name);
    if (!newName || newName.trim() === '') return;

    templates[index].name = newName.trim();
    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    saveToLocalStorage();
    renderTemplateList();
}

function openCreateTemplateModal() {
    openModal('createTemplateModal');
}

function confirmCreateTemplate() {
    const startDate = document.getElementById('templateStartDate').value;
    const endDate = document.getElementById('templateEndDate').value;
    const budgetHours = parseFloat(document.getElementById('templateBudget').value) || 0;

    if (!startDate || !endDate || budgetHours <= 0) {
        alert('Please fill all fields with valid values');
        return;
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (start >= end) {
        alert('End date must be after start date');
        return;
    }

    // Format dates consistently (MM/DD/YYYY)
    const formatDate = (date) => {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    const dateRange = `${formatDate(start)} - ${formatDate(end)}`;
    const templateName = dateRange;

    currentSchedule.budgetHours = budgetHours;
    currentSchedule.staff = [];
    currentSchedule.schedule = {};
    currentSchedule.holidays = {};

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const newTemplateIndex = templates.length;

    templates.push({
        name: templateName,
        dateRange: dateRange,
        budgetHours: budgetHours,
        staff: [],
        schedule: {},
        holidays: {},
        createdAt: new Date().toISOString()
    });

    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    currentSchedule.activeTemplateId = newTemplateIndex;

    document.getElementById('templateStartDate').value = '';
    document.getElementById('templateEndDate').value = '';
    document.getElementById('templateBudget').value = '';

    closeModal('createTemplateModal');
    showScheduleView();
    renderStaffList();
    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

function saveCurrentSchedule() {
    if (currentSchedule.activeTemplateId === null) {
        alert('No active template to save to. Please create a template first.');
        return;
    }

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[currentSchedule.activeTemplateId];

    if (!template) {
        alert('Template not found.');
        return;
    }

    template.staff = [...currentSchedule.staff];
    template.schedule = JSON.parse(JSON.stringify(currentSchedule.schedule));
    template.holidays = {...currentSchedule.holidays};
    template.budgetHours = currentSchedule.budgetHours;
    template.lastModified = new Date().toISOString();

    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    saveToDatabase();

    alert(`Template "${template.name}" saved successfully!`);
}

function saveCurrentTemplateToStorage() {
    if (currentSchedule.activeTemplateId === null) return;

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[currentSchedule.activeTemplateId];

    if (!template) return;

    template.staff = [...currentSchedule.staff];
    template.schedule = JSON.parse(JSON.stringify(currentSchedule.schedule));
    template.holidays = {...currentSchedule.holidays};
    template.budgetHours = currentSchedule.budgetHours;
    template.lastModified = new Date().toISOString();

    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));
}

// PDF Generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const shifts = ['Morning', 'Afternoon', 'PM Meeting'];
    const days = currentSchedule.days;

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[currentSchedule.activeTemplateId];
    const dateRange = template ? template.dateRange : 'No Date Range';

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`Staff Schedule - ${dateRange}`, 148, 15, { align: 'center' });

    const startX = 10;
    let currentY = 25;

    shifts.forEach((shift, shiftIndex) => {
        const staffInShift = new Set();
        const shiftSchedules = {};

        days.forEach(day => {
            const daySchedule = currentSchedule.schedule[day] || {};
            const entries = daySchedule[shift] || [];

            entries.forEach(entry => {
                entry.staff.forEach(staffName => {
                    staffInShift.add(staffName);

                    if (!shiftSchedules[staffName]) {
                        shiftSchedules[staffName] = {};
                    }

                    const holidayName = currentSchedule.holidays[day];
                    if (holidayName) {
                        shiftSchedules[staffName][day] = 'OFF';
                    } else {
                        const formattedTime = `${formatTime12Hour(entry.startTime)} - ${formatTime12Hour(entry.endTime)}`;
                        shiftSchedules[staffName][day] = formattedTime;
                    }
                });
            });
        });

        if (staffInShift.size > 0) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(shift, startX, currentY);
            currentY += 7;

            const staffColWidth = 40;
            const dayWidth = (287 - startX - staffColWidth) / days.length;
            const cellHeight = 12;

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setFillColor(200, 200, 200);
            doc.rect(startX, currentY, staffColWidth, cellHeight, 'F');
            doc.text('Staff', startX + 2, currentY + 8);

            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.rect(x, currentY, dayWidth, cellHeight, 'F');
                doc.text(day.substring(0, 3), x + dayWidth / 2, currentY + 8, { align: 'center' });
            });

            currentY += cellHeight;

            const sortedStaff = Array.from(staffInShift).sort((a, b) => a.localeCompare(b));

            sortedStaff.forEach((staffName) => {
                const schedule = shiftSchedules[staffName] || {};

                const scheduleEntries = days.map(day => schedule[day] || '');
                const maxLines = Math.max(...scheduleEntries.map(entry => {
                    if (!entry) return 1;
                    return entry.split('\n').length;
                }));

                const maxCellHeight = Math.max(cellHeight, maxLines * cellHeight);

                doc.setFillColor(255, 255, 255);
                doc.rect(startX, currentY, staffColWidth, maxCellHeight, 'FD');
                doc.setFont(undefined, 'bold');
                doc.setFontSize(9);
                doc.text(staffName, startX + 2, currentY + maxCellHeight / 2 + 2);

                doc.setFont(undefined, 'normal');
                days.forEach((day, index) => {
                    const x = startX + staffColWidth + (index * dayWidth);
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

            currentY += 15;
        }

        if (currentY > 170 && shiftIndex < shifts.length - 1) {
            doc.addPage();
            currentY = 20;
        }
    });

    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`, 148, 200, { align: 'center' });
    }

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
    saveToLocalStorage();

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

// Local Storage

function saveToLocalStorage() {
    localStorage.setItem('currentSchedule', JSON.stringify(currentSchedule));
    if (currentSchedule.activeTemplateId !== null) {
        saveCurrentTemplateToStorage();
    }
    saveToDatabase();
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('currentSchedule');
    if (saved) {
        const data = JSON.parse(saved);
        currentSchedule.staff = data.staff || [];
        currentSchedule.schedule = data.schedule || {};
        currentSchedule.holidays = data.holidays || {};
        currentSchedule.budgetHours = data.budgetHours || 0;
        currentSchedule.activeTemplateId = data.activeTemplateId !== undefined ? data.activeTemplateId : null;
    }
}

// MongoDB Cloud Sync
async function loadFromDatabase() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        loadFromLocalStorage();
        return;
    }

    try {
        const url = window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api/schedule'
            : '/api/schedule';

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            if (data.allSchedules && data.allSchedules.length > 0) {
                localStorage.setItem('scheduleTemplates', JSON.stringify(data.allSchedules));
            }

            if (data.currentScheduleId !== null) {
                const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
                const template = templates[data.currentScheduleId];
                if (template) {
                    currentSchedule.activeTemplateId = data.currentScheduleId;
                    currentSchedule.staff = [...(template.staff || [])];
                    currentSchedule.schedule = JSON.parse(JSON.stringify(template.schedule || {}));
                    currentSchedule.holidays = {...(template.holidays || {})};
                    currentSchedule.budgetHours = template.budgetHours || 0;
                }
            }
        } else {
            loadFromLocalStorage();
        }
    } catch (error) {
        loadFromLocalStorage();
    }
}

async function saveToDatabase() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const url = window.location.hostname === 'localhost'
            ? 'http://localhost:3000/api/schedule'
            : '/api/schedule';

        const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');

        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                allSchedules: templates,
                currentScheduleId: currentSchedule.activeTemplateId,
                staffDirectory: currentSchedule.staff,
                budgetHours: currentSchedule.budgetHours,
                weekDates: {},
                holidays: currentSchedule.holidays
            })
        });
    } catch (error) {
        // Silent fail - data still in localStorage
    }
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

// Initialize on load
window.addEventListener('DOMContentLoaded', init);