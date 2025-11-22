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

            // Create individual tiles for each staff member
            return sortedStaff.map((staffName) => `
                        <div class="shift-entry">
                            <div class="shift-entry-header">
                                <span class="shift-time" onclick="editStaffTime('${day}', '${shift}', ${entryIndex}, '${escapeHtml(staffName)}')" title="Click to edit time">${entry.startTime} - ${entry.endTime}</span>
                                <span class="remove-shift" onclick="removeStaffFromShift('${day}', '${shift}', ${entryIndex}, '${escapeHtml(staffName)}')">Remove</span>
                            </div>
                            <div class="shift-staff">${escapeHtml(staffName)}</div>
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
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const selectedStaff = Array.from(document.querySelectorAll('#staffCheckboxes input:checked'))
        .map(cb => cb.value);
    const selectedDays = Array.from(document.querySelectorAll('#dayCheckboxes input:checked'))
        .map(cb => cb.value);

    if (!startTime || !endTime) {
        alert('Please enter start and end times!');
        return;
    }

    if (selectedStaff.length === 0) {
        alert('Please select at least one staff member!');
        return;
    }

    if (selectedDays.length === 0) {
        alert('Please select at least one day!');
        return;
    }

    const shift = document.getElementById('shiftType').value;

    // Create independent shift entries for each selected day
    selectedDays.forEach(day => {
        if (!currentSchedule.schedule[day]) {
            currentSchedule.schedule[day] = {};
        }
        if (!currentSchedule.schedule[day][shift]) {
            currentSchedule.schedule[day][shift] = [];
        }

        // Add the shift entry with all selected staff for this day
        currentSchedule.schedule[day][shift].push({
            startTime,
            endTime,
            staff: [...selectedStaff] // Create a new array for each day
        });
    });

    closeModal('shiftModal');
    renderSchedule();
    updateStats();
    saveToLocalStorage();

    // Reset form
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
}

function removeStaffFromShift(day, shift, entryIndex, staffName) {
    if (confirm(`Remove ${staffName} from this shift?`)) {
        const entry = currentSchedule.schedule[day][shift][entryIndex];

        // Remove the staff member from the array
        entry.staff = entry.staff.filter(name => name !== staffName);

        // If no staff left in this shift entry, remove the entire entry
        if (entry.staff.length === 0) {
            currentSchedule.schedule[day][shift].splice(entryIndex, 1);
        }

        renderSchedule();
        updateStats();
        saveToLocalStorage();
    }
}

function editStaffTime(day, shift, entryIndex, staffName) {
    const entry = currentSchedule.schedule[day][shift][entryIndex];

    if (!entry) return;

    // Prompt for new start and end times
    const newStartTime = prompt(`Edit start time for ${staffName}:`, entry.startTime);

    if (newStartTime === null) return; // User cancelled

    const newEndTime = prompt(`Edit end time for ${staffName}:`, entry.endTime);

    if (newEndTime === null) return; // User cancelled

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
        alert('Invalid time format! Please use HH:MM format (e.g., 09:00)');
        return;
    }

    // Check if this staff member is the only one with this time slot
    if (entry.staff.length === 1) {
        // Just update the existing entry
        entry.startTime = newStartTime;
        entry.endTime = newEndTime;
    } else {
        // Remove this staff from the current entry
        entry.staff = entry.staff.filter(name => name !== staffName);

        // Create a new entry for this staff member with the new times
        if (!currentSchedule.schedule[day][shift]) {
            currentSchedule.schedule[day][shift] = [];
        }

        currentSchedule.schedule[day][shift].push({
            startTime: newStartTime,
            endTime: newEndTime,
            staff: [staffName]
        });
    }

    renderSchedule();
    updateStats();
    saveToLocalStorage();
}

// Calculations
function calculateDayHours(day) {
    const daySchedule = currentSchedule.schedule[day] || {};
    let total = 0;

    ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
        const entries = daySchedule[shift] || [];
        entries.forEach(entry => {
            const hours = calculateHours(entry.startTime, entry.endTime);
            total += hours * entry.staff.length;
        });
    });

    return total;
}

function calculateHours(start, end) {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return (endMinutes - startMinutes) / 60;
}

function updateStats() {
    let totalHours = 0;
    currentSchedule.days.forEach(day => {
        totalHours += calculateDayHours(day);
    });

    document.getElementById('totalHours').textContent = totalHours.toFixed(1);

    const budgetElement = document.getElementById('budgetHours');
    const remaining = currentSchedule.budgetHours - totalHours;
    budgetElement.textContent = remaining.toFixed(1);
    budgetElement.classList.toggle('negative', remaining < 0);
}

// Holidays
function openHolidaysModal() {
    const container = document.getElementById('holidayDays');
    container.innerHTML = '';

    currentSchedule.days.forEach(day => {
        const isHoliday = currentSchedule.holidays[day];

        const label = document.createElement('label');
        label.className = 'checkbox-item';
        if (isHoliday) {
            label.classList.add('selected');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = day;
        checkbox.checked = isHoliday;

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

    openModal('holidaysModal');
}

function saveHoliday() {
    const name = document.getElementById('holidayName').value.trim();
    const selectedDays = Array.from(document.querySelectorAll('#holidayDays input:checked'))
        .map(cb => cb.value);

    if (!name) {
        alert('Please enter a holiday/event name!');
        return;
    }

    // Clear previous holidays
    currentSchedule.days.forEach(day => {
        if (currentSchedule.holidays[day]) {
            delete currentSchedule.holidays[day];
        }
    });

    // Set new holidays and clear their schedules
    selectedDays.forEach(day => {
        currentSchedule.holidays[day] = name;
        // Clear all shifts for this day
        if (currentSchedule.schedule[day]) {
            delete currentSchedule.schedule[day];
        }
    });

    closeModal('holidaysModal');
    renderSchedule();
    updateStats();
    saveToLocalStorage();

    document.getElementById('holidayName').value = '';
}

function clearAllHolidays() {
    if (!confirm('Clear all holidays? This will restore normal scheduling for all days.')) {
        return;
    }

    // Clear all holidays
    currentSchedule.holidays = {};

    // Uncheck and remove selected class from all checkboxes
    const checkboxes = document.querySelectorAll('#holidayDays input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.parentElement.classList.remove('selected');
    });

    closeModal('holidaysModal');
    renderSchedule();
    saveToLocalStorage();

    document.getElementById('holidayName').value = '';
}

// Templates
function openTemplateModal() {
    renderTemplateList();
    openModal('templateModal');
}

function renderTemplateList() {
    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const container = document.getElementById('templateList');
    const emptyState = document.getElementById('emptyTemplateState');

    if (templates.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'flex';
    emptyState.style.display = 'none';

    // Reverse to show newest first
    const sortedTemplates = [...templates].reverse();

    container.innerHTML = sortedTemplates.map((template, displayIndex) => {
        // Calculate actual index in original array
        const actualIndex = templates.length - 1 - displayIndex;

        // Use stored totalHours if available, otherwise calculate
        const totalHours = template.totalHours !== undefined ? template.totalHours : calculateTemplateHours(template);

        const isActive = currentSchedule.activeTemplateId === actualIndex;

        return `
            <div class="template-item ${isActive ? 'active-template' : ''}" onclick="loadTemplate(${actualIndex})">
                <div class="template-info">
                    <div class="template-name">
                        ${escapeHtml(template.name)}
                        ${isActive ? '<span style="color: #948d71; font-size: 12px; margin-left: 8px;">● ACTIVE</span>' : ''}
                    </div>
                    <div class="template-meta">
                        ${totalHours.toFixed(1)}h | Budget: ${template.budgetHours}h
                    </div>
                </div>
                <div class="template-actions">
                    <button class="btn btn-secondary" onclick="editTemplateBudget(event, ${actualIndex})" style="font-size: 12px; padding: 6px 12px;">Edit Budget</button>
                    ${!isActive ? `<button class="btn btn-danger" onclick="deleteTemplate(event, ${actualIndex})">Delete</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function calculateTemplateHours(template) {
    let total = 0;
    template.days.forEach(day => {
        const daySchedule = template.schedule[day] || {};
        ['Morning', 'Afternoon', 'PM Meeting'].forEach(shift => {
            const entries = daySchedule[shift] || [];
            entries.forEach(entry => {
                const hours = calculateHours(entry.startTime, entry.endTime);
                total += hours * entry.staff.length;
            });
        });
    });
    return total;
}

function openCreateTemplateModal() {
    openModal('createTemplateModal');
}

function saveCurrentSchedule() {
    // Save to the active template
    saveCurrentTemplateToStorage();

    // Save to current schedule localStorage
    saveToLocalStorage();
    alert('Schedule saved successfully!');
}

function confirmCreateTemplate() {
    const startDate = document.getElementById('templateStartDate').value;
    const endDate = document.getElementById('templateEndDate').value;
    const budget = parseFloat(document.getElementById('templateBudget').value);

    if (!startDate || !endDate) {
        alert('Please enter both start and end dates!');
        return;
    }

    if (!budget || budget <= 0) {
        alert('Please enter a valid budget hours!');
        return;
    }

    // Save current template before creating new one
    if (currentSchedule.activeTemplateId !== null) {
        saveCurrentTemplateToStorage();
    }

    // Format dates to "Month Day (Year) - Month Day (Year)"
    const start = new Date(startDate);
    const end = new Date(endDate);

    const formatDate = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()} (${date.getFullYear()})`;
    };

    const name = `${formatDate(start)} - ${formatDate(end)}`;

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');

    // Create new template with empty/current schedule
    const newTemplate = {
        name,
        startDate,
        endDate,
        budgetHours: budget,
        totalHours: 0,
        staff: [],
        days: [...currentSchedule.days],
        schedule: {},
        holidays: {},
        savedDate: new Date().toISOString()
    };

    templates.push(newTemplate);

    // Set this template as active and clear current schedule
    currentSchedule.activeTemplateId = templates.length - 1;
    currentSchedule.budgetHours = budget;
    currentSchedule.staff = [];
    currentSchedule.schedule = {};
    currentSchedule.holidays = {};

    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    closeModal('createTemplateModal');
    renderStaffList();
    renderSchedule();
    updateStats();
    saveToLocalStorage();

    // Show the schedule view
    showScheduleView();

    alert('Template created successfully! You can now add staff and create schedules.');

    document.getElementById('templateStartDate').value = '';
    document.getElementById('templateEndDate').value = '';
    document.getElementById('templateBudget').value = '';
}

