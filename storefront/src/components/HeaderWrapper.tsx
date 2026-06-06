"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useCountryCode } from "@/hooks/country-code"

export const HeaderWrapper: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const pathName = usePathname()
  const countryCode = useCountryCode()
  const currentPath = countryCode
    ? pathName.split(`/${countryCode}`)[1] ?? "/"
    : pathName
  const isPageWithHeroImage =
    !currentPath ||
    currentPath === "/" ||
    currentPath === "/about" ||
    currentPath === "/inspiration" ||
    currentPath === "/services" ||
    currentPath.startsWith("/collections")
  const isAlwaysSticky =
    currentPath.startsWith("/auth") || currentPath.startsWith("/account")

  React.useEffect(() => {
    if (isAlwaysSticky) {
      return
    }

    const headerElement = document.querySelector("#site-header")

    if (!headerElement) {
      return
    }

    const nextElement = headerElement.nextElementSibling
    if (!(nextElement instanceof HTMLElement)) {
      return
    }

    const sentinelElement = document.createElement("div")
    const originalPositionStyle = nextElement.style.position
    let currentStickyState: "true" | "false" | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null

    sentinelElement.setAttribute("aria-hidden", "true")
    sentinelElement.style.position = "absolute"
    sentinelElement.style.left = "0"
    sentinelElement.style.width = "1px"
    sentinelElement.style.height = "1px"
    sentinelElement.style.pointerEvents = "none"
    sentinelElement.style.opacity = "0"

    if (window.getComputedStyle(nextElement).position === "static") {
      nextElement.style.position = "relative"
    }

    nextElement.prepend(sentinelElement)

    const setStickyState = (isSticky: boolean) => {
      const nextStickyState = isSticky ? "true" : "false"

      if (currentStickyState === nextStickyState) {
        return
      }

      currentStickyState = nextStickyState
      headerElement.setAttribute("data-sticky", nextStickyState)
    }

    const getTriggerPosition = () => {
      if (isPageWithHeroImage) {
        return Math.max(nextElement.clientHeight - headerElement.clientHeight, 1)
      }

      return Math.max(
        Number.parseInt(window.getComputedStyle(nextElement).paddingTop, 10) -
          headerElement.clientHeight,
        1
      )
    }

    const syncStickyStateFromLayout = () => {
      const sentinelTop = sentinelElement.offsetTop
      setStickyState(window.scrollY > sentinelTop)
    }

    const observeStickyThreshold = () => {
      const triggerPosition = getTriggerPosition()

      sentinelElement.style.top = `${triggerPosition}px`

      intersectionObserver?.disconnect()
      intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0]

        if (!entry) {
          return
        }

        setStickyState(entry.boundingClientRect.top < 0 && !entry.isIntersecting)
      })
      intersectionObserver.observe(sentinelElement)
      syncStickyStateFromLayout()
    }

    const handleViewportChange = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        observeStickyThreshold()
      }, 50)
    }

    observeStickyThreshold()

    window.addEventListener("resize", handleViewportChange, { passive: true })
    window.addEventListener("orientationchange", handleViewportChange, {
      passive: true,
    })

    return () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      intersectionObserver?.disconnect()
      sentinelElement.remove()
      nextElement.style.position = originalPositionStyle

      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
    }
  }, [pathName, isPageWithHeroImage, isAlwaysSticky])

  return (
    <div
      id="site-header"
      className="fixed top-0 left-0 z-40 w-full border-b border-transparent bg-white/95 text-black backdrop-blur-md transition-[background-color,border-color,box-shadow,color] duration-300 md:bg-transparent md:backdrop-blur-none data-[light=true]:md:text-white data-[sticky=true]:border-grayscale-200 data-[sticky=true]:bg-white/95 data-[sticky=true]:text-black data-[sticky=true]:md:!text-black data-[sticky=true]:shadow-[0_8px_30px_rgba(0,0,0,0.06)] data-[sticky=true]:backdrop-blur-md group"
      data-light={isPageWithHeroImage}
      data-sticky={isAlwaysSticky}
    >
      {children}
    </div>
  )
}
