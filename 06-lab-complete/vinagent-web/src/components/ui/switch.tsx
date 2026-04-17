import { InputHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <label className="inline-flex items-center cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        className="sr-only peer"
        onChange={(e) => {
          onCheckedChange?.(e.target.checked)
          props.onChange?.(e)
        }}
        {...props}
      />
      <div className={cn(
        "relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary",
        className
      )} />
    </label>
  )
)
Switch.displayName = "Switch"

export { Switch }