function loadTemplate(index) {
    // Save current template before switching
    if (currentSchedule.activeTemplateId !== null) {
        saveCurrentTemplateToStorage();
    }

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[index];

    if (!template) return;

    currentSchedule.staff = [...template.staff];
    currentSchedule.schedule = JSON.parse(JSON.stringify(template.schedule));
    currentSchedule.holidays = {...template.holidays};
    currentSchedule.budgetHours = template.budgetHours;
    currentSchedule.activeTemplateId = index;

    closeModal('templateModal');
    renderStaffList();
    renderSchedule();
    updateStats();
    saveToLocalStorage();

    // Show the schedule view
    showScheduleView();
}

// Helper function to save current template to storage
function saveCurrentTemplateToStorage() {
    if (currentSchedule.activeTemplateId === null) return;

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[currentSchedule.activeTemplateId];

    if (template) {
        // Calculate total hours
        let totalHours = 0;
        currentSchedule.days.forEach(day => {
            totalHours += calculateDayHours(day);
        });

        // Update the template with current schedule
        template.totalHours = totalHours;
        template.staff = [...currentSchedule.staff];
        template.schedule = JSON.parse(JSON.stringify(currentSchedule.schedule));
        template.holidays = {...currentSchedule.holidays};
        template.budgetHours = currentSchedule.budgetHours;

        templates[currentSchedule.activeTemplateId] = template;
        localStorage.setItem('scheduleTemplates', JSON.stringify(templates));
    }
}

