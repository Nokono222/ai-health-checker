import { AuthGuard } from "@/components/AuthGuard";
import { LogForm } from "@/components/LogForm";

export default function NewLogPage() {
  return (
    // 記録したいだけのときに待たされないよう、認証の解決前からフォームを描画する（#125）
    <AuthGuard renderWhileResolving>
      <LogForm />
    </AuthGuard>
  );
}
