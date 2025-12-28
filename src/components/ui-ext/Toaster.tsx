import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      richColors
      position="top-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: "rounded-xl border border-border bg-card text-foreground shadow-elevated",
          title: "text-sm font-semibold",
          description: "text-xs text-muted-foreground",
        },
      }}
    />
  );
}
