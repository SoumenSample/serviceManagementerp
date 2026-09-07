import { Zap } from "lucide-react"

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return <Zap size={size} className={className} />
}
