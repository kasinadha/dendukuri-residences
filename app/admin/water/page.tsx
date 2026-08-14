import AdminModulePage from "@/components/admin/AdminModulePage";
import { Droplets } from "lucide-react";

export default function WaterPage() {
  return (
    <AdminModulePage
      title="Water Tankers"
      description="Record tanker orders, supplier payments, and delivery history."
      icon={Droplets}
    />
  );
}
