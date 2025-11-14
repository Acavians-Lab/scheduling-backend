// Constants
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const shifts = ['Morning', 'Afternoon', 'PM Meeting'];

// State
let schedule = {};
let currentAddContext = {};
let staffDirectory = [];
let budgetHours = 0;

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

// Local Storage Functions
function saveToLocalStorage() {
    const data = {
        schedule: schedule,
        staffDirectory: staffDirectory,
        budgetHours: budgetHours
    };
    localStorage.setItem('staffScheduleData', JSON.stringify(data));
    console.log('Data saved to local storage');
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('staffScheduleData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            schedule = data.schedule || {};
            staffDirectory = data.staffDirectory || [];
            budgetHours = data.budgetHours || 0;
            console.log('Data loaded from local storage');
            return true;
        } catch (e) {
            console.error('Error loading data:', e);
            return false;
        }
    }
    return false;
}

function clearLocalStorage() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.removeItem('staffScheduleData');
        initializeSchedule();
        staffDirectory = [];
        budgetHours = 0;
        renderSchedule();
        alert('All data has been cleared');
    }
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
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
    
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

// Staff Details Modal
function showStaffDetails(staffName) {
    const modal = document.getElementById('staffModal');
    const modalTitle = document.getElementById('modalStaffName');
    const modalContent = document.getElementById('modalContent');

    const { weeklyData, total } = getStaffWeeklyHours(staffName);

    modalTitle.textContent = `${staffName}'s Schedule`;

    let html = '';
    weeklyData.forEach(day => {
        html += `<div class="staff-detail-row">
            <div>
                <div class="staff-detail-day">${day.day}</div>
                ${day.entries.map(entry => `<div style="font-size: 0.85em; color: #999;">${entry.shift}: ${entry.time}</div>`).join('')}
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="staff-detail-hours">${day.hours}h</div>
                <button onclick="deleteStaffDay('${staffName}', '${day.day}')" style="background: none; border: none; cursor: pointer; font-size: 1.2em;" title="Delete this day">🗑️</button>
            </div>
        </div>`;
    });

    html += `<div class="modal-total">Weekly Total: ${total} hours</div>`;
    
    html += `
        <div class="delete-actions">
            <button class="delete-week-btn" onclick="deleteStaffWeek('${staffName}')">
                <span class="delete-icon">🗑️</span>
                Delete Entire Week
            </button>
        </div>
    `;

    modalContent.innerHTML = html;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('staffModal').classList.remove('active');
}

function deleteStaffDay(staffName, day) {
    if (confirm(`Are you sure you want to delete ${staffName}'s schedule for ${day}?`)) {
        // Remove staff from all shifts on that specific day
        shifts.forEach(shift => {
            schedule[day][shift] = schedule[day][shift].filter(staff => staff.name !== staffName);
        });
        
        saveToLocalStorage();
        renderSchedule();
        
        // Check if staff still has hours in other days
        const { weeklyData } = getStaffWeeklyHours(staffName);
        if (weeklyData.length > 0) {
            showStaffDetails(staffName); // Refresh the modal
        } else {
            closeModal(); // Close if no more entries
        }
    }
}

function deleteStaffWeek(staffName) {
    if (confirm(`Are you sure you want to remove ${staffName} from the ENTIRE WEEK schedule? This will delete all their shifts.`)) {
        // Remove staff from all days and all shifts
        days.forEach(day => {
            shifts.forEach(shift => {
                schedule[day][shift] = schedule[day][shift].filter(staff => staff.name !== staffName);
            });
        });
        
        saveToLocalStorage();
        renderSchedule();
        closeModal();
    }
}

// Add Staff Modal Functions
function openAddStaffModal(day, shift) {
    currentAddContext = { day, shift };
    document.getElementById('staffDay').value = day;
    document.getElementById('staffShift').value = shift;
    populateStaffSelect();
    document.getElementById('addStaffModal').classList.add('active');
}

function closeAddStaffModal() {
    document.getElementById('addStaffModal').classList.remove('active');
    document.getElementById('addStaffForm').reset();
}

