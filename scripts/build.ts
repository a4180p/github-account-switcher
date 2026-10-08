import cpy from 'cpy'
import { deleteAsync } from 'del'
import fs from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Convert Chrome manifest V3 to Firefox manifest V2
async function buildFirefox() {
  const distFolder = join(__dirname, '../dist')
  const distFirefoxFolder = join(__dirname, '../dist_firefox')

  // copy dist folder to dist_firefox
  await deleteAsync(distFirefoxFolder)
  await cpy(`${distFolder}/**`, distFirefoxFolder)

  const manifestJson = await fs.readFile(join(distFirefoxFolder, 'manifest.json'), 'utf-8')
  let manifest: any
  try {
    manifest = JSON.parse(manifestJson)
  } catch (error) {
    throw new Error(`Invalid manifest.json in ${distFirefoxFolder}`, { cause: error })
  }
  const {
    action,
    background: { service_worker },
    web_accessible_resources,
    host_permissions,
    permissions,
    ...rest
  } = manifest

  const combinedPermissions = permissions
    .filter(
      (permission: string) =>
        permission !== 'declarativeNetRequest' && permission !== 'declarativeNetRequestFeedback',
    )
    .concat(['webRequestBlocking', ...host_permissions])

  const webAccessibleResources = web_accessible_resources.reduce((acc: string[], item: any) => {
    return acc.concat(item.resources)
  }, [])

  const firefoxManifest = {
    ...rest,
    manifest_version: 2,
    browser_specific_settings: {
      gecko: {
        id: 'github-account-switcher@a4180p.github.io',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['authenticationInfo', 'websiteContent'],
        },
      },
    },
    browser_action: action,
    background: {
      page: 'background.html',
    },
    web_accessible_resources: webAccessibleResources,
    permissions: combinedPermissions,
  }

  const backgroundHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${manifest.name} Background Page</title>
  </head>
  <body>
    <script src="${service_worker}" type="module"></script>
  </body>
</html>
`
  await fs.writeFile(join(distFirefoxFolder, 'background.html'), backgroundHtml)
  await fs.writeFile(
    join(distFirefoxFolder, 'manifest.json'),
    JSON.stringify(firefoxManifest, null, 2),
  )

  console.log('Firefox manifest built')
}

async function createZip(folder: string, target: string) {
  const source = join(__dirname, `../${folder}`)
  const destination = join(__dirname, `../release/${target}`)

  await deleteAsync(destination)

  const zip = new AdmZip()
  zip.addLocalFolder(source)
  zip.writeZip(destination)
}

function createFirefoxSourceZip() {
  const zip = new AdmZip()
  for (const folder of ['src', 'public', 'scripts']) {
    zip.addLocalFolder(join(__dirname, `../${folder}`), folder)
  }
  for (const file of [
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'vite.config.ts',
    'manifest.ts',
    'popup.html',
    'LICENSE',
    'README.md',
  ]) {
    zip.addLocalFile(join(__dirname, `../${file}`))
  }
  zip.addLocalFile(join(__dirname, '../docs/firefox-release.md'), 'docs')
  zip.writeZip(join(__dirname, '../release/firefox-source.zip'))
}

async function main() {
  await buildFirefox()
  await createZip('dist', 'chrome.zip')
  await createZip('dist_firefox', 'firefox.zip')
  await fs.copyFile(
    join(__dirname, '../release/firefox.zip'),
    join(__dirname, '../release/firefox-unsigned.xpi'),
  )
  createFirefoxSourceZip()
}

await main()
