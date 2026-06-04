import { Metadata } from "next"
import { StoreRegion } from "@medusajs/types"
import { listRegions } from "@lib/data/regions"
import { getCanonicalPath } from "@lib/util/seo"
import { Layout, LayoutColumn } from "@/components/Layout"

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Learn about our terms of use",
  alternates: {
    canonical: getCanonicalPath("/terms-of-use"),
  },
}
export async function generateStaticParams() {
  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions.flatMap((r) =>
      r.countries
        ? r.countries
            .map((c) => c.iso_2)
            .filter(
              (value): value is string =>
                typeof value === "string" && Boolean(value)
            )
        : []
    )
  )

  const staticParams = countryCodes.map((countryCode) => ({
    countryCode,
  }))

  return staticParams
}

export default function TermsOfUsePage() {
  return (
    <Layout className="pt-30 pb-20 md:pt-47 md:pb-32">
      <LayoutColumn
        start={{ base: 1, lg: 2, xl: 3 }}
        end={{ base: 13, lg: 11, xl: 10 }}
      >
        <h1 className="text-lg md:text-2xl mb-16 md:mb-25">
          Terms of Use for Your Next Hair
        </h1>
      </LayoutColumn>
      <LayoutColumn
        start={{ base: 1, lg: 2, xl: 3 }}
        end={{ base: 13, lg: 10, xl: 9 }}
        className="article"
      >
        <nav aria-labelledby="terms-contents" className="mb-12">
          <h2 id="terms-contents" className="text-md mb-4">
            On this page
          </h2>
          <ol className="list-decimal pl-5">
            <li><a href="#terms-content">Ownership of content</a></li>
            <li><a href="#terms-website-use">Use of the website</a></li>
            <li><a href="#terms-third-party">Third-party links and content</a></li>
            <li><a href="#terms-warranties">Disclaimer of warranties</a></li>
            <li><a href="#terms-liability">Limitation of liability</a></li>
            <li><a href="#terms-indemnification">Indemnification</a></li>
            <li><a href="#terms-modifications">Modifications to the terms</a></li>
            <li><a href="#terms-law">Governing law and jurisdiction</a></li>
          </ol>
        </nav>
        <p>
          Welcome to Your Next Hair. These Terms of Use govern your access to and
          use of our website, products, and services. By accessing or using our
          platform, you agree to be bound by these terms and conditions. If you
          do not agree with any part of these terms, please do not use our
          website.
        </p>
        <h2 id="terms-content">1. Ownership of Content</h2>
        <p>
          All content and materials on our website, including text, graphics,
          logos, images, videos, and trademarks, are the property of Your Next
          Hair or its licensors and are protected by intellectual property
          laws. You may not use, reproduce, modify, or distribute any of our
          content without our prior written permission.
        </p>
        <h2 id="terms-website-use">2. Use of the Website</h2>
        <ol>
          <li>
            Eligibility: You must be at least 16 years old to use our website.
            If you are under the age of 18, you should review these terms with a
            parent or guardian to ensure their understanding and agreement.
          </li>
          <li>
            User Account: Some features of our website may require you to create
            an account. You are responsible for maintaining the confidentiality
            of your account credentials and are solely responsible for any
            activity that occurs under your account.
          </li>
          <li>
            Prohibited Activities: You agree not to engage in any of the
            following activities:
            <ul>
              <li>Violating any applicable laws or regulations.</li>
              <li>
                Impersonating any person or entity or falsely representing your
                affiliation with any person or entity.
              </li>
              <li>
                Interfering with or disrupting the functionality of our website
                or servers.
              </li>
              <li>
                Uploading or transmitting any viruses, malware, or other
                malicious code.
              </li>
              <li>
                Collecting or harvesting any information from our website
                without our consent.
              </li>
            </ul>
          </li>
        </ol>
        <h2 id="terms-third-party">3. Third-Party Links and Content</h2>
        <p>
          Our website may contain links to third-party websites or display
          content from third parties. We do not endorse or control these
          third-party websites or content, and your use of them is at your own
          risk. We are not responsible for the accuracy, reliability, or
          legality of any third-party websites or content.
        </p>
        <h2 id="terms-warranties">4. Disclaimer of Warranties</h2>
        <p>
          Our website is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis. We do not make any warranties, express or
          implied, regarding the operation, availability, or accuracy of our
          website or the content therein. Your use of our website is at your
          sole risk.
        </p>
        <h2 id="terms-liability">5. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Your Next Hair and its
          affiliates, officers, directors, employees, and agents shall not be
          liable for any direct, indirect, incidental, consequential, or special
          damages arising out of or in connection with your use of our website,
          even if advised of the possibility of such damages.
        </p>
        <h2 id="terms-indemnification">6. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless Your Next Hair and its
          affiliates, officers, directors, employees, and agents from and
          against any claims, liabilities, damages, losses, and expenses,
          including reasonable attorney&apos;s fees, arising out of or in
          connection with your use of our website or violation of these Terms of
          Use.
        </p>
        <h2 id="terms-modifications">7. Modifications to the Terms</h2>
        <p>
          We may update these Terms of Use from time to time to reflect changes
          to our services, operations, or legal obligations. When we make
          material changes, we will post the updated terms on this page and
          update the effective date where applicable. Your continued use of the
          website after those changes take effect means you accept the revised
          terms.
        </p>
        <h2 id="terms-law">8. Governing Law and Jurisdiction</h2>
        <p>
          These Terms of Use shall be governed by and construed in accordance
          with applicable law. Any disputes arising out of or in connection
          with these terms shall be subject to the jurisdiction of the
          appropriate courts.
        </p>
      </LayoutColumn>
    </Layout>
  )
}