function populateStaffSelect() {
    const select = document.getElementById('staffSelect');
    select.innerHTML = '<option value="">Select a staff member</option>';
    
    staffDirectory.forEach((staff, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${staff.name} (${staff.role})`;
        select.appendChild(option);
    });
}

function populateStaffInfo() {
    const select = document.getElementById('staffSelect');
    const selectedIndex = select.value;
    
    if (selectedIndex !== '') {
        const staff = staffDirectory[selectedIndex];
        // Times will be filled by user
    }
}

function addStaff(event) {
    event.preventDefault();
    
    const selectIndex = document.getElementById('staffSelect').value;
    const staff = staffDirectory[selectIndex];
    const startTime = document.getElementById('staffStartTime').value;
    const endTime = document.getElementById('staffEndTime').value;

    schedule[currentAddContext.day][currentAddContext.shift].push({
        name: staff.name,
        role: staff.role,
        startTime: startTime,
        endTime: endTime
    });

    saveToLocalStorage();
    closeAddStaffModal();
    renderSchedule();
}

// Staff Directory Functions
function openStaffListModal() {
    renderStaffList();
    document.getElementById('staffListModal').classList.add('active');
}

function closeStaffListModal() {
    document.getElementById('staffListModal').classList.remove('active');
}

function renderStaffList() {
    const content = document.getElementById('staffListContent');
    
    if (staffDirectory.length === 0) {
        content.innerHTML = '<div class="empty-staff-list">No staff members yet. Create your first one!</div>';
        return;
    }

    let html = '';
    staffDirectory.forEach((staff, index) => {
        html += `
            <div class="staff-list-item">
                <div>
                    <div class="staff-list-name">${staff.name}</div>
                    <div class="staff-list-role">${staff.role}</div>
                </div>
                <button class="staff-list-delete" onclick="deleteStaffFromDirectory(${index})">
                    🗑️ Delete
                </button>
            </div>
        `;
    });

    content.innerHTML = html;
}

function deleteStaffFromDirectory(index) {
    const staff = staffDirectory[index];
    if (confirm(`Are you sure you want to delete ${staff.name} from the staff directory? This will also remove them from all schedules.`)) {
        // Remove from directory
        const staffName = staff.name;
        staffDirectory.splice(index, 1);
        
        // Remove from all schedules
        days.forEach(day => {
            shifts.forEach(shift => {
                schedule[day][shift] = schedule[day][shift].filter(s => s.name !== staffName);
            });
        });
        
        saveToLocalStorage();
        renderStaffList();
        renderSchedule();
    }
}

function openCreateStaffModal() {
    document.getElementById('createStaffModal').classList.add('active');
}

function closeCreateStaffModal() {
    document.getElementById('createStaffModal').classList.remove('active');
    document.getElementById('createStaffForm').reset();
}

function createStaff(event) {
    event.preventDefault();
    
    const name = document.getElementById('newStaffName').value.trim();
    const role = document.getElementById('newStaffRole').value.trim();

    // Check if staff already exists
    const exists = staffDirectory.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('A staff member with this name already exists!');
        return;
    }

    staffDirectory.push({ name, role });
    
    saveToLocalStorage();
    closeCreateStaffModal();
    renderStaffList();
    alert(`${name} has been added to the staff directory!`);
}

// Quick Add Modal Functions
function openQuickAddModal(day) {
    document.getElementById('quickAddDay').textContent = day;
    currentAddContext = { day };
    
    // Populate staff dropdown
    const select = document.getElementById('quickStaffSelect');
    select.innerHTML = '<option value="">Select a staff member</option>';
    staffDirectory.forEach((staff, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${staff.name} (${staff.role})`;
        select.appendChild(option);
    });
    
    document.getElementById('quickAddModal').classList.add('active');
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
    document.getElementById('quickAddForm').reset();
}

function quickAddStaff(event) {
    event.preventDefault();
    
    const shift = document.getElementById('quickShift').value;
    const staffIndex = document.getElementById('quickStaffSelect').value;
    const staff = staffDirectory[staffIndex];
    const startTime = document.getElementById('quickStartTime').value;
    const endTime = document.getElementById('quickEndTime').value;

    schedule[currentAddContext.day][shift].push({
        name: staff.name,
        role: staff.role,
        startTime: startTime,
        endTime: endTime
    });

    saveToLocalStorage();
    closeQuickAddModal();
    renderSchedule();
}

// Weekly Summary Modal Functions
function openWeeklySummaryModal() {
    renderWeeklySummary();
    document.getElementById('weeklySummaryModal').classList.add('active');
}

