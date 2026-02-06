# Supabase backup setup

Backup and sync use Supabase (Auth + Database + Storage). When configured, users can sign in and have sessions backed up automatically; "Sync now" restores from the cloud.

## 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In **Settings → API**: copy **Project URL** and **anon public** key.
3. In your app `.env` (see `.env.example`):

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Run the contents of `schema.sql` in this folder.
3. In **Storage**, create a bucket named **images** (private).
4. In **Storage → Policies** for bucket `images`, add a policy so users can read/write only their own folder. The policy is in `schema.sql` (bottom section).

## 3. Auth

Email/password auth is used. In **Authentication → Providers**, ensure "Email" is enabled. Optionally disable "Confirm email" for quicker testing.

## Sharing (future)

The schema can be extended later for sharing (e.g. a `share_id` or `public_link` on sessions and a read-only policy for shared sessions).
