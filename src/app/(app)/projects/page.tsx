import { Suspense } from "react";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsView />
    </Suspense>
  );
}
