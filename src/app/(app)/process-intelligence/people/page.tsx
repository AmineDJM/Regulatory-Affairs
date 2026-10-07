import { redirect } from "next/navigation";
import { requireModule } from "@/lib/session";

/** L'ancienne adresse de « People & Workload » mène à la vue « Personnes » de Process Intelligence. */
export default async function PeopleWorkloadPage() {
  await requireModule("PROCESS_INTELLIGENCE");
  redirect("/process-intelligence?vue=personnes");
}
