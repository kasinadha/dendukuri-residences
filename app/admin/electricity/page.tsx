import AdminModulePage from "@/components/admin/AdminModulePage";
import { Zap } from "lucide-react";

export default function ElectricityPage() {
  return (
    <AdminModulePage
      title="Electricity"
      description="Log meter readings, track bills, and follow up on outstanding dues."
      icon={Zap}
    />
  );
}
