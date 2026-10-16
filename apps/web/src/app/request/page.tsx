import { redirect } from "next/navigation";
import { DEFAULT_ORG_SLUG } from "@/lib/org";

export default function RequestRedirect() {
  redirect(`/c/${DEFAULT_ORG_SLUG}`);
}
