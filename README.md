# Milan 💬
## Real-Time Chat Application (WhatsApp-Style)

Milan is a **real-time chat web application** inspired by WhatsApp and modern messaging platforms.  
It is built using **Next.js (App Router)**, **TypeScript**, **Clerk Authentication**, and **Convex** for backend, database, and real-time subscriptions.

This project is designed for **full-stack interviews**, focusing on **real-time systems, clean architecture, and production-ready UX**.

---

## 🚀 Live Demo
> [Milan Live Demo](https://milan-messenger.vercel.app) *(Update with your actual link)*

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Authentication:** Clerk
- **Backend & Database:** Convex (Real-time)
- **Deployment:** Vercel

---

## 🧭 Application Flow

1. User lands on a **public landing page**.
2. Navbar shows **Login / Sign Up** options.
3. Authentication is seamlessly handled by **Clerk**.
4. After login → redirected to the **Chat Dashboard**.
5. Users can:
   - Discover and search for other users.
   - Start private or group conversations.
   - Send and receive messages in real time.
6. Logout redirects back to the landing page.

---

## ✨ Features

### 🔐 Authentication
- Email & social login using Clerk.
- Secure session handling.
- Logged-in user name & avatar displayed.
- User profile automatically synced and stored in Convex.

### 👥 User List & Search
- Complete list of registered users.
- Current user excluded from the list.
- Live search by user name.
- Click a user to immediately open or create a conversation.

### � Messaging Experience
- **One-to-One & Groups**: Private and group chats with real-time updates.
- **WhatsApp-Style UI**: Sender messages on the right, receiver messages on the left with avatars.
- **Rich Interaction**: Supports message replies, emoji reactions, and soft deletion.
- **Typing Indicators**: Real-time "User is typing..." status with name-specific feedback.
- **Unread Counters**: Live unread message badges that clear upon opening.

### ⚡ Real-Time Engine
- Instant updates using Convex subscriptions (no polling).
- **Online/Offline Presence**: Green dot indicators for active users with "Last Seen" support.
- **Smart Auto-Scroll**: Intelligent scroll-to-bottom behavior with a "New Messages" shortcut.

### 📱 Responsive Design
- **Desktop**: Three-pane optimized layout.
- **Mobile**: Dynamic navigation between conversation list and full-screen chat with back button support.

---

## 🗂️ Project Structure

```text
milan/
├── app/
│   ├── (auth)/          # Authentication routes (Sign-in/Sign-up)
│   ├── (marketing)/     # Public landing pages
│   └── (main)/
│       └── chat/        # Protected chat dashboard
├── components/
│   ├── chat/            # Chat-specific modules (Sidebar, Input, Bubbles)
│   ├── ui/              # Reusable UI primitives (Avatar, Buttons)
│   └── providers/       # Context providers (Convex, Clerk)
├── convex/
│   ├── schema.ts        # Database schema
│   ├── users.ts         # User management
│   ├── conversations.ts # Chat logic
│   └── messages.ts      # Message handling
└── lib/                 # Utility functions & custom hooks
```

---

## ⚙️ Local Setup

### 1️⃣ Clone Repository
```bash
git clone https://github.com/amit81127/Milan.git
cd Milan
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Environment Variables (`.env.local`)
Create a `.env.local` file and add your keys:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CONVEX_URL=https://xxxxx.convex.cloud
```

### 4️⃣ Start Convex
```bash
npx convex dev
```

### 5️⃣ Run Development Server
```bash
npm run dev
```
Open: [http://localhost:3000](http://localhost:3000)

---

## 🧠 Interview Explanation (Short)
> "Milan is a high-performance, real-time messenger built to demonstrate full-stack proficiency. It leverages Next.js for a cinematic UI, Clerk for robust authentication, and Convex for a reactive backend. The app implements complex patterns like real-time presence, typing indicators, and unread tracking within a highly responsive, WhatsApp-inspired design system."

---

## 👤 Author
**Amit Kumar**  
Full-Stack Developer  
[GitHub Profile](https://github.com/amit81127) | [LinkedIn](https://linkedin.com/in/yourprofile)

## 📄 License
This project is built for portfolio and evaluation purposes.