import { cn } from "@/lib/utils";

/** Inline alert matching the portal's error/success banner styles. */
export function FormAlert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mb-3 rounded border px-2 py-1.5 text-meta",
        kind === "error" && "border-kengen-red/30 bg-red-50 text-kengen-red",
        kind === "success" &&
          "border-kengen-green/30 bg-[rgba(0,105,62,0.08)] text-kengen-green",
        kind === "info" && "border-kengen-blue/30 bg-blue-50 text-kengen-blue"
      )}
    >
      {children}
    </p>
  );
}
