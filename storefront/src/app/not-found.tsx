import { Metadata } from "next"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedButtonLink, LocalizedLink } from "@/components/LocalizedLink"
import { Footer } from "@/components/Footer"
import { Header } from "@/components/Header"

export const metadata: Metadata = {
  title: "404",
  description: "Something went wrong",
}

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <div className="bg-[linear-gradient(180deg,#faf8f5_0%,#ffffff_55%,#f3eee7_100%)]">
        <Layout className="pt-30 pb-20 md:pt-47 md:pb-36">
          <LayoutColumn start={1} end={13}>
            <div className="overflow-hidden rounded-4xl border border-grayscale-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                <div className="border-b border-grayscale-200 bg-[#f5eee7] px-6 py-10 md:px-10 md:py-14 lg:border-b-0 lg:border-r">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-grayscale-500">
                    Error 404
                  </p>
                  <h1 className="max-w-[12ch] text-3xl leading-none text-black md:text-5xl">
                    Page not found
                  </h1>
                  <p className="mt-6 max-w-136 text-base leading-7 text-grayscale-600 md:text-lg">
                    The page you are looking for doesn&apos;t exist or an error occurred. Go back,
                    or head over to our home page.
                  </p>
                </div>
                <div className="flex flex-col justify-between px-6 py-10 md:px-10 md:py-14">
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-grayscale-500">
                      Keep browsing
                    </p>
                    <div className="mt-6 space-y-4">
                      <LocalizedButtonLink href="/" className="w-full md:w-auto">
                        Back to home
                      </LocalizedButtonLink>
                      <div>
                        <LocalizedLink
                          href="/store"
                          className="text-sm font-semibold uppercase tracking-[0.18em] text-black transition-colors hover:text-grayscale-500"
                        >
                          Continue shopping
                        </LocalizedLink>
                      </div>
                    </div>
                  </div>
                  <div className="mt-12 border-t border-grayscale-200 pt-6 text-sm text-grayscale-500">
                    If this happened from a saved link, the page may have moved or been removed.
                  </div>
                </div>
              </div>
            </div>
          </LayoutColumn>
        </Layout>
      </div>
      <Footer />
    </>
  )
}
