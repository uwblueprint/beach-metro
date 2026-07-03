import { redirect } from "next/navigation";

export default function Home() {
  // The dashboard shell lives under the (dashboard) route group; Overview is the
  // default landing. Unauthenticated users are redirected to /auth/login by the proxy.
  redirect("/overview");
}
