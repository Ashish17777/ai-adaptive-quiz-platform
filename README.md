# AI Adaptive Quiz Platform

An intelligent, full-stack quiz application featuring a dynamic **AI-driven adaptive difficulty evaluation engine**. 

Built with the MERN stack (MongoDB, Express, React, Node) and TypeScript, this platform adjusts question difficulty in real-time according to student performance: correct answers trigger harder prompts, while incorrect choices serve easier concepts.

---

## Technical Stack
- **Frontend:** React (Vite) + TypeScript
- **Styling:** Tailwind CSS (v4)
- **Backend:** Node.js + Express.js
- **Database:** MongoDB (using Mongoose)
- **Authentication:** JWT + bcrypt hashing
- **State Management:** Context API
- **API Communication:** Axios

---

## Features

### 👤 User Roles
- **Administrators:** Can manage the global Question Bank (CRUD), build quizzes, configure adaptive topics, and review platform-wide aggregate performance metrics.
- **Students:** Can browse assessments, take static quizzes with pagination, start AI Adaptive quizzes, review detailed correct/incorrect results, and track accuracy progress over time.

### 🧠 AI Adaptive Algorithm
- **Start Difficulty:** Assessments start at `medium` difficulty.
- **Up-scale:** Answering a question correctly raises difficulty (`easy -> medium -> hard`).
- **Down-scale:** Answering incorrectly drops difficulty (`hard -> medium -> easy`).
- **Dynamic Selection:** Questions are pulled on-the-fly from the matching topic bank, filtering out previously seen questions.
- **Session End:** Adaptive sessions conclude once the question threshold (8 items) is reached, or matching unused prompts are exhausted.

---

## Getting Started

### 📋 Prerequisites
- **Node.js** (v18 or higher recommended)
- **MongoDB** (Ensure local MongoDB is running at `mongodb://127.0.0.1:27017` or configure custom credentials in `.env`)

---

### ⚙️ Installation & Setup

#### 1. Setup Backend Server
```bash
cd server
npm install
```

#### 2. Seed Database
Run the pre-configured seeding script to generate sample administrative users, student accounts, and a bank of 9 JavaScript questions:
```bash
npm run seed
```

#### 3. Setup Frontend Client
```bash
# Return to root directory
cd ..
npm install
```

---

### 🚀 Running the Platform

#### Run backend server:
```bash
cd server
npm run dev
```
*(Server will start on port `5000`)*

#### Run frontend client:
```bash
# Return to root directory
npm run dev
```
*(Client will spin up on port `5173` or similar. Open the printed URL in your browser!)*

---

## 🔑 Demo Login Credentials
Use these pre-seeded accounts to explore both roles instantly:

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@quiz.com` | `admin123` |
| **Student** | `student@quiz.com` | `student123` |

You can also register new accounts with either role using the Register form on the app landing page.
