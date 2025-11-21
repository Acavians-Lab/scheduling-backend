// API Configuration
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : ''; // Empty string for production (same origin)

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Check authentication
function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Load schedule from backend
async function loadScheduleFromBackend() {
    try {
        const response = await fetch(`${API_URL}/api/schedule`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token invalid, redirect to login
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                return null;
            }
            throw new Error('Failed to load schedule');
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error loading schedule:', error);
        return null;
    }
}


// Constants
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const shifts = ['Morning', 'Afternoon', 'PM Meeting'];

// State
let schedule = {};
let currentAddContext = {};
let staffDirectory = [];
let budgetHours = 0;
let weekDates = {};
let holidays = {};
let allSchedules = [];
let currentScheduleId = null;

// Initialize schedule structure
function initializeSchedule() {
    days.forEach(day => {
        schedule[day] = {
            'Morning': [],
            'Afternoon': [],
            'PM Meeting': []
        };
    });
}

// Toggle Holiday Input
function toggleHolidayInput() {
    const checkbox = document.getElementById('isHolidayCheckbox');
    const inputGroup = document.getElementById('holidayInputGroup');
    const nameInput = document.getElementById('newScheduleName');

    if (checkbox.checked) {
        inputGroup.style.display = 'block';
        nameInput.required = true;
    } else {
        inputGroup.style.display = 'none';
        nameInput.required = false;
        nameInput.value = '';
    }
}

// Deep clone function for copying schedule data
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function getUserStorageKey() {
    const username = localStorage.getItem("username") || "defaultUser";
    return `staffScheduleData_${username}`;
}


// Get day of week name from date
function getDayOfWeek(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
}

// Find Monday-Friday dates within a date range
function findWorkWeekDates(startDate, endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const workDates = {};

    // Create a map of all dates in the range
    const allDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d).toISOString().split('T')[0]);
    }

    // Find dates that fall on Monday-Friday
    allDates.forEach(dateStr => {
        const dayName = getDayOfWeek(dateStr);
        if (days.includes(dayName)) {
            workDates[dayName] = dateStr;
        }
    });

    return workDates;
}


// Save schedule to backend
async function saveScheduleToBackend(scheduleData) {
    try {
        const response = await fetch(`${API_URL}/api/schedule`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                return false;
            }
            throw new Error('Failed to save schedule');
        }

        return true;

    } catch (error) {
        console.error('Error saving schedule:', error);
        return false;
    }
}

// Initialize - load from backend on page load
document.addEventListener('DOMContentLoaded', async function() {
    if (!checkAuth()) return;

    const scheduleData = await loadScheduleFromBackend();
    if (scheduleData) {
        // Load the data into your existing variables
        allSchedules = scheduleData.allSchedules || [];
        currentScheduleId = scheduleData.currentScheduleId || null;
        staffDirectory = scheduleData.staffDirectory || [];
        budgetHours = scheduleData.budgetHours || 0;
        weekDates = scheduleData.weekDates || {};
        holidays = scheduleData.holidays || {};

        // Render the schedule
        renderScheduleList();
        if (currentScheduleId) {
            loadSchedule(currentScheduleId);
        }
    }
});

// Local Storage Functions
async function saveToLocalStorage() {
    const scheduleData = {
        allSchedules,
        currentScheduleId,
        staffDirectory,
        budgetHours,
        weekDates,
        holidays
    };

    // Save to localStorage (fallback)
    localStorage.setItem('allSchedules', JSON.stringify(allSchedules));
    localStorage.setItem('currentScheduleId', currentScheduleId);
    localStorage.setItem('staffDirectory', JSON.stringify(staffDirectory));
    localStorage.setItem('budgetHours', budgetHours);
    localStorage.setItem('weekDates', JSON.stringify(weekDates));
    localStorage.setItem('holidays', JSON.stringify(holidays));

    // Save to backend
    await saveScheduleToBackend(scheduleData);
}


