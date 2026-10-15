import { useEffect, useRef, useState } from 'react'
import InfoPage from './InfoPage'

// Story images in public/, in page order (file names contain spaces, so the
// paths are URL-encoded). width/height reserve the space before each loads.
const STORY_PICS = [
  { src: '/story%20pic1.jpg', width: 726, height: 510, alt: 'A tired architecture student at a desk covered in drawings' },
  { src: '/story%20pic2.png', width: 1672, height: 941, alt: 'ArchiGrads: high-quality architectural assets for students without expensive prices' },
  { src: '/story%20pic3.png', width: 1672, height: 941, alt: 'More than just an asset website: create, save, organise and share graphics' },
  { src: '/story%20pic4.png', width: 1536, height: 1024, alt: 'Stop searching, start designing: the ArchiGrads library on a laptop' },
  { src: '/story%20pic5.png', width: 1536, height: 1024, alt: 'Architecture asset packs available as a one-time purchase' },
  { src: '/story%20pic6.png', width: 1536, height: 1024, alt: 'Assets from different sources brought together in one ArchiGrads library' },
  { src: '/story%20pic7.png', width: 1672, height: 941, alt: 'Our goal: quality-checked assets, organised categories, better previews and curated collections' },
  // Survey slides (indices 7-11 = pic8-pic12); pic12 follows pic7; the rest read pic11, pic10, pic9, pic8.
  { src: '/story%20pic8.jpg', width: 1716, height: 910, alt: 'Additional user feedback: more content, easier to use, and flexible access with affordable student pricing' },
  { src: '/story%20pic9.jpg', width: 1705, height: 907, alt: 'What the survey tells us: 91.7% core demand for 3D families, 83.3% have paid for assets before, 100% future interest' },
  { src: '/story%20pic10.jpg', width: 1713, height: 913, alt: 'Which assets do they use? Bar chart of 12 responses: 3D families are the most used, by 11 of 12 respondents' },
  { src: '/story%20pic11.jpg', width: 1707, height: 911, alt: 'Who answered the survey? Pie chart: 10 of 12 respondents (83.3%) are architecture students' },
  { src: '/story%20pic12.png', width: 1672, height: 941, alt: 'We did not just design a website, we asked users: 10 of 12 architecture students, 10 of 12 previously paid for assets, 12 of 12 rated likelihood 4 or 5' },
]

// Text, images and the video all sit in one column (InfoPage, max-w-4xl) and
// span its full width, so their left and right edges line up exactly.
const MEDIA = 'h-auto w-full rounded-none object-cover'

// Vertical rhythm: paragraphs are 24 px apart (InfoPage's space-y-6); every
// media item gets 48 px above and below (margins collapse, so two media items
// in a row are also 48 px apart).
const MEDIA_SPACING = 'my-12'

