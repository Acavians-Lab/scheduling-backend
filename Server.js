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

    // This will store exactly what your frontend already uses:
    allSchedules: { type: Array, default: [] },
    currentScheduleId: { type: mongoose.Schema.Types.Mixed, default: null },
    staffDirectory: { type: Array, default: [] },
    budgetHours: { type: Number, default: 0 },
    weekDates: { type: Object, default: {} },
    holidays: { type: Object, default: {} },
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
        expiresIn: '30d' // match your "remember me" concept
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

// ---------- CREATE USERS (RUN ONCE TO SETUP) ----------
// To create the users, send a POST request to /api/admin/create-user with:
// {
//   "adminKey": "YOUR_ADMIN_KEY_FROM_ENV",
//   "username": "ginaa.lee",
//   "password": "9163709968"
// }
// Then do the same for lawrence with passcode 9254454907

app.post('/api/admin/create-user', async (req, res) => {
    const { adminKey, username, password } = req.body;

    // simple protection so public can't create accounts
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

// ---------- SCHEDULE ROUTES (PER USER) ----------
app.get('/api/schedule', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).lean();
        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.json({
            allSchedules: user.allSchedules,
            currentScheduleId: user.currentScheduleId,
            staffDirectory: user.staffDirectory,
            budgetHours: user.budgetHours,
            weekDates: user.weekDates,
            holidays: user.holidays
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error loading schedule' });
    }
});

app.post('/api/schedule', authMiddleware, async (req, res) => {
    const {
        allSchedules = [],
        currentScheduleId = null,
        staffDirectory = [],
        budgetHours = 0,
        weekDates = {},
        holidays = {}
    } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        user.allSchedules = allSchedules;
        user.currentScheduleId = currentScheduleId;
        user.staffDirectory = staffDirectory;
        user.budgetHours = budgetHours;
        user.weekDates = weekDates;
        user.holidays = holidays;
        user.lastModified = new Date();

        await user.save();

        res.json({ msg: 'Schedule saved' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Error saving schedule' });
    }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});