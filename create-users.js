// create-users.js
// Run this ONCE to create your 2 users
// How to run: node create-users.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Your MongoDB connection string
const MONGO_URI = 'mongodb+srv://alexacosta53517_db_user:A.cavian012121@schedule.6jabqjt.mongodb.net/staff-schedule?retryWrites=true&w=majority';

// User schema
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    allSchedules: { type: Array, default: [] },
    currentScheduleId: { type: mongoose.Schema.Types.Mixed, default: null },
    staffDirectory: { type: Array, default: [] },
    budgetHours: { type: Number, default: 0 },
    weekDates: { type: Object, default: {} },
    holidays: { type: Object, default: {} },
    lastModified: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Your 2 users
const USERS = [
    {
        username: '9163709968',
        password: 'Prominence1146!'
    },
    {
        username: 'Lawrence_ca@rightatschool.com',
        password: 'RadRasLawrence24!'
    }
];

async function createUsers() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB!\n');

        for (const userData of USERS) {
            try {
                // Check if user exists
                const existingUser = await User.findOne({ username: userData.username });
                
                if (existingUser) {
                    console.log(`⚠️  User "${userData.username}" already exists, skipping...`);
                    continue;
                }

                // Hash password
                const passwordHash = await bcrypt.hash(userData.password, 10);

                // Create user
                const user = new User({
                    username: userData.username,
                    passwordHash
                });

                await user.save();
                console.log(`✅ Created user: ${userData.username}`);

            } catch (error) {
                console.error(`❌ Error creating user "${userData.username}":`, error.message);
            }
        }

        console.log('\n🎉 SETUP COMPLETE!');
        console.log('\nYou can now login at: https://raschedule.onrender.com');
        console.log('\nUser 1:');
        console.log('  Username: 9163709968');
        console.log('  Password: Prominence1146!');
        console.log('\nUser 2:');
        console.log('  Username: Lawrence_ca@rightatschool.com');
        console.log('  Password: RadRasLawrence24!');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run it!
createUsers();
