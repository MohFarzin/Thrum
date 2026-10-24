type Props = { size?: number; className?: string }

/** Same mark as /logo.svg (pulse + heartbeat). */
export function BrandMark({ size = 28, className = '' }: Props) {
  return (
    <img
      className={className}
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      decoding="async"
    />
  )
}
