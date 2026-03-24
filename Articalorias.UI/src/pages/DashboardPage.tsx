import { toDateString } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import DayDashboard from "@/components/DayDashboard";

function formatFriendlyDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const today = toDateString();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hello{user?.username ? `, ${user.username}` : ""}! 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Remember to log your calories and activities for today &mdash;{" "}
          <span className="font-medium text-gray-700">{formatFriendlyDate(today)}</span>
        </p>
      </div>

      <DayDashboard date={today} />
    </div>
  );
}
