# 🏋️ Kinetic AI Coach

### AI-inspired personalized fitness coaching experience built with HTML, CSS, JavaScript & Cloudflare Pages.

Kinetic AI Coach is a responsive fitness web application that helps users start personalized workout journeys through **Nova**, an AI-inspired virtual coach. The project focuses on creating a clean product experience with workout personalization, progress tracking, and a modern conversational interface.

---

## 🌐 Live Demo

* **Live Website:** https://kinetic-ai-coach.pages.dev
* **GitHub Repository:** https://github.com/Aash-07/kinetic-ai-coach

---

## 📸 Project Preview

### Desktop Experience

![Kinetic AI Coach Desktop](assets/hero.png)

### Mobile Responsive Experience

<img src="assets/mobile.png" alt="Kinetic AI Coach Mobile UI" width="280"/>

---

## ✨ Features

* 🤖 **Nova AI Coach** – AI-inspired conversational fitness coach.
* 💪 **Workout Personalization** – Generates routines based on user goals and energy level.
* 🔥 **Goal-Based Fitness Plans** – Weight loss, muscle gain, cardio, stretching, and recovery.
* 📱 **Fully Responsive UI** – Optimized for desktop, tablet, and mobile.
* 🎨 **Modern Dark Theme** – Glassmorphism + gradient design.
* ☁️ **Cloudflare Deployment** – Hosted using Cloudflare Pages.
* 🔒 **Secure Headers** – Includes security headers through `_headers`.

---

## 🧩 Tech Stack

| Technology           | Usage                       |
| -------------------- | --------------------------- |
| HTML5                | Structure                   |
| CSS3                 | Styling & Responsive Layout |
| JavaScript (ES6)     | Application Logic           |
| Cloudflare Pages     | Hosting                     |
| Cloudflare Functions | Backend-ready API Routes    |
| GitHub               | Version Control             |

---

## 🏗️ Project Architecture

```text
Browser
   │
   ▼
HTML + CSS + JavaScript
   │
   ▼
Cloudflare Pages
   │
   ▼
Cloudflare Functions (API Ready)
   │
   ▼
Offline AI Response Engine
```

The project currently runs in **offline AI mode** for deployment without requiring a paid LLM API.

---

## 📁 Folder Structure

```text
kinetic-ai-coach/
├── assets/
│   ├── hero.png
│   └── mobile.png
│
├── functions/
│   └── api/
│       ├── coach.js
│       ├── stats.js
│       └── track.js
│
├── app.js
├── styles.css
├── index.html
├── _headers
├── README.md
└── .gitignore
```

---

## 🚀 Run Locally

```bash
git clone https://github.com/Aash-07/kinetic-ai-coach.git

cd kinetic-ai-coach
```

1. Open the project in VS Code.
2. Install **Live Server** extension.
3. Right click `index.html`.
4. Click **Open with Live Server**.

---

## ☁️ Deployment

The application is deployed on **Cloudflare Pages**.

Deployment configuration:

* Framework Preset: **None**
* Build Command: *(empty)*
* Build Output Directory: `/`
* Production Branch: `main`

Every push to the `main` branch automatically triggers a new Cloudflare deployment.

---

## 🔒 Security

Configured using the `_headers` file.

Included headers:

* X-Frame-Options
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy

---

## 📱 Responsive Design

Designed for:

* 💻 Desktop
* 📱 Android
* 📱 iPhone
* 📲 Tablets

The layout adapts automatically across different screen sizes.

---

## 🚧 Future Improvements

* Claude API integration for real AI conversations.
* Voice-enabled fitness coaching.
* Nutrition planner.
* Workout calendar.
* Authentication and user history.
* Wearable device integration.

---

## 👨‍💻 Built By

**Aashlesh Panda**

Kinetic AI Coach — Product Engineering Internship Submission
