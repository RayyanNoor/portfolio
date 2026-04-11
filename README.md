# Rayan Portfolio

Dynamic portfolio with:
- Public client page
- Admin dashboard
- PostgreSQL persistence
- Server-side admin authentication

## Tech Stack
- Frontend: HTML, CSS, vanilla JS
- Backend: Node.js + Express
- Database: PostgreSQL
- Deploy target: Railway

## Features
- Client pages read data from `/api/portfolio`
- Admin edits write directly to PostgreSQL
- Changes from admin are visible to all visitors globally
- Admin auth uses secure server-side passcode hash (`bcrypt`)
- Passcode can be changed from admin dashboard

## Environment Variables
Create `.env` from `.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portfolio
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_PASSCODE=replace-with-a-strong-passcode
```

## Local Run
```powershell
cd C:\Users\rayya\portfolio
npm install
npm start
```

Open:
- Public: `http://localhost:3000/`
- Admin Login: `http://localhost:3000/admin-login.html`

## Railway Deployment (App + PostgreSQL)
1. Push this repo to GitHub.
2. In Railway:
- Create a new project from your GitHub repo.
- Add a PostgreSQL service.
- In your app service Variables, set:
  - `DATABASE_URL` (Railway PostgreSQL connection string)
  - `JWT_SECRET` (long random secret)
  - `ADMIN_PASSCODE` (your strong admin passcode)
  - `PORT` is optional (Railway injects it automatically).
3. Railway will run `npm install` and `npm start`.
4. Open your Railway domain.

## Routes
- Public portfolio: `/`
- Admin login: `/admin-login.html`
- Admin dashboard: `/admin.html`

## Security Notes
- Do not commit `.env`.
- Use a strong `ADMIN_PASSCODE` (12+ chars).
- Use a strong random `JWT_SECRET`.