function closeWeeklySummaryModal() {
    document.getElementById('weeklySummaryModal').classList.remove('active');
}

function renderWeeklySummary() {
    const content = document.getElementById('weeklySummaryContent');
    const weeklyTotal = parseFloat(calculateWeeklyTotal());
    const remaining = budgetHours - weeklyTotal;
    
    let html = '<div class="budget-section">';
    
    // Daily breakdown
    html += '<h3 style="color: #5e72e4; margin-bottom: 15px;">Daily Hours Breakdown</h3>';
    days.forEach(day => {
        const dailyTotal = calculateDailyTotal(day);
        html += `
            <div class="budget-row">
                <span class="budget-label">${day}</span>
                <span class="budget-value">${dailyTotal}h</span>
            </div>
        `;
    });
    
    // Weekly total
    html += `
        <div class="budget-row">
            <span class="budget-label">Total Weekly Hours</span>
            <span class="budget-value">${weeklyTotal}h</span>
        </div>
    `;
    
    html += '</div>';
    
    // Budget section
    html += '<div class="budget-section">';
    html += '<h3 style="color: #5e72e4; margin-bottom: 15px;">Budget Management</h3>';
    
    if (budgetHours > 0) {
        const statusClass = remaining >= 0 ? 'budget-under' : 'budget-over';
        const statusText = remaining >= 0 ? 'Remaining' : 'Over Budget';
        
        html += `
            <div class="budget-row">
                <span class="budget-label">Budget Hours</span>
                <span class="budget-value">${budgetHours}h</span>
            </div>
            <div class="budget-row">
                <span class="budget-label">${statusText}</span>
                <span class="budget-value ${statusClass}">${Math.abs(remaining).toFixed(2)}h</span>
            </div>
        `;
    }
    
    html += `
        <div class="budget-input-section">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #333;">
                Set Budget Hours
            </label>
            <div class="inline-input">
                <input type="number" id="budgetInput" placeholder="Enter hours" step="0.5" min="0" value="${budgetHours || ''}" />
                <button onclick="updateBudget()">Update</button>
            </div>
        </div>
    `;
    
    html += '</div>';
    
    content.innerHTML = html;
}

function updateBudget() {
    const input = document.getElementById('budgetInput');
    const value = parseFloat(input.value) || 0;
    budgetHours = value;
    saveToLocalStorage();
    renderWeeklySummary();
    renderSchedule(); // Update the main display
}

// Main Render Function
function renderSchedule() {
    const grid = document.getElementById('daysGrid');
    
    let html = '';
    days.forEach(day => {
        html += `
            <div class="day-column">
                <div class="day-header">
                    <div class="day-name">${day}</div>
                    <button class="add-day-btn" onclick="openQuickAddModal('${day}')">+</button>
                </div>
        `;

        shifts.forEach(shift => {
            html += `
                <div class="shift-section">
                    <div class="shift-title">${shift}</div>
            `;

            if (schedule[day][shift].length === 0) {
                html += `<div class="empty-shift">No staff scheduled</div>`;
            } else {
                schedule[day][shift].forEach(staff => {
                    html += `
                        <div class="staff-entry">
                            <div class="staff-name" onclick="showStaffDetails('${staff.name}')">
                                <span>${staff.name}</span>
                            </div>
                            <div class="staff-role">${staff.role}</div>
                            <div class="staff-time">🕐 ${formatTime(staff.startTime)} - ${formatTime(staff.endTime)}</div>
                        </div>
                    `;
                });
            }

            html += `
                </div>
            `;
        });

        html += `</div>`;
    });

    grid.innerHTML = html;
    document.getElementById('totalWeeklyHours').textContent = calculateWeeklyTotal();
}

// Modal Event Listeners
document.getElementById('staffModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('addStaffModal').addEventListener('click', function(e) {
    if (e.target === this) closeAddStaffModal();
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

// Initialize Application
function initializeApp() {
    initializeSchedule();
    
    // Try to load saved data
    const loaded = loadFromLocalStorage();
    
    // If no saved data, start with empty directory
    if (!loaded) {
        staffDirectory = [];
        budgetHours = 0;
        
        saveToLocalStorage();
    }
    
    renderSchedule();
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Logout Function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('username');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('rememberMe');
        window.location.href = 'login.html';
    }
}
