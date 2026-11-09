import { Suspense } from "react";
import { DiaryView } from "./diary-view";

export const metadata = { title: "Diary" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DiaryView />
    </Suspense>
  );
}
