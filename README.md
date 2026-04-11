# Rayan Portfolio

Production-ready one-page programmer portfolio with a separate admin dashboard.

## Public Features
- Single-page flow: Home, About, Projects, Console, Contact
- Searchable and filterable project explorer
- Dynamic language cloud and animated engineering metrics
- Interactive command console with quick actions
- Click-to-contact actions for WhatsApp and email
- Smooth transitions and responsive layout

## Admin
- `admin-login.html` is the admin entry route
- `admin.html` is protected by a login gate
- Passkey is owner-managed; login page does not allow passkey creation
- PBKDF2 hash + salt verification, lockout after failed attempts, and session expiry are enabled
- Passkey can be changed from the admin Profile -> Security section after login
- Edit mode is locked by default; you must enable edit mode before changes are allowed
- Manage profile and projects with localStorage-backed forms, including image file uploads

## Local Run
```powershell
cd C:\Users\rayya\portfolio
python -m http.server 5500
```
Open:
- Public: `http://localhost:5500/`
- Admin Login: `http://localhost:5500/admin-login.html`

## Deploy
1. Push `main` to GitHub
2. Enable GitHub Pages from `main` and `/ (root)`

## Persistence Note
Admin edits are saved to browser localStorage. For permanent content, update defaults in `scripts/data.js` and push.
