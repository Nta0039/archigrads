import InfoPage from './InfoPage'
import { CONTACT_URL } from './Footer'

/** /privacy: what ArchiGrads collects, why, and who processes it. */
export default function PrivacyPage({ onBack }) {
  return (
    <InfoPage eyebrow="Legal" title="Privacy Policy" updated="12 October 2026" onBack={onBack}>
      <p>
        This Privacy Policy explains what information ArchiGrads ("we", "us") collects when you use our website, asset
        library and AI Studio, how we use it, and the choices you have. We handle personal information in line with the
        Australian Privacy Principles in the Privacy Act 1988 (Cth).
      </p>

      <h2>1. The short version</h2>
      <ul>
        <li>You can browse and download free assets without giving us any personal information.</li>
        <li>We do not use advertising, analytics or tracking cookies.</li>
        <li>Payments are handled by Stripe; we never see or store your card details.</li>
        <li>We do not sell your personal information.</li>
      </ul>

      <h2>2. Information we collect</h2>
      <p>
        <strong>When you buy an asset.</strong> Stripe collects your payment details and email address to process the
        payment and send your receipt. From Stripe we receive the purchase details we need to deliver your files: what
        you bought, the amount paid, whether the payment succeeded, and the email address you entered.
      </p>
      <p>
        <strong>When you use AI Studio.</strong> The description you type, and the style options you choose, are sent to
        our AI image providers to generate your images. If you publish a result, its title and image are stored in our
        library and shown publicly.
      </p>
      <p>
        <strong>When you contact us.</strong> If you message us on Instagram or answer our optional feedback survey (a
        Google Form), we receive whatever you choose to send.
      </p>
      <p>
        <strong>Technical information.</strong> Like most websites, our hosting provider automatically records basic
        request information, such as IP address, browser type and the pages requested, to operate and secure the site.
      </p>

      <h2>3. Information stored in your browser</h2>
      <p>
        Instead of tracking cookies, the site keeps a few small settings in your own browser's storage. They stay on your
        device and are not sent to us:
      </p>
      <ul>
        <li>your light or dark theme choice;</li>
        <li>your cookie-notice choice, so the notice is not shown again;</li>
        <li>assets you "Save to Library";</li>
        <li>the demonstration sign-in, which lasts only until you close the tab;</li>
        <li>whether the post-purchase survey has already been offered; and</li>
        <li>a record of purchases made in that browser (title, amount and receipt email), used by the site's demo dashboard.</li>
      </ul>
      <p>You can clear these at any time in your browser settings.</p>

      <h2>4. How we use information</h2>
      <ul>
        <li>to process purchases and deliver the files you paid for;</li>
        <li>to generate and, if you choose, publish AI Studio images;</li>
        <li>to answer your messages and handle refunds or problems with a file;</li>
        <li>to keep the Service secure and prevent misuse; and</li>
        <li>to improve the Service, using feedback you choose to give.</li>
      </ul>

      <h2>5. Service providers</h2>
      <p>We rely on trusted providers, which process information on our behalf or under their own privacy policies:</p>
      <ul>
        <li>
          <strong>Stripe</strong>: payment processing and receipts;
        </li>
        <li>
          <strong>Supabase</strong>: storage of the asset library and files;
        </li>
        <li>
          <strong>Vercel</strong>: website hosting;
        </li>
        <li>
          <strong>Fal.ai and Replicate</strong>: AI image generation in AI Studio;
        </li>
        <li>
          <strong>Google</strong>: website fonts and the optional feedback survey; and
        </li>
        <li>
          <strong>Instagram (Meta)</strong>: if you contact us there.
        </li>
      </ul>
      <p>
        Some of these providers store or process information outside Australia, including in the United States. We do
        not share your personal information with anyone else unless the law requires it.
      </p>

      <h2>6. Keeping information</h2>
      <p>
        We keep purchase records for as long as needed to provide your downloads, handle refunds and meet legal and tax
        obligations. Published AI Studio assets stay in the library until they are removed.
      </p>

      <h2>7. Your choices and rights</h2>
      <p>
        You can ask to access or correct the personal information we hold about you, or ask us to remove an AI Studio
        asset you published. If you are unhappy with how we have handled your information, contact us first; you may
        also complain to the Office of the Australian Information Commissioner (OAIC).
      </p>

      <h2>8. Children</h2>
      <p>
        The Service is designed for university students and other adults. If you are under 18, please use the Service
        with a parent's or guardian's permission, especially before making a purchase.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The date at the top of this page shows when it last changed.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy questions or requests, message us on Instagram at{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
          @archi_grads
        </a>
        .
      </p>
    </InfoPage>
  )
}
