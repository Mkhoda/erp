"use client";
import ComingSoon from "../../components/ComingSoon";
import { Workflow } from "lucide-react";

export default function WorkflowsPage() {
  return (
    <ComingSoon
      title="گردش‌کارهای هوشمند"
      description="اتوماسیون وظایف تکراری با استفاده از هوش مصنوعی. ساخت گردش‌کار بدون کدنویسی."
      icon={Workflow}
      color="green"
    />
  );
}