function loadFromLocalStorage() {
    const saved = localStorage.getItem(getUserStorageKey());
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);

        staffDirectory = data.staffDirectory || [];
        allSchedules = data.allSchedules || [];
        currentScheduleId = data.currentScheduleId;

        if (currentScheduleId !== null && allSchedules.length > 0) {
            const currentSchedule = allSchedules.find(s => s.id === currentScheduleId);
            if (currentSchedule) {
                schedule = deepClone(currentSchedule.schedule) || {};
                weekDates = deepClone(currentSchedule.weekDates) || {};
                holidays = deepClone(currentSchedule.holidays) || {};
                budgetHours = currentSchedule.budgetHours || 0;
            }
        }

        return true;
    } catch (err) {
        return false;
    }
}


// Date Functions
function formatDisplayDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
}

function formatShortDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
}

function formatDateWithYear(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} / ${day} / ${year}`;
}

// Time Formatting Functions
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${displayHour}:${minutes}${ampm}`;
}

function calculateHours(startTime, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    return totalMinutes / 60;
}

function calculateDailyTotal(day) {
    let total = 0;
    shifts.forEach(shift => {
        schedule[day][shift].forEach(staff => {
            total += calculateHours(staff.startTime, staff.endTime);
        });
    });
    return total.toFixed(2);
}

function calculateWeeklyTotal() {
    let total = 0;
    days.forEach(day => {
        total += parseFloat(calculateDailyTotal(day));
    });
    return total.toFixed(2);
}

function getStaffWeeklyHours(staffName) {
    let weeklyData = [];
    let total = 0;

    days.forEach(day => {
        let dayHours = 0;
        let dayEntries = [];

        shifts.forEach(shift => {
            schedule[day][shift].forEach(staff => {
                if (staff.name === staffName) {
                    const hours = calculateHours(staff.startTime, staff.endTime);
                    dayHours += hours;
                    dayEntries.push({
                        shift: shift,
                        hours: hours,
                        time: `${formatTime(staff.startTime)} - ${formatTime(staff.endTime)}`
                    });
                }
            });
        });

        if (dayHours > 0) {
            weeklyData.push({
                day: day,
                hours: dayHours.toFixed(2),
                entries: dayEntries
            });
            total += dayHours;
        }
    });

    return { weeklyData, total: total.toFixed(2) };
}

// Holiday Functions
function selectActionType(type) {
    const staffBtn = document.querySelector('.action-type-btn:nth-child(1)');
    const holidayBtn = document.querySelector('.action-type-btn:nth-child(2)');
    const staffForm = document.getElementById('quickAddForm');
    const holidayForm = document.getElementById('holidayForm');

    if (type === 'staff') {
        staffBtn.classList.add('active');
        holidayBtn.classList.remove('active');
        staffForm.classList.add('active');
        holidayForm.classList.remove('active');
    } else {
        staffBtn.classList.remove('active');
        holidayBtn.classList.add('active');
        staffForm.classList.remove('active');
        holidayForm.classList.add('active');
    }
}

function addHoliday(event) {
    event.preventDefault();

    const day = currentAddContext.day;
    const name = document.getElementById('holidayName').value.trim();
    const description = document.getElementById('holidayDescription').value.trim();

    if (!name) {
        return;
    }

    // Set holiday
    holidays[day] = {
        name: name,
        description: description || ''
    };

    // Clear all staff for this day
    schedule[day]['Morning'] = [];
    schedule[day]['Afternoon'] = [];
    schedule[day]['PM Meeting'] = [];

    // Reset form
    document.getElementById('holidayForm').reset();

    // Save and close modal
    saveToLocalStorage();
    closeQuickAddModal();

    // Re-render the schedule
    renderSchedule();
}

function removeHoliday(day) {
    // Remove holiday
    delete holidays[day];

    // Save and re-render
    saveToLocalStorage();
    renderSchedule();
}

