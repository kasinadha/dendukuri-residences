import AdminModulePage from "@/components/admin/AdminModulePage";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <AdminModulePage
      title="Reports"
      description="Review rent collections, utilities, and operational summaries."
      icon={BarChart3}
    />
  );
}
