# PDF Book Reader, Annotator & Editor Platform

A production-grade, research-focused PDF reading, annotation, and editing platform with multi-user support and admin controls.

## Features

- **PDF Reader** — Upload, view, paginate, zoom, and search PDFs in the browser
- **Annotation System** — Text highlighting, freehand drawing, shapes (rectangle, circle, arrow), and text notes
- **Notes Panel** — Rich text notes per document with sidebar editor
- **Drawing Pad** — Standalone canvas sketchpad for freehand illustrations
- **Versioning** — Full annotation history with timestamped changes
- **Search** — Global search across PDFs, annotations, and notes
- **Multi-User Auth** — JWT-based authentication with role-based access (Admin + User)
- **Admin Dashboard** — User management, PDF library management, activity logs, storage overview

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Python, FastAPI, SQLAlchemy, SQLite |
| Auth     | JWT (python-jose), bcrypt           |
| Frontend | HTML5, CSS3, Vanilla JavaScript     |
| PDF      | PDF.js                              |

## Project Structure

```
/backend
  main.py              # FastAPI entry point
  database.py          # SQLAlchemy engine & session
  models.py            # ORM models (User, PDF, Annotation, Note, ActivityLog)
  auth/handler.py      # JWT auth & password hashing
  routes/
    auth_routes.py     # Login, profile
    user_routes.py     # User CRUD (admin)
    pdf_routes.py      # PDF upload, list, serve, delete
    annotation_routes.py # Annotation CRUD + versioning
    note_routes.py     # Notes CRUD
    admin_routes.py    # Admin stats, logs, search
    search_routes.py   # Global search
  requirements.txt
  .env                 # Configuration

/frontend
  login.html           # Login page
  dashboard.html       # Main PDF reader + annotation workspace
  admin.html           # Admin dashboard
  css/
    common.css         # Design system & shared styles
    login.css          # Login page styles
    dashboard.css      # Dashboard layout & components
    admin.css          # Admin panel styles
  js/
    auth.js            # Authentication module
    utils.js           # API helper, Toast, Modal, formatters
    pdf-viewer.js      # PDF.js viewer with navigation & zoom
    annotations.js     # Annotation drawing & management
    notes.js           # Notes CRUD UI
    drawing.js         # Sketchpad canvas
    dashboard.js       # Dashboard orchestration
    admin.js           # Admin panel logic

/uploads               # Uploaded PDF storage
/annotations           # Annotation data storage
```

## Getting Started

### Prerequisites

- Python 3.10+
- pip

### Setup & Run

```bash
# 1. Create and activate virtual environment
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the server
python main.py
```

The server starts at **http://localhost:8000**

### Default Admin Credentials

| Field    | Value                    |
|----------|--------------------------|
| Email    | admin@bookplatform.com   |
| Password | Admin123!                |

### API Documentation

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

## Pages

| URL         | Description                  |
|-------------|------------------------------|
| `/`         | Login page                   |
| `/dashboard`| PDF reader & annotation workspace |
| `/admin`    | Admin dashboard (admin only) |

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login with email/password
- `GET /api/auth/me` — Get current user profile

### PDFs
- `POST /api/pdfs/upload` — Upload a PDF
- `GET /api/pdfs/` — List accessible PDFs
- `GET /api/pdfs/{id}/file` — Serve PDF file
- `DELETE /api/pdfs/{id}` — Delete a PDF

### Annotations
- `POST /api/annotations/` — Create annotation
- `GET /api/annotations/pdf/{pdf_id}` — List annotations
- `PUT /api/annotations/{id}` — Update annotation (creates version)
- `DELETE /api/annotations/{id}` — Delete annotation
- `PUT /api/annotations/{id}/toggle-visibility` — Show/hide
- `GET /api/annotations/{id}/history` — Version history

### Notes
- `POST /api/notes/` — Create note
- `GET /api/notes/pdf/{pdf_id}` — List notes
- `PUT /api/notes/{id}` — Update note
- `DELETE /api/notes/{id}` — Delete note

### Admin
- `GET /api/admin/stats` — Platform statistics
- `GET /api/admin/logs` — Activity logs
- `GET /api/admin/search` — Global search

### Users (Admin)
- `GET /api/users/` — List all users
- `POST /api/users/` — Create user
- `PUT /api/users/{id}` — Update user
- `DELETE /api/users/{id}` — Delete user

### Search
- `GET /api/search/?q=query` — Search PDFs, annotations, notes