// Modal Functions
function openStaffModal() {
    document.getElementById('addStaffModal').classList.add('active');
}

function closeModal() {
    document.getElementById('staffModal').classList.remove('active');
}

function closeAddStaffModal() {
    document.getElementById('addStaffModal').classList.remove('active');
}

function closeStaffListModal() {
    document.getElementById('staffListModal').classList.remove('active');
}

function closeCreateStaffModal() {
    document.getElementById('createStaffModal').classList.remove('active');
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
    currentAddContext = {};
    selectActionType('staff');
    document.getElementById('quickAddForm').reset();
    document.getElementById('holidayForm').reset();
}

function closeWeeklySummaryModal() {
    document.getElementById('weeklySummaryModal').classList.remove('active');
}

function closeScheduleManagerModal() {
    document.getElementById('scheduleManagerModal').classList.remove('active');
}

function closeCreateScheduleModal() {
    document.getElementById('createScheduleModal').classList.remove('active');
}

function openQuickAddModal(day) {
    currentAddContext = { day };

    document.getElementById('quickAddDay').textContent = day;

    populateStaffSelectInQuickAdd();

    document.getElementById('quickAddModal').classList.add('active');
    selectActionType('staff');
}

function populateStaffSelectInQuickAdd() {
    const select = document.getElementById('quickStaffSelect');
    select.innerHTML = '<option value="">Select a staff member</option>';

    staffDirectory.forEach(staff => {
        const option = document.createElement('option');
        option.value = JSON.stringify({ name: staff.name, role: staff.role });
        option.textContent = `${staff.name} (${staff.role})`;
        select.appendChild(option);
    });
}

function quickAddStaff(event) {
    event.preventDefault();

    const day = currentAddContext.day;
    const shift = document.getElementById('quickShift').value;
    const staffData = JSON.parse(document.getElementById('quickStaffSelect').value);
    const startTime = document.getElementById('quickStartTime').value;
    const endTime = document.getElementById('quickEndTime').value;

    if (!shift || !staffData || !startTime || !endTime) {
        return;
    }

    const newEntry = {
        name: staffData.name,
        role: staffData.role,
        startTime: startTime,
        endTime: endTime
    };

    schedule[day][shift].push(newEntry);

    saveToLocalStorage();
    renderSchedule();
    closeQuickAddModal();
}

// Staff Functions
function showStaffDetails(staffName) {
    const { weeklyData, total } = getStaffWeeklyHours(staffName);

    const staffMember = staffDirectory.find(s => s.name === staffName);
    const modalTitle = document.getElementById('modalStaffName');
    const modalContent = document.getElementById('modalContent');

    modalTitle.textContent = `${staffName}${staffMember ? ' (' + staffMember.role + ')' : ''}`;

    let html = '<div class="staff-detail-section">';
    html += `<div class="staff-detail-header">Weekly Schedule</div>`;

    if (weeklyData.length === 0) {
        html += '<p>No hours scheduled this week</p>';
    } else {
        weeklyData.forEach(dayData => {
            html += `<div class="day-detail">`;
            html += `<div class="day-detail-name">${dayData.day}</div>`;
            dayData.entries.forEach(entry => {
                html += `<div class="shift-detail">`;
                html += `<span class="shift-detail-name">${entry.shift}</span>`;
                html += `<span class="shift-detail-time">${entry.time}</span>`;
                html += `<span class="shift-detail-hours">${entry.hours.toFixed(2)}h</span>`;
                html += `</div>`;
            });
            html += `</div>`;
        });

        html += `<div class="total-hours">Total Weekly Hours: <strong>${total}h</strong></div>`;
    }

    html += '</div>';

    modalContent.innerHTML = html;
    document.getElementById('staffModal').classList.add('active');
}

function openStaffListModal() {
    renderStaffList();
    document.getElementById('staffListModal').classList.add('active');
}

