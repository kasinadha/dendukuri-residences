import AdminModulePage from "@/components/admin/AdminModulePage";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <AdminModulePage
      title="Maintenance"
      description="Track repairs, vendor work, and follow-ups across the property."
      icon={Wrench}
    />
  );
}
