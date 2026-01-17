import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-none group-[.toaster]:font-mono group-[.toaster]:uppercase group-[.toaster]:tracking-widest group-[.toaster]:text-[10px]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-none group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-none",
          success: "group-[.toaster]:border-green-900 group-[.toaster]:text-green-500",
          error: "group-[.toaster]:border-red-900 group-[.toaster]:text-red-500",
          info: "group-[.toaster]:border-blue-900 group-[.toaster]:text-blue-500",
          warning: "group-[.toaster]:border-amber-900 group-[.toaster]:text-amber-500",
          loading: "group-[.toaster]:border-zinc-800",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