function deleteTemplate(event, index) {
    event.stopPropagation();

    if (!confirm('Delete this template?')) return;

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    templates.splice(index, 1);
    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    // If deleted template was active or before active, adjust active ID
    if (currentSchedule.activeTemplateId !== null) {
        if (currentSchedule.activeTemplateId === index) {
            currentSchedule.activeTemplateId = null;
        } else if (currentSchedule.activeTemplateId > index) {
            currentSchedule.activeTemplateId--;
        }
        saveToLocalStorage();
    }

    renderTemplateList();
}

function editTemplateBudget(event, index) {
    event.stopPropagation();

    const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
    const template = templates[index];

    if (!template) return;

    const newBudget = prompt(`Edit budget hours for ${template.name}:`, template.budgetHours);

    if (newBudget === null) return; // User cancelled

    const budgetNum = parseFloat(newBudget);

    if (isNaN(budgetNum) || budgetNum <= 0) {
        alert('Please enter a valid budget hours!');
        return;
    }

    // Update template budget
    template.budgetHours = budgetNum;
    templates[index] = template;
    localStorage.setItem('scheduleTemplates', JSON.stringify(templates));

    // If this is the active template, update current schedule budget
    if (currentSchedule.activeTemplateId === index) {
        currentSchedule.budgetHours = budgetNum;
        updateStats();
        saveToLocalStorage();
    }

    renderTemplateList();
}

