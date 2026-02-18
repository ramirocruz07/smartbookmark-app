# Smart Bookmark - Your Realtime Bookmark Inbox

Smart Bookmark is a modern, realtime bookmark manager that provides a beautiful glassmorphism interface for managing your personal bookmarks. Built with **Next.js 16 (App Router)**, **Supabase**, and **Tailwind CSS 4**, it offers instant synchronization across all your browser tabs and devices.

## Overview

Smart Bookmark is designed to be your personal bookmark inbox where you can quickly save and organize links. The app features a stunning dark-themed glassmorphism UI with translucent panels, glowing cyan accents, and a subtle grid background pattern. All bookmarks are private to your account and sync in real-time across multiple tabs and sessions.

## Features

- **🔐 Google Sign-in Only** - Secure authentication via Supabase OAuth (no email/password required)
- **🔒 Private Per-User Bookmarks** - Each bookmark is tied to your authenticated user account with Row Level Security (RLS)
- **➕ Add Bookmarks** - Quickly save links with a custom title and URL
- **🗑️ Delete Bookmarks** - Remove bookmarks you no longer need (only your own)
- **⚡ Realtime Updates** - Instant synchronization across all open tabs using Supabase Realtime subscriptions
- **🎨 Modern Glassmorphism UI** - Beautiful dark-themed interface with translucent panels and glowing edges
- **📱 Responsive Design** - Works seamlessly on desktop and mobile devices
- **🚀 Deployable on Vercel** - Easy deployment with environment-based configuration

---

## 1. Local setup

### Prerequisites

- Node.js 18+ and npm.
- A Supabase project with Google OAuth enabled.

### Install dependencies

```bash
cd smart-bookmark
npm install
```

### Environment variables

Create a `.env.local` file in the project root with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

These values are available from the **Supabase dashboard → Project Settings → API**.

---

## 2. Supabase configuration

### 2.1 Database schema

Create a `bookmarks` table in Supabase (SQL editor):

```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);
```

### 2.2 Row Level Security (RLS)

Enable RLS on the table:

```sql
alter table public.bookmarks enable row level security;
```

Add policies so users can only see and change their own bookmarks:

```sql
create policy "Users can view own bookmarks"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "Users can update own bookmarks"
on public.bookmarks
for update
using (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
on public.bookmarks
for delete
using (auth.uid() = user_id);
```

### 2.3 Realtime

In Supabase:

- Go to **Database → Replication → Realtime**.
- Enable Realtime for the `bookmarks` table in the `public` schema.

The frontend subscribes to `postgres_changes` on this table so inserts/updates/deletes broadcast to all open clients.

### 2.4 Google OAuth

In Supabase dashboard:

1. Go to **Authentication → Providers → Google**.
2. Enable Google and configure the OAuth credentials from Google Cloud Console.
3. Set **Redirect URLs** to include your local and production URLs, for example:
   - `http://localhost:3000/`
   - `https://your-vercel-domain.vercel.app/`

The app calls `supabase.auth.signInWithOAuth({ provider: "google" })` and Supabase manages the redirect flow.

---

## 3. Running the app locally

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

### How it works (high level)

- **`src/lib/supabaseClient.ts`** - Creates a browser Supabase client using the public URL and anon key, configured for session persistence and URL detection.

- **`src/app/bookmark-app.tsx`** - Main client component that handles:
  - **Authentication**: Checks the current auth session and displays a Google sign-in screen if logged out
  - **Bookmark Loading**: Fetches bookmarks from the `bookmarks` table on login
  - **Realtime Subscriptions**: Listens to Supabase Realtime events (`INSERT`, `UPDATE`, `DELETE`) to keep the list synchronized across all open tabs
  - **User Actions**: Allows adding bookmarks (title + URL) and deleting own bookmarks
  - **UI State Management**: Handles loading states, error messages, and form submissions

- **`src/app/globals.css`** - Defines the glassmorphism theme with:
  - Dark navy background (`#0a0e27`)
  - Subtle grid pattern overlay
  - Custom styling for translucent panels and glowing edges

- **`src/app/layout.tsx`** - Root layout with metadata and font configuration, includes `suppressHydrationWarning` to prevent hydration errors from browser extensions.

---

## 4. Deploying to Vercel

1. **Push to GitHub**  
   Initialize git in `smart-bookmark`, commit, and push to a new public repo.

2. **Create Vercel project**
   - In Vercel dashboard, import the GitHub repo.
   - Use the default Next.js build settings.

3. **Set environment variables in Vercel**
   - In the project settings, add:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Redeploy after saving.

4. **Update Supabase redirect URLs**
   - Once Vercel gives you a production URL (for example `https://smart-bookmark.vercel.app`), add it to your Supabase Google provider redirect URLs.

After deployment, the app should work at your Vercel URL with Google login, private per-user bookmarks, and realtime updates.

---

## 5. Technical Details

### Architecture

- **Frontend**: Next.js 16 with App Router, React 19, and Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL database with Realtime subscriptions)
- **Authentication**: Supabase Auth with Google OAuth provider
- **Styling**: Custom glassmorphism design with backdrop blur effects

### Key Design Decisions

- **Row Level Security (RLS)**: All data privacy is enforced at the database level, ensuring users can only access their own bookmarks even if client-side code is compromised
- **Realtime Subscriptions**: Uses Supabase's `postgres_changes` listener to broadcast changes instantly across all connected clients
- **Client-Side Rendering**: The main app component is a client component to handle real-time updates and user interactions
- **Hydration Safety**: Added `suppressHydrationWarning` to the HTML tag to prevent errors from browser extensions that modify the DOM

### UI/UX Features

- **Glassmorphism Design**: Translucent panels with backdrop blur create a modern, layered visual effect
- **Responsive Layout**: Flexbox-based layout that adapts to different screen sizes
- **URL Overflow Handling**: Long URLs are properly constrained with `break-all` and `min-w-0` to prevent layout overflow
- **Visual Feedback**: Hover states, focus rings, and loading indicators provide clear user feedback

## 6. Problems Encountered & Solutions

- **PowerShell Command Separator Issues**: `&&` is not supported in some PowerShell contexts, so commands were changed to use `;` (e.g. `cd D:\astrabit; npx create-next-app@latest ...`).

- **Ensuring Correct Supabase Configuration**: All DB schema, RLS policies, and Realtime settings are documented in this README so they can be applied via the Supabase UI/SQL editor without requiring direct database access from code.

- **Realtime with RLS and Per-User Privacy**: Instead of filtering by user ID on the client, RLS policies enforce that users only ever receive their own rows, keeping data isolated while still allowing a single Realtime subscription.

- **React Hydration Errors**: Browser extensions (like Night Eye) can inject attributes into the HTML tag, causing hydration mismatches. Solved by adding `suppressHydrationWarning` to the `<html>` tag in the root layout.

- **Long URL Overflow**: URLs that exceeded container width were breaking the layout. Fixed by using `min-w-0`, `flex-1`, and `break-all` CSS classes to properly constrain and wrap long URLs.

## 7. Future Enhancements

Potential features for future versions:

- Bookmark categories/tags
- Search functionality
- Bookmark editing
- Export/import bookmarks
- Browser extension for quick bookmarking
- Bookmark previews/thumbnails
- Archive functionality

