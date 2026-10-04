import { nextTestSetup } from 'e2e-utils'
import { retry, waitForRedbox } from 'next-test-utils'
import path from 'path'

describe('monorepo editor links', () => {
  const { next } = nextTestSetup({
    files: __dirname,
    startCommand: process.env.IS_WEBPACK_TEST
      ? 'pnpm --dir apps/web dev --webpack'
      : 'pnpm --dir apps/web dev',
    env: {
      REACT_EDITOR: 'node ./record-editor.cjs',
    },
  })

  beforeEach(async () => {
    await next.patchFile('apps/web/opened-files.jsonl', '')
    await retry(async () => {
      expect((await next.fetch('/')).status).toBe(200)
    })
  })

  async function expectOpenedFile(file: string) {
    await retry(async () => {
      const opened = await next.readFile('apps/web/opened-files.jsonl')
      const [args] = opened
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(args).toEqual([path.join(next.testDir, file)])
    })
  }

  it.each([
    ['/build-error', 'apps/web/app/build-error/page.tsx'],
    ['/shared-build-error', 'packages/broken.tsx'],
    ['/runtime-error', 'apps/web/app/runtime-error/page.tsx'],
  ])('opens the source file for %s', async (route, file) => {
    const original = await next.readFile(file)
    if (route !== '/runtime-error') {
      await next.patchFile(file, `import './missing'\n${original}`)
    }
    let editorStatus: number | undefined
    const browser = await next.browser(route, {
      beforePageLoad(page) {
        page.on('response', (response) => {
          if (new URL(response.url()).pathname === '/__nextjs_launch-editor') {
            editorStatus = response.status()
          }
        })
      },
    })

    try {
      await waitForRedbox(browser)
      await browser
        .elementByCss('[data-with-open-in-editor-link-source-file]')
        .click()
      await retry(() => expect(editorStatus).toBe(204))
      await expectOpenedFile(file)
    } finally {
      await browser.close()
      await next.patchFile(file, original)
    }
  })

  it('opens app-relative links from the application directory', async () => {
    const params = new URLSearchParams({
      file: 'runtime-error/page.tsx',
      isAppRelativePath: '1',
    })
    const response = await next.fetch(`/__nextjs_launch-editor?${params}`)
    expect(response.status).toBe(204)
    await expectOpenedFile('apps/web/app/runtime-error/page.tsx')
  })
})
