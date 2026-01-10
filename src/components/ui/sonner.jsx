import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-black group-[.toaster]:text-white group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg group-[.toaster]:rounded-none group-[.toaster]:font-mono group-[.toaster]:uppercase group-[.toaster]:tracking-widest group-[.toaster]:text-[10px]",
          description: "group-[.toast]:text-zinc-500",
          actionButton: "group-[.toast]:bg-red-600 group-[.toast]:text-white group-[.toast]:rounded-none group-[.toast]:font-bold",
          cancelButton: "group-[.toast]:bg-zinc-800 group-[.toast]:text-white group-[.toast]:rounded-none",
          success: "group-[.toaster]:border-green-900 group-[.toaster]:bg-black",
          error: "group-[.toaster]:border-red-900 group-[.toaster]:bg-black",
          info: "group-[.toaster]:border-blue-900 group-[.toaster]:bg-black",
          warning: "group-[.toaster]:border-amber-900 group-[.toaster]:bg-black",
          loading: "group-[.toaster]:border-zinc-800 group-[.toaster]:bg-black",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
