-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleChatUserId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "workStart" TEXT NOT NULL DEFAULT '02:00',
    "workEnd" TEXT NOT NULL DEFAULT '11:00',
    "lunchStart" TEXT NOT NULL DEFAULT '04:00',
    "lunchEnd" TEXT NOT NULL DEFAULT '05:00',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "firstMessageTime" DATETIME,
    "replyTime" DATETIME,
    "leadTimeSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "messageId" TEXT,
    "conversationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CheckIn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkInId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkInId" TEXT,
    "direction" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageHistory_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIMessageHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "totalCheckIns" INTEGER NOT NULL DEFAULT 0,
    "responses" INTEGER NOT NULL DEFAULT 0,
    "misses" INTEGER NOT NULL DEFAULT 0,
    "averageLeadTime" INTEGER NOT NULL DEFAULT 0,
    "longestLeadTime" INTEGER NOT NULL DEFAULT 0,
    "fastestLeadTime" INTEGER NOT NULL DEFAULT 0,
    "responseRate" REAL NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_googleChatUserId_key" ON "Employee"("googleChatUserId");

-- CreateIndex
CREATE INDEX "Employee_enabled_idx" ON "Employee"("enabled");

-- CreateIndex
CREATE INDEX "CheckIn_status_idx" ON "CheckIn"("status");

-- CreateIndex
CREATE INDEX "CheckIn_scheduledTime_idx" ON "CheckIn"("scheduledTime");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_employeeId_scheduledTime_key" ON "CheckIn"("employeeId", "scheduledTime");

-- CreateIndex
CREATE INDEX "Reminder_checkInId_idx" ON "Reminder"("checkInId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_checkInId_level_key" ON "Reminder"("checkInId", "level");

-- CreateIndex
CREATE INDEX "MessageHistory_checkInId_idx" ON "MessageHistory"("checkInId");

-- CreateIndex
CREATE INDEX "AIMessageHistory_category_idx" ON "AIMessageHistory"("category");

-- CreateIndex
CREATE INDEX "AIMessageHistory_hash_idx" ON "AIMessageHistory"("hash");

-- CreateIndex
CREATE INDEX "AIMessageHistory_generatedAt_idx" ON "AIMessageHistory"("generatedAt");

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_date_employeeId_key" ON "DailyReport"("date", "employeeId");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
