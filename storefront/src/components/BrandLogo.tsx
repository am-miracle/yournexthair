import Image from "next/image"

export function BrandLogo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/images/brand/yournexthair.svg"
      alt="YourNextHair"
      width={1528}
      height={880}
      className={className}
      unoptimized
    />
  )
}
