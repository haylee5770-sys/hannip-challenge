const mysql = require('mysql2/promise');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const DATABASE_URL = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length).trim();

async function run(conn, sql, label) {
  try {
    await conn.execute(sql);
    console.log('✅', label);
  } catch (e) {
    console.log('⚠️ ', label, '-', e.message.substring(0, 100));
  }
}

async function main() {
  console.log('Connecting to DB...');
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('Connected!\n');

  const userCols = [
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT", "users.bio"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS avatarUrl TEXT", "users.avatarUrl"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS realName TEXT", "users.realName"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32)", "users.phone"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS joinPurpose TEXT", "users.joinPurpose"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS agreedToTerms BOOLEAN NOT NULL DEFAULT false", "users.agreedToTerms"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS onboardingDone BOOLEAN NOT NULL DEFAULT false", "users.onboardingDone"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP", "users.lastSignedIn"],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS invitedByUserId INT", "users.invitedByUserId"],
  ];
  for (const [sql, label] of userCols) await run(conn, sql, label);

  const tables = [
    [`CREATE TABLE IF NOT EXISTS scheduledJobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jobKey VARCHAR(64) NOT NULL UNIQUE,
      scheduleCronTaskUid VARCHAR(65),
      cronExpression VARCHAR(64),
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`, "scheduledJobs"],
    [`CREATE TABLE IF NOT EXISTS seasons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonNumber INT NOT NULL DEFAULT 1,
      totalDays INT NOT NULL DEFAULT 13,
      name VARCHAR(128) NOT NULL,
      startDate DATE NOT NULL,
      endDate DATE NOT NULL,
      status ENUM('upcoming','active','ended') NOT NULL DEFAULT 'active',
      seasonCode VARCHAR(64) NOT NULL DEFAULT '',
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`, "seasons"],
    [`CREATE TABLE IF NOT EXISTS seasonParticipants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonId INT NOT NULL,
      userId INT NOT NULL,
      baselineWeightKg DECIMAL(5,2),
      baselineRecordedDate DATE,
      joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX seasonParticipants_idx (seasonId, userId)
    )`, "seasonParticipants"],
    [`CREATE TABLE IF NOT EXISTS seasonPhotos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonId INT NOT NULL,
      userId INT NOT NULL,
      dayNumber INT NOT NULL,
      slot ENUM('before','progress','after') NOT NULL,
      angle ENUM('front','side') NOT NULL,
      photoKey VARCHAR(512) NOT NULL,
      photoUrl TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX seasonPhotos_idx (seasonId, userId)
    )`, "seasonPhotos"],
    [`CREATE TABLE IF NOT EXISTS seasonReports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonId INT NOT NULL,
      userId INT NOT NULL,
      baselineWeightKg DECIMAL(5,2),
      finalWeightKg DECIMAL(5,2),
      lossPercent DECIMAL(6,3),
      finalSkeletalMuscleKg DECIMAL(5,2),
      finalBodyFatPercent DECIMAL(5,2),
      weightCount INT NOT NULL DEFAULT 0,
      mealCount INT NOT NULL DEFAULT 0,
      exerciseCount INT NOT NULL DEFAULT 0,
      sleepCount INT NOT NULL DEFAULT 0,
      waterCount INT NOT NULL DEFAULT 0,
      totalCount INT NOT NULL DEFAULT 0,
      participationScore INT NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT false,
      reflection TEXT,
      isPublic BOOLEAN NOT NULL DEFAULT true,
      generatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX seasonReports_idx (seasonId, userId)
    )`, "seasonReports"],
    [`CREATE TABLE IF NOT EXISTS sleeps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      recordedDate DATE NOT NULL,
      bedAt TIMESTAMP NOT NULL,
      wakeAt TIMESTAMP NOT NULL,
      durationMinutes INT NOT NULL,
      bedHour INT NOT NULL,
      bedMinute INT NOT NULL,
      wakeHour INT NOT NULL,
      wakeMinute INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX sleeps_idx (userId, recordedDate)
    )`, "sleeps"],
    [`CREATE TABLE IF NOT EXISTS waters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      recordedDate DATE NOT NULL,
      recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      volumeMl INT NOT NULL,
      photoKey VARCHAR(512) NOT NULL,
      photoUrl TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX waters_idx (userId, recordedDate)
    )`, "waters"],
    [`CREATE TABLE IF NOT EXISTS waistRecords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      seasonId INT NOT NULL,
      userId INT NOT NULL,
      beforeCm DECIMAL(5,1),
      afterCm DECIMAL(5,1),
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX waistRecords_idx (seasonId, userId)
    )`, "waistRecords"],
    [`CREATE TABLE IF NOT EXISTS seasonTokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      seasonId INT NOT NULL,
      grantedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX seasonTokens_idx (userId, seasonId)
    )`, "seasonTokens"],
    [`CREATE TABLE IF NOT EXISTS appSettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entryCode VARCHAR(64) NOT NULL DEFAULT '',
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`, "appSettings"],
  ];

  const extraCols = [
    ["ALTER TABLE weights ADD COLUMN IF NOT EXISTS inbodyPhotoKey VARCHAR(512)", "weights.inbodyPhotoKey"],
    ["ALTER TABLE weights ADD COLUMN IF NOT EXISTS inbodyPhotoUrl TEXT", "weights.inbodyPhotoUrl"],
    ["ALTER TABLE weights ADD COLUMN IF NOT EXISTS note TEXT", "weights.note"],
    ["ALTER TABLE meals ADD COLUMN IF NOT EXISTS aiComment TEXT", "meals.aiComment"],
    ["ALTER TABLE meals ADD COLUMN IF NOT EXISTS aiCommentAt TIMESTAMP NULL", "meals.aiCommentAt"],
    ["ALTER TABLE exercises ADD COLUMN IF NOT EXISTS photoKey VARCHAR(512)", "exercises.photoKey"],
    ["ALTER TABLE exercises ADD COLUMN IF NOT EXISTS photoUrl TEXT", "exercises.photoUrl"],
  ];

  for (const [sql, label] of tables) await run(conn, sql, label);
  for (const [sql, label] of extraCols) await run(conn, sql, label);

  await conn.end();
  console.log('\n✅ Migration complete!');
}

main().catch(console.error);