function renderStaffList() {
    const container = document.getElementById('staffListContent');

    if (staffDirectory.length === 0) {
        container.innerHTML = '<p>No staff members yet. Create one to get started!</p>';
        return;
    }

    let html = '<div class="staff-list">';

    staffDirectory.forEach(staff => {
        const { weeklyData, total } = getStaffWeeklyHours(staff.name);
        html += `
            <div class="staff-list-item">
                <div class="staff-list-info">
                    <div class="staff-list-name">${staff.name}</div>
                    <div class="staff-list-role">${staff.role}</div>
                </div>
                <div class="staff-list-hours">
                    <div class="hours-badge">${total}h</div>
                </div>
                <div class="staff-list-actions">
                    <button class="btn-small" onclick="showStaffDetails('${staff.name}')">View</button>
                    <button class="btn-small btn-danger" onclick="deleteStaff('${staff.name}')">Delete</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function deleteStaff(staffName) {
    if (!confirm(`Delete ${staffName}? This will remove all their scheduled shifts.`)) {
        return;
    }

    staffDirectory = staffDirectory.filter(s => s.name !== staffName);

    days.forEach(day => {
        shifts.forEach(shift => {
            schedule[day][shift] = schedule[day][shift].filter(s => s.name !== staffName);
        });
    });

    saveToLocalStorage();
    renderStaffList();
    renderSchedule();
}

function openCreateStaffModal() {
    document.getElementById('createStaffModal').classList.add('active');
}

function createStaff(event) {
    event.preventDefault();

    const name = document.getElementById('newStaffName').value.trim();
    const role = document.getElementById('newStaffRole').value.trim();

    if (!name || !role) {
        return;
    }

    const exists = staffDirectory.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        return;
    }

    staffDirectory.push({ name, role });

    saveToLocalStorage();
    renderStaffList();
    closeCreateStaffModal();

    document.getElementById('createStaffForm').reset();
}

function openWeeklySummaryModal() {
    renderWeeklySummary();
    document.getElementById('weeklySummaryModal').classList.add('active');
}

function renderWeeklySummary() {
    const container = document.getElementById('weeklySummaryContent');
    const weeklyTotal = parseFloat(calculateWeeklyTotal());

    let html = '<div class="summary-section">';
    html += '<h3>Weekly Overview</h3>';
    html += `<div class="summary-total">Total Hours: <strong>${weeklyTotal.toFixed(1)}h</strong></div>`;
    html += '</div>';

    html += '<div class="summary-section">';
    html += '<h3>Daily Breakdown</h3>';

    // Only show days that are in the current schedule
    days.forEach(day => {
        // Skip days not in current template
        if (!weekDates[day]) return;

        const dailyTotal = parseFloat(calculateDailyTotal(day));
        const isHoliday = holidays[day];
        const dateStr = formatShortDate(weekDates[day]);

        html += `
            <div class="summary-day">
                <div class="summary-day-info">
                    <span class="summary-day-name">${day}${isHoliday ? ' 🎉' : ''}</span>
                    <span class="summary-day-date">${dateStr}</span>
                </div>
                <span class="summary-day-hours">${dailyTotal.toFixed(1)}h</span>
            </div>
        `;
    });
    html += '</div>';

    if (staffDirectory.length > 0) {
        html += '<div class="summary-section">';
        html += '<h3>Staff Hours</h3>';

        // Sort staff by hours (highest first)
        const staffWithHours = staffDirectory.map(staff => {
            const { total } = getStaffWeeklyHours(staff.name);
            return { name: staff.name, role: staff.role, hours: parseFloat(total) };
        }).filter(s => s.hours > 0).sort((a, b) => b.hours - a.hours);

        if (staffWithHours.length === 0) {
            html += '<p style="color: #999; text-align: center; padding: 20px;">No staff scheduled this week</p>';
        } else {
            staffWithHours.forEach(staff => {
                html += `
                    <div class="summary-staff">
                        <span class="summary-staff-name">${staff.name}</span>
                        <span class="summary-staff-hours">${staff.hours.toFixed(1)}h</span>
                    </div>
                `;
            });
        }

        html += '</div>';
    }

    container.innerHTML = html;
}

// Schedule Template Functions
function openScheduleManagerModal() {
    renderScheduleList();
    document.getElementById('scheduleManagerModal').classList.add('active');
}

function openCreateScheduleModal() {
    document.getElementById('createScheduleModal').classList.add('active');
}

function getMonthYear(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 'Unknown';

    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');

    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();

    if (startMonth === endMonth) {
        return `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
}

function renderScheduleList() {
    const container = document.getElementById('scheduleListContent');

    if (allSchedules.length === 0) {
        container.innerHTML = '<p class="empty-schedule-list">No schedule templates yet. Create one to get started!</p>';
        return;
    }

    let html = '<div class="schedule-list">';

    allSchedules.forEach(sched => {
        const isActive = sched.id === currentScheduleId;

        // Get first and last dates
        const firstDay = Object.keys(sched.weekDates).sort((a, b) =>
            days.indexOf(a) - days.indexOf(b)
        )[0];
        const lastDay = Object.keys(sched.weekDates).sort((a, b) =>
            days.indexOf(a) - days.indexOf(b)
        )[Object.keys(sched.weekDates).length - 1];

        const startDateStr = sched.startDate || sched.weekDates[firstDay];
        const endDateStr = sched.endDate || sched.weekDates[lastDay];

        const monthYear = getMonthYear(startDateStr, endDateStr);

        // Get list of days in this schedule
        const daysInSchedule = Object.keys(sched.weekDates).sort((a, b) => {
            return days.indexOf(a) - days.indexOf(b);
        });
        const daysDisplay = daysInSchedule.length === 5 ? 'Full Week (Mon-Fri)' : daysInSchedule.join(', ');

        // Count total scheduled hours
        let totalHours = 0;
        days.forEach(day => {
            if (sched.schedule && sched.schedule[day]) {
                shifts.forEach(shift => {
                    if (sched.schedule[day][shift]) {
                        sched.schedule[day][shift].forEach(staff => {
                            totalHours += calculateHours(staff.startTime, staff.endTime);
                        });
                    }
                });
            }
        });

        const budgetHrs = sched.budgetHours || 0;

        html += `
            <div class="schedule-list-item ${isActive ? 'active' : ''}">
                <div class="schedule-list-info">
                    <div class="schedule-list-title">
                        ${sched.isHolidayPeriod ? '🎉 ' : ''}${sched.name || monthYear}
                        ${isActive ? '<span class="active-badge">Currently Active</span>' : ''}
                    </div>
                    <div class="schedule-list-dates">📅 ${formatDisplayDate(startDateStr)} - ${formatDisplayDate(endDateStr)}</div>
                    <div class="schedule-list-days">📌 ${daysDisplay}</div>
                </div>
                <div class="schedule-list-stats">
                    <div class="stat-item" title="Total scheduled hours">
                        <div style="font-size: 0.8em; color: #999; margin-bottom: 2px;">Hours</div>
                        <div style="color: ${totalHours > budgetHrs && budgetHrs > 0 ? '#ff6b6b' : '#5e72e4'}; font-weight: 600;">${totalHours.toFixed(1)}h</div>
                    </div>
                    ${budgetHrs > 0 ? `
                    <div class="stat-item" title="Budget hours for this week">
                        <div style="font-size: 0.8em; color: #999; margin-bottom: 2px;">Budget</div>
                        <div style="color: #9d8bc7; font-weight: 600;">${budgetHrs.toFixed(1)}h</div>
                    </div>
                    ` : ''}
                </div>
                <div class="schedule-list-actions">
                    ${!isActive ? `<button class="btn-small" onclick="loadSchedule(${sched.id})">Load</button>` : ''}
                    <button class="btn-small btn-danger" onclick="deleteSchedule(${sched.id})">Delete</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function createNewSchedule(event) {
    event.preventDefault();

    const startDate = document.getElementById('newScheduleStartDate').value;
    const endDate = document.getElementById('newScheduleEndDate').value;
    const isHoliday = document.getElementById('isHolidayCheckbox').checked;
    const name = document.getElementById('newScheduleName').value.trim();
    const budgetInput = document.getElementById('newScheduleBudget').value;
    const budget = budgetInput ? parseFloat(budgetInput) : 0;

    if (!startDate || !endDate) {
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        return;
    }

    if (isHoliday && !name) {
        return;
    }

    // Find the Monday-Friday dates within this range
    const workWeekDates = findWorkWeekDates(startDate, endDate);

    // Allow partial weeks - just need at least one weekday
    if (Object.keys(workWeekDates).length === 0) {
        return;
    }

    // Check if already exists (same start and end dates)
    const exists = allSchedules.some(s => {
        return s.startDate === startDate && s.endDate === endDate;
    });

    if (exists) {
        return;
    }

    const newScheduleId = Date.now();

    const newScheduleData = {
        id: newScheduleId,
        name: isHoliday ? name : '',
        startDate: startDate,
        endDate: endDate,
        weekDates: workWeekDates, // Only contains days that exist in the range
        schedule: {},
        holidays: {},
        budgetHours: budget,
        created: Date.now(),
        lastModified: Date.now(),
        isHolidayPeriod: isHoliday
    };

    // Initialize schedule structure for ALL days (Mon-Fri) for data consistency
    // But only days in weekDates will be rendered
    days.forEach(day => {
        newScheduleData.schedule[day] = {
            'Morning': [],
            'Afternoon': [],
            'PM Meeting': []
        };

        // If this is a holiday period and this day exists in the range, mark it as holiday
        if (isHoliday && name && workWeekDates[day]) {
            newScheduleData.holidays[day] = {
                name: name,
                description: `Holiday period: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`
            };
        }
    });

    allSchedules.push(newScheduleData);

    // Sort schedules by start date (most recent first)
    allSchedules.sort((a, b) => {
        const dateA = new Date(a.startDate || a.weekDates[days[0]]);
        const dateB = new Date(b.startDate || b.weekDates[days[0]]);
        return dateB - dateA;
    });

    saveToLocalStorage();

    closeCreateScheduleModal();
    document.getElementById('createScheduleForm').reset();
    document.getElementById('holidayInputGroup').style.display = 'none';

    // Immediately load the new schedule
    loadSchedule(newScheduleId);

    // Show success message with details
    const daysIncluded = Object.keys(workWeekDates).join(', ');
}

function loadSchedule(scheduleId) {

    const scheduleToLoad = allSchedules.find(s => s.id === scheduleId);

    if (!scheduleToLoad) {
        return;
    }


    currentScheduleId = scheduleId;
    schedule = deepClone(scheduleToLoad.schedule) || {};
    weekDates = deepClone(scheduleToLoad.weekDates) || {};
    holidays = deepClone(scheduleToLoad.holidays) || {};
    budgetHours = scheduleToLoad.budgetHours || 0;


    saveToLocalStorage();
    renderSchedule();
    closeScheduleManagerModal();
}

function deleteSchedule(scheduleId) {
    const scheduleToDelete = allSchedules.find(s => s.id === scheduleId);

    if (!scheduleToDelete) return;

    const monthYear = getMonthYear(
        scheduleToDelete.startDate || scheduleToDelete.weekDates[days[0]],
        scheduleToDelete.endDate || scheduleToDelete.weekDates[days[days.length - 1]]
    );

    if (!confirm(`Delete schedule template for ${monthYear}?`)) {
        return;
    }

    allSchedules = allSchedules.filter(s => s.id !== scheduleId);

    if (currentScheduleId === scheduleId) {
        if (allSchedules.length > 0) {
            loadSchedule(allSchedules[0].id);
        } else {
            currentScheduleId = null;
            initializeSchedule();
            weekDates = {};
            holidays = {};
            budgetHours = 0;
            renderSchedule();
        }
    }

    saveToLocalStorage();
    renderScheduleList();
}

// Main Render Function
function renderSchedule() {

    const grid = document.getElementById('daysGrid');
    const weekDisplay = document.getElementById('weekDateDisplay');

    if (!grid) {
        return;
    }

    if (!weekDisplay) {
        return;
    }


    // Update week date display - get the first and last date from weekDates
    const datesAvailable = Object.values(weekDates).filter(d => d);
    if (datesAvailable.length > 0) {
        const sortedDates = datesAvailable.sort();
        const startDate = formatDisplayDate(sortedDates[0]);
        const endDate = formatDisplayDate(sortedDates[sortedDates.length - 1]);
        weekDisplay.textContent = `${startDate} - ${endDate}`;
    } else {
        weekDisplay.textContent = 'No schedule template selected';
    }

    let html = '';

    // Only render days that have dates in the current schedule
    days.forEach(day => {
        // Skip days that don't exist in this schedule
        if (!weekDates[day]) {
            return;
        }

        const isHoliday = holidays[day];
        const holidayClass = isHoliday ? 'holiday' : '';
        const dateDisplay = formatDateWithYear(weekDates[day]);


        html += `
            <div class="day-column ${holidayClass}">
                <div class="day-header">
                    <div>
                        <div class="day-name">${day}</div>
                        <div class="day-date">${dateDisplay}</div>
                    </div>
                    <button class="add-day-btn" onclick="openQuickAddModal('${day}')">+</button>
                </div>
        `;

        if (isHoliday) {
            html += `
                <div class="holiday-display" onclick="event.stopPropagation(); if(confirm('Remove ${holidays[day].name}?')) { removeHoliday('${day}'); }">
                    <div class="holiday-icon">🎉</div>
                    <div class="holiday-name">${holidays[day].name}</div>
                    ${holidays[day].description ? `<div class="holiday-description">${holidays[day].description}</div>` : ''}
                    <div class="holiday-label">Day Off</div>
                </div>
            `;
        } else {
            shifts.forEach(shift => {
                html += `
                    <div class="shift-section">
                        <div class="shift-title">${shift}</div>
                `;

                if (schedule[day][shift].length === 0) {
                    html += `<div class="empty-shift">No staff</div>`;
                } else {
                    schedule[day][shift].forEach(staff => {
                        html += `
                            <div class="staff-entry" onclick="showStaffDetails('${staff.name}')">
                                <div class="staff-name">
                                    ${staff.name} (${staff.role})
                                </div>
                                <div class="staff-time">🕐 ${formatTime(staff.startTime)} - ${formatTime(staff.endTime)}</div>
                            </div>
                        `;
                    });
                }

                html += `</div>`;
            });
        }

        html += `</div>`;
    });

    grid.innerHTML = html;

    const weeklyTotal = parseFloat(calculateWeeklyTotal());
    const budget = budgetHours || 0;
    const remaining = budget - weeklyTotal;

    document.getElementById('totalWeeklyHours').textContent = weeklyTotal.toFixed(1);

    // Update budget display - shows REMAINING hours (decreases as staff added)
    const budgetDisplay = document.getElementById('budgetRemainingDisplay');

    if (budget > 0) {
        budgetDisplay.textContent = remaining.toFixed(1);

        // Color code based on remaining
        if (remaining < 0) {
            // Over budget - RED
            budgetDisplay.style.color = '#ff4444';
        } else if (remaining <= budget * 0.1) {
            // Less than 10% left - ORANGE warning
            budgetDisplay.style.color = '#ff9800';
        } else {
            // Plenty left - GREEN
            budgetDisplay.style.color = '#4caf50';
        }
    } else {
        // No budget set
        budgetDisplay.textContent = '0';
        budgetDisplay.style.color = '#ffffff';
    }
}

// Modal Event Listeners
document.getElementById('staffModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('staffListModal').addEventListener('click', function(e) {
    if (e.target === this) closeStaffListModal();
});

document.getElementById('createStaffModal').addEventListener('click', function(e) {
    if (e.target === this) closeCreateStaffModal();
});

document.getElementById('quickAddModal').addEventListener('click', function(e) {
    if (e.target === this) closeQuickAddModal();
});

document.getElementById('weeklySummaryModal').addEventListener('click', function(e) {
    if (e.target === this) closeWeeklySummaryModal();
});

document.getElementById('scheduleManagerModal').addEventListener('click', function(e) {
    if (e.target === this) closeScheduleManagerModal();
});

document.getElementById('createScheduleModal').addEventListener('click', function(e) {
    if (e.target === this) closeCreateScheduleModal();
});

document.getElementById('editBudgetModal').addEventListener('click', function(e) {
    if (e.target === this) closeBudgetModal();
});

// Budget Modal Functions
function openBudgetModal() {
    if (currentScheduleId === null) {
        return;
    }

    const currentSchedule = allSchedules.find(s => s.id === currentScheduleId);
    if (currentSchedule) {
        document.getElementById('editBudgetHours').value = currentSchedule.budgetHours || 0;
        document.getElementById('editBudgetModal').classList.add('active');
    }
}

function closeBudgetModal() {
    document.getElementById('editBudgetModal').classList.remove('active');
}

function saveBudget(event) {
    event.preventDefault();

    const newBudget = parseFloat(document.getElementById('editBudgetHours').value) || 0;

    budgetHours = newBudget;

    // Update the display - will be handled by renderSchedule
    saveToLocalStorage();
    renderSchedule(); // Update all displays
    closeBudgetModal();

    // Refresh schedule list to show updated budget
    if (document.getElementById('scheduleManagerModal').classList.contains('active')) {
        renderScheduleList();
    }
}

// Initialize Application
function initializeApp() {
    initializeSchedule();

    const loaded = loadFromLocalStorage();

    if (!loaded || allSchedules.length === 0) {
        staffDirectory = [];
        allSchedules = [];
        currentScheduleId = null;

        // Create first schedule for current week
        const today = new Date();

        // Find the Monday of the current week
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(today.getDate() + diff);

        // Friday of current week
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        // Create dates for Mon-Fri
        const firstWeekDates = {};
        days.forEach((day, index) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + index);
            firstWeekDates[day] = date.toISOString().split('T')[0];
        });

        const firstScheduleId = Date.now();
        const firstSchedule = {
            id: firstScheduleId,
            name: '',
            startDate: monday.toISOString().split('T')[0],
            endDate: friday.toISOString().split('T')[0],
            weekDates: firstWeekDates,
            schedule: {},
            holidays: {},
            budgetHours: 0,
            created: Date.now(),
            lastModified: Date.now()
        };

        days.forEach(day => {
            firstSchedule.schedule[day] = {
                'Morning': [],
                'Afternoon': [],
                'PM Meeting': []
            };
        });

        allSchedules.push(firstSchedule);
        currentScheduleId = firstScheduleId;
        schedule = deepClone(firstSchedule.schedule);
        weekDates = deepClone(firstSchedule.weekDates);
        holidays = {};
        budgetHours = 0;

        saveToLocalStorage();
    }

    renderSchedule();
}

document.addEventListener('DOMContentLoaded', initializeApp);

function logout() {
    if (confirm('Logout?')) {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('username');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('rememberMe');
        window.location.href = 'login.html';
    }
}