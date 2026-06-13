"use client";
import ComingSoon from "../../components/ComingSoon";
import { Brain } from "lucide-react";

export default function KnowledgePage() {
  return (
    <ComingSoon
      title="پایگاه دانش"
      description="آپلود اسناد، فایل‌ها و محتوای سازمانی برای آموزش به هوش مصنوعی. جستجوی معنایی در همه محتوای شما."
      icon={Brain}
      color="purple"
    />
  );
}
