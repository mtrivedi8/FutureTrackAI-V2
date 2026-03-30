import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

/**
 * Native <select> wrapper — triggers iOS native picker wheel.
 * options: string[] | { value: string, label: string }[]
 */
export default function NativeSelect({ value, onValueChange, options, placeholder, className }) {
  return (
    <div className="relative">
      <select
        value={value || ""}
        onChange={e => onValueChange(e.target.value)}
        className={cn(
          "w-full h-10 pl-3 pr-9 rounded-md border border-input bg-background text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer",
          className
        )}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => {
          const val = typeof opt === "string" ? opt : opt.value;
          const label = typeof opt === "string" ? opt : opt.label;
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    </div>
  );
}