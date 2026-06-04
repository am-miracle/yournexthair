import { Metadata } from "next"
import { StoreRegion } from "@medusajs/types"
import { listRegions } from "@lib/data/regions"
import { getCanonicalPath } from "@lib/util/seo"
import { Layout, LayoutColumn } from "@/components/Layout"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how we protect your privacy",
  alternates: {
    canonical: getCanonicalPath("/privacy-policy"),
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

export default function PrivacyPolicyPage() {
  return (
    <Layout className="pt-30 pb-20 md:pt-47 md:pb-32">
      <LayoutColumn
        start={{ base: 1, lg: 2, xl: 3 }}
        end={{ base: 13, lg: 11, xl: 10 }}
      >
        <h1 className="text-lg md:text-2xl mb-16 md:mb-25">
          Privacy Policy for Your Next Hair
        </h1>
      </LayoutColumn>
      <LayoutColumn
        start={{ base: 1, lg: 2, xl: 3 }}
        end={{ base: 13, lg: 10, xl: 9 }}
        className="article"
      >
        <nav aria-labelledby="privacy-contents" className="mb-12">
          <h2 id="privacy-contents" className="text-md mb-4">
            On this page
          </h2>
          <ol className="list-decimal pl-5">
            <li><a href="#privacy-information-collected">Information we collect</a></li>
            <li><a href="#privacy-use">How we use your information</a></li>
            <li><a href="#privacy-cookies">Cookies and similar technologies</a></li>
            <li><a href="#privacy-sharing">Data sharing and disclosure</a></li>
            <li><a href="#privacy-security">Data security</a></li>
            <li><a href="#privacy-choices">Your choices</a></li>
            <li><a href="#privacy-children">Children&apos;s privacy</a></li>
            <li><a href="#privacy-changes">Changes to this privacy policy</a></li>
            <li><a href="#privacy-contact">Contact us</a></li>
          </ol>
        </nav>
        <p>
          At Your Next Hair, we value your privacy and are committed to protecting
          your personal information. This Privacy Policy outlines how we
          collect, use, disclose, and safeguard your data when you interact with
          our website, services, and products. By using our platform, you
          consent to the practices described in this policy.
        </p>
        <h2 id="privacy-information-collected">1. Information We Collect</h2>
        <p>
          We may collect personal information you provide directly to us, such
          as:
        </p>
        <ul>
          <li>
            Name, email address, and contact details when you sign up for an
            account.
          </li>
          <li>Billing and shipping addresses when you make a purchase.</li>
          <li>
            Payment information (credit/debit card details) for completing
            transactions securely.
          </li>
          <li>Personal preferences and fashion interests you share with us.</li>
        </ul>
        <p>
          Additionally, we may automatically collect certain information when
          you access or use our website, including:
        </p>
        <ul>
          <li>
            IP address, browser type, operating system, and device information.
          </li>
          <li>
            Usage data, such as pages visited, time spent on our platform, and
            referring website.
          </li>
        </ul>
        <h2 id="privacy-use">2. How We Use Your Information</h2>
        <p>
          We may use your personal information for various purposes, including
          but not limited to:
        </p>
        <ul>
          <li>Providing and managing your account, purchases, and orders.</li>
          <li>
            Customizing your shopping experience and suggesting relevant
            products.
          </li>
          <li>
            Sending you updates, newsletters, and marketing communications (you
            can opt-out anytime).
          </li>
          <li>Analyzing user behavior to improve our website and services.</li>
          <li>
            Complying with legal obligations and enforcing our Terms of Service.
          </li>
        </ul>
        <h2 id="privacy-cookies">3. Cookies and Similar Technologies</h2>
        <p>
          We use cookies and similar technologies to collect information about
          your browsing activity on our website. These technologies help us
          analyze usage patterns and enhance user experience. You can manage
          your cookie preferences through your browser settings.
        </p>
        <h2 id="privacy-sharing">4. Data Sharing and Disclosure</h2>
        <p>
          We may share your personal information with third parties under
          certain circumstances, including:
        </p>
        <ul>
          <li>
            Service providers who assist us in operating our business and
            delivering services.
          </li>
          <li>Legal authorities or government agencies as required by law.</li>
        </ul>
        <p>
          We do not sell or rent your personal information to third parties for
          their marketing purposes.
        </p>
        <h2 id="privacy-security">5. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your personal
          information from unauthorized access, alteration, or disclosure.
          However, no method of transmission over the internet or electronic
          storage is completely secure.
        </p>
        <h2 id="privacy-choices">6. Your Choices</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            Review and update your personal information in your account
            settings.
          </li>
          <li>Opt-out of receiving marketing communications.</li>
          <li>
            Delete your account (subject to applicable laws and regulations).
          </li>
        </ul>
        <h2 id="privacy-children">7. Children&apos;s Privacy</h2>
        <p>
          Our services are not intended for individuals under the age of 16. If
          we become aware that we have collected personal information from
          children without parental consent, we will take prompt action to
          delete such data.
        </p>
        <h2 id="privacy-changes">8. Changes to this Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices or for other operational, legal, or regulatory
          reasons. We will notify you of any material changes via email or by
          prominently posting a notice on our website.
        </p>
        <h2 id="privacy-contact">9. Contact Us</h2>
        <p>
          If you have any questions, concerns, or requests regarding this
          Privacy Policy or how we handle your personal information, please
          contact us at:
        </p>
        <address className="not-italic">
          <p>Email: <a href="mailto:judemiraco0@gmail.com">judemiraco0@gmail.com</a></p>
          <p>
            WhatsApp:{" "}
            <a
              href="https://api.whatsapp.com/send?phone=2348156197614"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Your Next Hair on WhatsApp (opens in a new tab)"
            >
              +234 815 619 7614
            </a>
          </p>
          <p>Location: Port Harcourt, Rivers State, Nigeria</p>
        </address>
      </LayoutColumn>
    </Layout>
  )
}
