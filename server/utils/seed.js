// Run: npm run seed
// Creates 1 admin + 5 students + sample notes so the admin
// dashboard has data on first demo.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany(), Note.deleteMany()]);

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@demo.com',
    password: 'admin123',
    role: 'admin',
  });

  const students = await User.create(
    ['Arun', 'Priya', 'Karthik', 'Divya', 'Suresh'].map((name, i) => ({
      name,
      email: `${name.toLowerCase()}@demo.com`,
      password: 'student123',
      profile: {
        year: 2,
        skills: [['react', 'node'], ['python'], ['mongodb', 'express'], ['java'], ['react']][i],
      },
    }))
  );

  const tags = ['dsa', 'placement', 'project', 'exam', 'mern'];
  const notes = [];
  students.forEach((s, i) => {
    for (let n = 0; n <= i; n++) {
      notes.push({
        user: s._id,
        title: `${s.name}'s note ${n + 1}`,
        body: 'Sample body',
        tags: [tags[n % tags.length], tags[(n + 1) % tags.length]],
        meta: { priority: ['low', 'medium', 'high'][n % 3], pinned: n === 0 },
      });
    }
  });
  await Note.create(notes);

  console.log('Seeded: admin@demo.com / admin123, students *@demo.com / student123');
  process.exit(0);
};
run();
