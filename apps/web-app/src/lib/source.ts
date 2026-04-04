import { docs } from '../../.source'
import { loader } from 'fumadocs-core/source'

const mdxSource = docs.toFumadocsSource()
// fumadocs-mdx 11.x returns files as a function; fumadocs-core expects an array
const files = (typeof mdxSource.files === 'function'
  ? (mdxSource.files as () => unknown[])()
  : mdxSource.files) as Parameters<typeof loader>[0]['source']['files']

export const source = loader({
  baseUrl: '/docs',
  source: { files },
})
