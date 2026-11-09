import { Suspense } from "react";
import { AssistantView } from "./assistant-view";

export const metadata = { title: "Research desk" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AssistantView />
    </Suspense>
  );
}
