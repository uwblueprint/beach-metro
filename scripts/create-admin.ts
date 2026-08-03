// Creates (or reports) an admin user in Supabase Auth via the service-role key.
// Admins are the only user type; there is no public signup (locked decision).
//
//   pnpm create-admin <email> <password>
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const [email, password] = process.argv.slice(2);

if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY missing in .env.local.");
  process.exit(1);
}
if (!email || !password) {
  console.error("usage: pnpm create-admin <email> <password>");
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // internal tool; no confirmation email round-trip
});

if (error) {
  console.error("createUser failed:", error.message);
  process.exit(1);
}
console.log(`admin created: ${data.user.email} (${data.user.id})`);
