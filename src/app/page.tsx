import { redirect } from "next/navigation";

// The middleware ensures authentication; route the index to the personal
// workspace ("Mon espace") — every user's home base.
export default function RootPage() {
  redirect("/mon-espace");
}
