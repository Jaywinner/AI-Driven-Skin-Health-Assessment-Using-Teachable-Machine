# Skin Type Detector

A Flask web app with client-side Teachable Machine model for skin type detection. Features include camera capture, image upload, ML inference in the browser, and admin dashboard for feedback analytics.

## Features
- **Client-side ML inference** using TensorFlow.js (model runs in browser)
- **Camera capture + image upload** for analysis
- **Admin dashboard** with login, charts, and Excel export
- **Database storage** for analysis results and user feedback (SQLite local, PostgreSQL production)
- **Responsive design** for mobile and desktop

## Local Development

### 1. Setup Environment

```powershell
# Create virtual environment
python -m venv .venv
. .\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Copy environment template
copy .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file:

```env
SECRET_KEY=your-random-secret-key-here
ADMIN_USER=your-admin-username
ADMIN_PASS=your-secure-password
```

### 3. Run Locally

```powershell
python app.py
```

Open http://127.0.0.1:5000/

- Main app: http://127.0.0.1:5000/
- Admin dashboard: http://127.0.0.1:5000/admin

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Flask session secret (generate random string) |
| `ADMIN_USER` | Yes | Admin dashboard username |
| `ADMIN_PASS` | Yes | Admin dashboard password |
| `DATABASE_URL` | No | PostgreSQL connection string (uses SQLite if not set) |
| `ADMIN_TOKEN` | No | Alternative token-based auth for APIs |

## Deployment to Render

### Prerequisites
- GitHub account
- Render account (free tier available)

### Steps

1. **Push to GitHub**

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

2. **Create Render Web Service**
   - Go to https://render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: skin-type-detector (or your choice)
     - **Environment**: Python
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`

3. **Set Environment Variables in Render**
   - In Render dashboard, go to "Environment"
   - Add these variables:
     ```
     SECRET_KEY=<generate-random-string-here>
     ADMIN_USER=<your-admin-username>
     ADMIN_PASS=<your-secure-password>
     ```

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your app will be live at `https://your-app-name.onrender.com`

### Using PostgreSQL (Optional)

For production database, add PostgreSQL:

1. In Render, create a new PostgreSQL database
2. Copy the "Internal Database URL"
3. Add to environment variables:
   ```
   DATABASE_URL=<your-postgres-url>
   ```
4. Restart the web service

## Admin Dashboard

Access at `/admin`:
- Login with credentials from `ADMIN_USER` and `ADMIN_PASS`
- View analytics: total entries, skin type distribution, confidence levels
- Download Excel export of all feedback
- Session persists on page refresh

## API Endpoints

### Public
- `POST /api/save-feedback` - Save analysis result and user feedback

### Protected (Admin)
- `POST /api/admin-login` - Authenticate admin
- `POST /api/admin-logout` - Clear admin session
- `GET /api/feedback-data` - Get aggregated statistics (JSON)
- `GET /api/export-feedback` - Download Excel file of all feedback

## Security & Privacy

- **No image storage**: Only analysis results and feedback are saved
- **Session-based auth**: Admin credentials protected with Flask sessions
- **Environment variables**: Secrets never committed to Git
- **HTTPS**: Use Render's free SSL in production

## Project Structure

```
.
├── app.py                  # Flask server and API endpoints
├── db.py                   # SQLAlchemy models and database setup
├── index.html              # Main user interface
├── script.js               # Frontend logic and ML inference
├── styles.css              # Styling
├── admin_new.html          # Admin dashboard (login + charts)
├── model.json              # Teachable Machine model architecture
├── metadata.json           # Model metadata
├── weights.bin             # Model weights
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Troubleshooting

**"Module not found" errors:**
```powershell
pip install -r requirements.txt
```

**Admin login not working:**
- Check `.env` file has correct `ADMIN_USER` and `ADMIN_PASS`
- Restart Flask server after changing `.env`

**Charts not showing:**
- Ensure you're logged in via `/admin`
- Check browser console for errors
- Verify database has data (upload and analyze an image first)

**Port already in use:**
```powershell
# Change port in app.py or kill process using port 5000
netstat -ano | findstr :5000
taskkill /PID <process-id> /F
```

## License

MIT
