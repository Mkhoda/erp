"use client";
import ComingSoon from "../../components/ComingSoon";
import { Bot } from "lucide-react";

export default function AgentsPage() {
  return (
    <ComingSoon
      title="عوامل هوشمند"
      description="پیکربندی و مدیریت عوامل AI که به‌صورت خودکار وظایف سازمانی را انجام می‌دهند."
      icon={Bot}
      color="amber"
    />
  );
}
