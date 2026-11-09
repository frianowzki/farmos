import { Suspense } from "react";
import { TasksView } from "./tasks-view";

export const metadata = { title: "Daily tasks" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TasksView />
    </Suspense>
  );
}
