import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-9 w-9 rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-20 w-20 rounded-xl",
} as const;

const iconMap = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

// Imagen del producto o un ícono si no tiene.
export function ProductImage({ src, alt, size = "md", className }: Props) {
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden border border-border bg-primary-soft",
        sizeMap[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary">
          <ImageIcon className={iconMap[size]} />
        </div>
      )}
    </div>
  );
}
