# 📊 GYANS Analytics

> Open-source, self-hosted Business Intelligence & Analytics Platform

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

![GYANS Analytics Screenshot](https://via.placeholder.com/800x400.png?text=GYANS+Analytics+Dashboard)

## ✨ Features

- 🚀 Fast and modern UI
- 📊 Powerful visualizations
- 🔒 Secure and self-hosted
- 🔄 Real-time updates via WebSockets
- 📦 Easy deployment with Docker

## 🚀 Quick Start

1. Clone the repository
2. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
3. Start the application with Docker Compose:
   ```bash
   make dev
   # or docker compose -f docker/docker-compose.yml up
   ```
4. Access the application:
   - Frontend: http://localhost:3000 (or http://localhost via nginx)
   - API Docs: http://localhost:8000/docs

## 🛠️ Manual Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🏗️ Architecture

```text
[Client/Browser]
       │
       ▼
    [Nginx]
    │     │
    │     ▼
    │   [React Frontend] (Port 3000)
    │
    ▼
[FastAPI Backend] (Port 8000)
    │     │
    │     ▼
    │   [Redis] (Port 6379)
    │
    ▼
[PostgreSQL DB] (Port 5432)
```

## 🗺️ Roadmap
- [ ] Implement user authentication
- [ ] Build custom dashboard layouts
- [ ] Add support for multiple data sources
- [ ] Export to PDF/CSV

## 🤝 Contributing
Contributions are welcome! Please check out the issues and submit a pull request.

## 📄 License
This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
