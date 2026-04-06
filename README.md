# StockBroker CRM

A production-ready full-stack CRM for stockbroker calling teams.

## Features
- **Lead Management**: Track leads through the sales pipeline.
- **Agent Assignment**: Round-robin or manual assignment.
- **CSV Import**: Bulk upload leads and auto-assign.
- **Real-time Notifications**: Agents get notified when new leads are assigned.
- **Dashboard**: Visual stats for admins.
- **Follow-up System**: Reminders for callback status.

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Lucide React.
- **Backend**: Node.js, Express, MongoDB, Socket.io.
- **Auth**: JWT with Role-Based Access Control.

## Setup Instructions
1. **Environment Variables**:
   Update `.env` with your `MONGODB_URI` and `JWT_SECRET`.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Seed Data**:
   ```bash
   npx tsx seed.ts
   ```
4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## First admin (empty database)
When there are no users yet, the first login can bootstrap a **Super Admin** account using the email configured in `server/controllers/userController.ts` (see the bootstrap check in `loginUser`). After that, create agents from the admin UI or directly in MongoDB.
