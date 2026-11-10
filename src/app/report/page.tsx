import { Suspense } from "react";
import { ReportView } from "./report-view";

export const metadata = { title: "Monthly report" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportView />
    </Suspense>
  );
}
