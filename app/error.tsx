"use client";
import { startTransition, useState } from "react";
import { useGraph } from "@/lib/store";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [message, setMessage] = useState("");
  function exportWork() {
    try {
      const project = useGraph.getState().project;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(project, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "grapha-recovery.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage(
        "The download couldn’t start. Try opening Grapha in another tab.",
      );
    }
  }
  return (
    <main className="app-error">
      <div>
        <h1>The workspace ran into a problem.</h1>
        <p>
          You can download the current graph before trying again. Saved graphs
          have not been removed.
        </p>
        <div>
          <button onClick={() => startTransition(retry)}>Try again</button>
          <button onClick={exportWork}>Download current graph</button>
        </div>
        {message && <p role="alert">{message}</p>}
      </div>
    </main>
  );
}