function StoryPic({ pic, className = `${MEDIA} ${MEDIA_SPACING}` }) {
  return (
    <img
      src={pic.src}
      alt={pic.alt}
      width={pic.width}
      height={pic.height}
      loading="lazy"
      decoding="async"
      className={className}
    />
  )
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

/**
 * The story video: silent, looping and control-free on the page, with an
 * "Introduction" label and a [ FULLSCREEN ] button. Clicking the video or the
 * button opens it fullscreen with sound and native controls (so it can be
 * paused); leaving fullscreen restores the clean, muted loop.
 */
function StoryVideo() {
  const videoRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const sync = () => {
      const active = fullscreenElement() === video || Boolean(video?.webkitDisplayingFullscreen)
      setIsFullscreen(active)
      if (video && !active) video.muted = true
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    // iOS Safari fullscreens the <video> itself and fires these on the element.
    video?.addEventListener('webkitbeginfullscreen', sync)
    video?.addEventListener('webkitendfullscreen', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
      video?.removeEventListener('webkitbeginfullscreen', sync)
      video?.removeEventListener('webkitendfullscreen', sync)
    }
  }, [])

  const openFullscreen = () => {
    const video = videoRef.current
    if (!video || fullscreenElement()) return
    video.muted = false
    video.play().catch(() => {})
    if (video.requestFullscreen) video.requestFullscreen().catch(() => {})
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen()
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen() // iOS Safari
  }

  return (
    <div className={`video-container group relative flex w-full ${MEDIA_SPACING}`}>
      <video
        ref={videoRef}
        src="/story%20video.mp4"
        width={1920}
        height={1080}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        controls={isFullscreen}
        onClick={isFullscreen ? undefined : openFullscreen}
        aria-label="ArchiGrads story video"
        className={`${MEDIA} ${isFullscreen ? '' : 'cursor-pointer'}`}
      />
      <span className="pointer-events-none absolute left-4 top-4 z-10 border border-transparent bg-neutral-900 px-3 py-1 text-xs font-bold uppercase tracking-widest text-neutral-50 md:text-sm dark:bg-neutral-50 dark:text-neutral-900">
        Introduction
      </span>
      <button
        type="button"
        onClick={openFullscreen}
        aria-label="Play the story video fullscreen"
        className="absolute bottom-4 right-4 z-10 border border-neutral-50 bg-neutral-900/80 px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest text-neutral-50 transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:bg-neutral-50 focus-visible:text-neutral-900 focus-visible:outline-none md:text-sm"
      >
        [ Fullscreen ]
      </button>
    </div>
  )
}

/** /about: the brand story (text supplied by the ArchiGrads team). */
export default function AboutPage({ onBack }) {
  return (
    <InfoPage eyebrow="About us" title="Our Brand Story – ArchiGrads" onBack={onBack} width="max-w-4xl">
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
      <StoryPic pic={STORY_PICS[0]} />
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

      {/* Story media, in the same column as the text. Text will be added
          between the items (see the placeholder comments). */}
      <StoryPic pic={STORY_PICS[1]} />
      {/* Text goes here */}
      <StoryPic pic={STORY_PICS[2]} />
      {/* Text goes here */}
      <StoryPic pic={STORY_PICS[3]} />
      {/* Text goes here */}
      <StoryVideo />
      {/* Text goes here */}
      <StoryPic pic={STORY_PICS[4]} />
      <p>
        ArchiGrads operates through a <strong>one-time purchase model</strong>, where customers pay for individual
        architectural assets or asset bundles without needing a subscription.
      </p>
      <p>
        We aim to provide high-quality resources at affordable prices, particularly for architecture students. Selected
        products will also have promotional discounts to encourage more purchases.
      </p>
      <StoryPic pic={STORY_PICS[5]} />
      <p>
        One of our strategies is to source affordable architectural resources from online marketplaces such as Taobao,
        where digital assets can be purchased at very low prices.
      </p>
      <p>
        For example, a collection of approximately <strong>200 CAD drawings may cost as little as AUD $2</strong>.
      </p>
      <p>
        Before offering third-party resources on ArchiGrads, we will verify that their licences permit commercial
        redistribution.
      </p>
      <p>
        Our profit will come from selling architectural assets at prices higher than our sourcing and preparation costs,
        while keeping them affordable for students.
      </p>
      <p>
        By combining low sourcing costs, efficient asset organisation and occasional promotional discounts, we aim to
        develop a sustainable business that benefits both ArchiGrads and its customers.
      </p>
      <StoryPic pic={STORY_PICS[6]} />
      <StoryPic pic={STORY_PICS[11]} />
      {/* Text goes here */}
      {/* What students told us: the survey, from who answered to what they asked for. */}
      <StoryPic pic={STORY_PICS[10]} />
      <StoryPic pic={STORY_PICS[9]} />
      <StoryPic pic={STORY_PICS[8]} />
      <StoryPic pic={STORY_PICS[7]} />
    </InfoPage>
  )
}
