import type { Metadata } from "next"
import { Layout, LayoutColumn } from "@/components/Layout"
import { listStaticCountryCodes } from "@lib/data/regions"
import { getCanonicalPath } from "@lib/util/seo"

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Return eligibility and non-returnable items at YourNextHair.",
  alternates: { canonical: getCanonicalPath("/refund-policy") },
}

export async function generateStaticParams() {
  return (await listStaticCountryCodes()).map((countryCode) => ({ countryCode }))
}

export default function RefundPolicyPage() {
  return (
    <Layout className="pt-30 pb-20 md:pt-47 md:pb-32">
      <LayoutColumn start={{ base: 1, lg: 2, xl: 3 }} end={{ base: 13, lg: 11, xl: 10 }}>
        <h1 className="text-lg md:text-2xl mb-16 md:mb-25">Refund Policy for YourNextHair</h1>
      </LayoutColumn>
      <LayoutColumn start={{ base: 1, lg: 2, xl: 3 }} end={{ base: 13, lg: 10, xl: 9 }} className="article">
        <h2>1. Eligibility for Returns</h2>
        <p>We accept returns only under the following circumstances:</p>
        <ol>
          <li>The customer receives an incorrect item.</li>
          <li>The customer receives a damaged or defective item.</li>
          <li>The item delivered is significantly different from the item ordered.</li>
        </ol>
        <p>To be eligible for a return:</p>
        <ul>
          <li>The request must be submitted within <strong>48 hours of receipt of delivery</strong>.</li>
          <li>The item must be unused, unworn, unwashed, and in its original condition.</li>
          <li>Original packaging, tags, and accessories must be included.</li>
          <li>Proof of purchase and photographs of the item must be provided.</li>
        </ul>
        <h2>2. Non-Returnable Items</h2>
        <p>For hygiene and safety reasons, we do not accept returns or exchanges for:</p>
        <ul>
          <li>Wigs that have been worn, cut, styled, coloured, altered, or washed.</li>
          <li>Custom-made or personalised orders.</li>
          <li>Sale or clearance items unless defective.</li>
        </ul>
        <h2>3. Contact Us</h2>
        <p>
          To submit a return request, contact{" "}
          <a href="mailto:yournexthair@gmail.com">yournexthair@gmail.com</a>{" "}
          within 48 hours of receiving your delivery. Include your order number,
          proof of purchase, a description of the issue, and photographs of the item.
        </p>
      </LayoutColumn>
    </Layout>
  )
}
