import { redirect } from "next/navigation";

// The middleware ensures authentication; route the index to the dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
