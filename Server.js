require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- DB CONNECTION ----------
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection error', err);
        process.exit(1);
    });

// ---------- MODELS ----------
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },

    // Current active schedule
    currentScheduleId: { type: Number, default: null },
    currentSchedule: { type: Object, default: {} },
    staffDirectory: { type: Array, default: [] },
    budgetHours: { type: Number, default: 0 },
    holidays: { type: Object, default: {} },

    // Saved templates
    templates: [{
        name: String,
        staff: [String],
        schedule: Object,
        holidays: Object,
        budgetHours: Number,
        createdAt: { type: Date, default: Date.now }
    }],

    lastModified: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ---------- MIDDLEWARE ----------
app.use(bodyParser.json());

// Serve static files from "Public"
app.use(express.static(path.join(__dirname, 'Public')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// ---------- AUTH HELPERS ----------
function generateToken(user) {
    return jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ msg: 'No auth header' });

    const [, token] = authHeader.split(' ');
    if (!token) return res.status(401).json({ msg: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ msg: 'Invalid token' });
    }
}

// ---------- ADMIN ROUTES ----------
// Create user
app.post('/api/admin/create-user', async (req, res) => {
    const { adminKey, username, password } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ msg: 'Forbidden' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = new User({ username, passwordHash });
        await user.save();
        res.json({ msg: 'User created', username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error creating user', error: err.message });
    }
});

// Delete all user data (nuclear option - resets everything)
app.post('/api/admin/delete-all-data', async (req, res) => {
    const { adminKey } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ msg: 'Forbidden' });
    }

    try {
        // Delete all users
        const result = await User.deleteMany({});

        res.json({
            msg: 'All data deleted successfully',
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error deleting data', error: err.message });
    }
});

// Reset specific user's schedule data (keeps user account)
app.post('/api/admin/reset-user', async (req, res) => {
    const { adminKey, username } = req.body;

    if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ msg: 'Forbidden' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Reset all schedule data but keep the user account
        user.currentScheduleId = null;
        user.currentSchedule = {};
        user.staffDirectory = [];
        user.budgetHours = 0;
        user.holidays = {};
        user.templates = [];
        user.lastModified = new Date();

        await user.save();

        res.json({
            msg: 'User data reset successfully',
            username
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error resetting user', error: err.message });
    }
});

// ---------- AUTH ROUTE ----------
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ msg: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid username or password' });

        const token = generateToken(user);
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Login error' });
    }
});

// ---------- SCHEDULE ROUTES ----------
// Get current schedule
app.get('/api/schedule', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.json({
            currentScheduleId: user.currentScheduleId,
            currentSchedule: user.currentSchedule || {},
            staffDirectory: user.staffDirectory || [],
            budgetHours: user.budgetHours || 0,
            holidays: user.holidays || {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error loading schedule' });
    }
});

// Save current schedule
app.post('/api/schedule', authMiddleware, async (req, res) => {
    const {
        currentScheduleId = null,
        currentSchedule = {},
        staffDirectory = [],
        budgetHours = 0,
        holidays = {}
    } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.currentScheduleId = currentScheduleId;
        user.currentSchedule = currentSchedule;
        user.staffDirectory = staffDirectory;
        user.budgetHours = budgetHours;
        user.holidays = holidays;
        user.lastModified = new Date();

        await user.save();

        res.json({ msg: 'Schedule saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error saving schedule' });
    }
});

// ---------- TEMPLATE ROUTES ----------
// Get all templates
app.get('/api/templates', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.json({ templates: user.templates || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error loading templates' });
    }
});

// Get single template
app.get('/api/templates/:index', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const index = parseInt(req.params.index);
        if (index < 0 || index >= user.templates.length) {
            return res.status(404).json({ msg: 'Template not found' });
        }

        res.json({ template: user.templates[index] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error loading template' });
    }
});

// Save new template
app.post('/api/templates', authMiddleware, async (req, res) => {
    const { name, staff, schedule, holidays, budgetHours } = req.body;

    if (!name) {
        return res.status(400).json({ msg: 'Template name is required' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.templates.push({
            name,
            staff: staff || [],
            schedule: schedule || {},
            holidays: holidays || {},
            budgetHours: budgetHours || 0,
            createdAt: new Date()
        });

        await user.save();

        res.json({
            msg: 'Template saved',
            templateId: user.templates.length - 1
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error saving template' });
    }
});

// Delete template
app.delete('/api/templates/:index', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const index = parseInt(req.params.index);
        if (index < 0 || index >= user.templates.length) {
            return res.status(404).json({ msg: 'Template not found' });
        }

        user.templates.splice(index, 1);
        await user.save();

        res.json({ msg: 'Template deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error deleting template' });
    }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});