import InfoPage from './InfoPage'

/** /about: the brand story (text supplied by the ArchiGrads team). */
export default function AboutPage({ onBack }) {
  return (
    <InfoPage eyebrow="About us" title="Our Brand Story – ArchiGrads" onBack={onBack}>
      <p>
        As architecture students, we know how stressful deadlines can be. Between designing, modelling, rendering, and
        preparing presentations, finding good architectural resources shouldn&apos;t take up so much of our time or money.
      </p>
      <p>
        Yet it often does. Whether it&apos;s PNG trees, people, CAD blocks, Revit families or textures, high-quality
        resources can be expensive, and students often end up spending a lot of money or searching through different
        websites to find what they need.
      </p>
      <p>
        We believe that <strong>good-quality architectural assets shouldn't have to be expensive</strong>, especially
        for students who are already managing university expenses.
      </p>
      <p>
        That's why we created <strong>ArchiGrads</strong>.
      </p>
      <p>
        Our goal is simple:{' '}
        <strong>
          help students spend less, have more choices and access high-quality architectural resources at affordable
          prices.
        </strong>
      </p>
      <p>
        We want to bring a wide range of architectural assets together in one place, allowing students to explore more
        options without worrying too much about the cost.
      </p>
      <p>
        By offering free resources and affordable asset collections, we hope students can save both time and money while
        focusing more on their creativity and design work.
      </p>
      <p>
        <strong>At ArchiGrads, we believe students should have more choices, better quality and fewer costs.</strong>
      </p>

      <h2>Our Brand Tagline</h2>
      <p className="border-2 border-neutral-950 px-6 py-8 text-center text-2xl font-bold tracking-tight sm:text-3xl dark:border-white">
        <strong>Spend Less. Choose More. Design Better.</strong>
      </p>
    </InfoPage>
  )
}
