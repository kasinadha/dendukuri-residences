import AdminModulePage from "@/components/admin/AdminModulePage";
import { CircleHelp } from "lucide-react";

export default function FaqsPage() {
  return (
    <AdminModulePage
      title="FAQs"
      description="Maintain common answers for tenants and property operations."
      icon={CircleHelp}
    />
  );
}