// PDF Generation
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4

    // Get active template name and dates
    let templateName = 'Weekly Schedule';
    let dateRange = '';
    if (currentSchedule.activeTemplateId !== null) {
        const templates = JSON.parse(localStorage.getItem('scheduleTemplates') || '[]');
        const template = templates[currentSchedule.activeTemplateId];
        if (template) {
            dateRange = template.name;
        }
    }

    // Helper function to convert 24h to 12h format
    function format12Hour(time24) {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours);
        const ampm = h >= 12 ? 'pm' : 'am';
        h = h % 12 || 12;
        return `${h}:${minutes}${ampm}`;
    }

    // Helper function to determine correct shift based on start time
    function getShiftByTime(startTime) {
        if (!startTime) return 'Morning';
        const [hours] = startTime.split(':');
        const hour = parseInt(hours);

        // Morning: 5am - 11:59am
        if (hour >= 5 && hour < 12) return 'Morning';
        // Afternoon: 12pm - 4:59pm
        if (hour >= 12 && hour < 17) return 'Afternoon';
        // PM Meeting: 5pm onwards or very early (before 5am)
        return 'PM Meeting';
    }

    // Reorganize all schedule entries by actual time (not by original category)
    // BUT keep PM Meeting in its original category since it's a meeting type, not time-based
    const reorganizedSchedule = {};

    currentSchedule.days.forEach(day => {
        reorganizedSchedule[day] = {
            'Morning': [],
            'Afternoon': [],
            'PM Meeting': []
        };

        if (currentSchedule.schedule[day]) {
            // Go through all shift types
            ['Morning', 'Afternoon', 'PM Meeting'].forEach(originalShift => {
                const entries = currentSchedule.schedule[day][originalShift] || [];
                entries.forEach(entry => {
                    // PM Meeting should always stay as PM Meeting, regardless of start time
                    // Only reorganize Morning and Afternoon shifts based on their actual times
                    let correctShift;
                    if (originalShift === 'PM Meeting') {
                        correctShift = 'PM Meeting';
                    } else {
                        correctShift = getShiftByTime(entry.startTime);
                    }
                    reorganizedSchedule[day][correctShift].push(entry);
                });
            });
        }
    });

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Schedule', 148, 15, { align: 'center' });

    // Date Range - Bigger and more prominent
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(dateRange, 148, 26, { align: 'center' });

    // Grid Setup
    const startY = 35;
    const startX = 20;
    const staffColWidth = 30;
    const dayWidth = 45;
    const headerHeight = 10;
    const cellHeight = 10;
    // Explicitly define days to ensure they're always there
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let currentY = startY;

    // Process each shift
    const shifts = ['Morning', 'Afternoon', 'PM Meeting'];

    shifts.forEach((shiftType, shiftIndex) => {
        // Shift Type Label (centered above the table)
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(51, 51, 51);
        doc.text(shiftType, 148, currentY + 5, { align: 'center' });
        currentY += 10;

        // Collect all unique staff for this shift across all days
        const staffSchedules = {};

        days.forEach(day => {
            const isHoliday = currentSchedule.holidays[day];
            const entries = reorganizedSchedule[day]?.[shiftType] || [];

            entries.forEach(entry => {
                entry.staff.forEach(staffName => {
                    if (!staffSchedules[staffName]) {
                        staffSchedules[staffName] = {};
                    }

                    if (isHoliday) {
                        staffSchedules[staffName][day] = 'OFF';
                    } else {
                        const timeRange = `${format12Hour(entry.startTime)}- ${format12Hour(entry.endTime)}`;
                        // If staff already has a time for this day, append with newline
                        if (staffSchedules[staffName][day] && staffSchedules[staffName][day] !== 'OFF') {
                            staffSchedules[staffName][day] += `\n${timeRange}`;
                        } else {
                            staffSchedules[staffName][day] = timeRange;
                        }
                    }
                });
            });

            // Mark holidays for staff without entries
            if (isHoliday) {
                Object.keys(staffSchedules).forEach(staffName => {
                    if (!staffSchedules[staffName][day]) {
                        staffSchedules[staffName][day] = 'OFF';
                    }
                });
            }
        });

        // If no staff for this shift, show empty row with headers
        if (Object.keys(staffSchedules).length === 0) {
            // Draw header row
            doc.setFillColor(255, 255, 255); // White background
            doc.setDrawColor(0, 0, 0); // Black borders
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');

            // Draw all header rectangles first
            doc.rect(startX, currentY, staffColWidth, headerHeight, 'FD'); // Staff header
            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.rect(x, currentY, dayWidth, headerHeight, 'FD');
            });

            // Now draw all text on top
            doc.setTextColor(0, 0, 0); // Black text
            doc.text('Staff', startX + staffColWidth / 2, currentY + 7, { align: 'center' });
            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.text(day, x + dayWidth / 2, currentY + 7, { align: 'center' });
            });

            currentY += headerHeight;

            // Empty row with "---" indicator
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);

            // Draw staff cell
            doc.rect(startX, currentY, staffColWidth, cellHeight, 'FD');

            // Draw day cells with "---" in each
            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.rect(x, currentY, dayWidth, cellHeight, 'FD');
                doc.text('---', x + dayWidth / 2, currentY + 7, { align: 'center' });
            });

            currentY += cellHeight + 15;
        } else {
            // Draw header row (Staff + Days)
            doc.setFillColor(255, 255, 255); // White background
            doc.setDrawColor(0, 0, 0); // Black borders
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');

            // Draw all header rectangles first
            doc.rect(startX, currentY, staffColWidth, headerHeight, 'FD'); // Staff header
            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.rect(x, currentY, dayWidth, headerHeight, 'FD');
            });

            // Now draw all text on top
            doc.setTextColor(0, 0, 0); // Black text
            doc.text('Staff', startX + staffColWidth / 2, currentY + 7, { align: 'center' });
            days.forEach((day, index) => {
                const x = startX + staffColWidth + (index * dayWidth);
                doc.text(day, x + dayWidth / 2, currentY + 7, { align: 'center' });
            });

            currentY += headerHeight;

            // Draw staff rows
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0); // Black text

            // Sort staff alphabetically
            const sortedStaff = Object.keys(staffSchedules).sort();

            sortedStaff.forEach(staffName => {
                const schedule = staffSchedules[staffName];

                // Calculate the maximum cell height needed for this row
                let maxCellHeight = cellHeight;
                days.forEach(day => {
                    const timeOrOff = schedule[day] || '';
                    if (timeOrOff && timeOrOff !== 'OFF') {
                        const timeLines = timeOrOff.split('\n');
                        const neededHeight = timeLines.length > 1 ? cellHeight * timeLines.length : cellHeight;
                        maxCellHeight = Math.max(maxCellHeight, neededHeight);
                    }
                });

                // Staff name cell
                doc.setFillColor(255, 255, 255); // White background
                doc.rect(startX, currentY, staffColWidth, maxCellHeight, 'FD');
                doc.setTextColor(0, 0, 0); // Black text
                doc.setFont(undefined, 'bold');
                doc.text(staffName, startX + staffColWidth / 2, currentY + maxCellHeight / 2 + 2, { align: 'center' });

                // Day cells
                doc.setFont(undefined, 'normal');
                days.forEach((day, index) => {
                    const x = startX + staffColWidth + (index * dayWidth);
                    const timeOrOff = schedule[day] || '';
                    const holidayName = currentSchedule.holidays[day];

                    if (timeOrOff === 'OFF' || holidayName) {
                        doc.setFillColor(255, 255, 255); // White background
                        doc.rect(x, currentY, dayWidth, maxCellHeight, 'FD');
                        doc.setTextColor(0, 0, 0); // Black text
                        doc.setFont(undefined, 'bold');
                        doc.setFontSize(9);

                        // Show "Off" text
                        if (holidayName && holidayName !== true) {
                            // If there's a holiday name, show it smaller below "Off"
                            doc.text('Off', x + dayWidth / 2, currentY + maxCellHeight / 2 - 1, { align: 'center' });
                            doc.setFont(undefined, 'normal');
                            doc.setFontSize(7);
                            doc.text(holidayName, x + dayWidth / 2, currentY + maxCellHeight / 2 + 3, { align: 'center' });
                            doc.setFontSize(9);
                        } else {
                            // Just "Off" centered
                            doc.text('Off', x + dayWidth / 2, currentY + maxCellHeight / 2 + 2, { align: 'center' });
                        }

                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0); // Black text
                    } else {
                        doc.setFillColor(255, 255, 255); // White background
                        doc.rect(x, currentY, dayWidth, maxCellHeight, 'FD');
                        if (timeOrOff) {
                            doc.setTextColor(0, 0, 0); // Black text
                            doc.setFontSize(8);
                            // Handle multiple time entries
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

            currentY += 15; // Space between shifts
        }

        // Check if we need a new page
        if (currentY > 170 && shiftIndex < shifts.length - 1) {
            doc.addPage();
            currentY = 20;
        }
    });

    // Footer
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

    // Return to welcome screen
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
    // Also auto-save to active template if one exists
    if (currentSchedule.activeTemplateId !== null) {
        saveCurrentTemplateToStorage();
    }
    // Save to cloud
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