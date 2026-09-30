import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, FileUp } from 'lucide-react'
import ThemeToggle from '../theme/ThemeToggle'

const ACCEPT = '.skp,.3dm,.obj,.SKP,.3DM,.OBJ'
const UPLOAD_LABEL = 'Uploading model geometry...'
const RENDER_LABEL = 'Allocating cloud GPU... Calculating raytraced ambient occlusion...'

/**
 * White Model Rendering page.
 *
 * This is intentionally a "Wizard of Oz" flow for live demos: no real upload or
 * render happens. Selecting a file runs a mocked 4-second progress bar that
 * moves through idle -> uploading -> rendering -> completed, then reveals a
 * pre-set render.
 */
export default function RenderPage({ onBack }) {
  const [processStatus, setProcessStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)

  // Mock loader: +2% every 80ms => 100% in 4 seconds.
  useEffect(() => {
    if (processStatus !== 'uploading' && processStatus !== 'rendering') return undefined
    const id = setInterval(() => {
      setProgress((current) => Math.min(100, current + 2))
    }, 80)
    return () => clearInterval(id)
  }, [processStatus])

  // Advance the state machine as progress crosses its thresholds.
  useEffect(() => {
    if (processStatus === 'uploading' && progress >= 30) {
      setProcessStatus('rendering')
    } else if (progress >= 100 && (processStatus === 'uploading' || processStatus === 'rendering')) {
      setProcessStatus('completed')
    }
  }, [progress, processStatus])

  const handleFiles = (files) => {
    if (!files || files.length === 0) return
    setProgress(0)
    setProcessStatus('uploading')
  }

  const handleReset = () => {
    setProgress(0)
    setProcessStatus('idle')
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = '/demo-render.jpg'
    link.download = 'archigrads-white-model-render.jpg'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const isBusy = processStatus === 'uploading' || processStatus === 'rendering'
  const progressLabel = progress < 30 ? UPLOAD_LABEL : RENDER_LABEL

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Back to Home
        </button>
        <ThemeToggle />
      </div>

      <main className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 lg:px-8">
        <header className="w-full max-w-2xl border-t border-neutral-200 dark:border-neutral-800 pt-12 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
            White Model Rendering
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Cloud rendering, handled.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400">
            Send us your model and we will return a crisp, diagram-ready white base render.
          </p>
        </header>

        <div className="mt-14 w-full max-w-3xl">
          {processStatus === 'idle' && (
            <div key="idle" className="fade-in">
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    inputRef.current?.click()
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  handleFiles(event.dataTransfer.files)
                }}
                className="flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-5 border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/60 px-8 text-center transition-colors hover:border-neutral-900 dark:hover:border-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <FileUp className="h-8 w-8 text-neutral-400 dark:text-neutral-500" strokeWidth={1.5} aria-hidden />
                <p className="max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Drag &amp; drop your .skp, .3dm, or .obj file here, or click to browse.
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
            </div>
          )}

          {isBusy && (
            <div key="busy" className="fade-in">
              <div className="border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                  <span>{processStatus === 'uploading' ? 'Uploading' : 'Rendering'}</span>
                  <span>{progress}%</span>
                </div>

                <div className="mt-4 h-1 w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full bg-neutral-900 dark:bg-neutral-100 transition-all duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <p className="mt-6 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{progressLabel}</p>
              </div>
            </div>
          )}

          {processStatus === 'completed' && (
            <div key="completed" className="fade-in">
              <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 p-4">
                <img
                  src="/demo-render.jpg"
                  alt="White model render"
                  className="w-full"
                  draggable={false}
                />
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-neutral-900 dark:bg-neutral-100 px-7 py-3.5 text-sm font-medium text-white dark:text-neutral-900 transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-300"
                >
                  <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  Download 4K Render
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 border border-neutral-300 dark:border-neutral-700 px-7 py-3.5 text-sm font-medium text-neutral-900 dark:text-neutral-100 transition-colors hover:border-neutral-900 dark:hover:border-neutral-100"
                >
                  Render Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
