import { toDateString } from "@/utils/format";
import DayDashboard from "@/components/DayDashboard";


export default function DashboardPage() {
  const today = toDateString();

  return <DayDashboard date={today} />;
}
