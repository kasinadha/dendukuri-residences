import AdminModulePage from "@/components/admin/AdminModulePage";
import { ContactRound } from "lucide-react";

export default function VendorsPage() {
  return (
    <AdminModulePage
      title="Vendors"
      description="Keep contact details and service history for property vendors."
      icon={ContactRound}
    />
  );
}
