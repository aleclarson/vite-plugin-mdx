import type { Processor, Transformer } from 'unified'
import type { Node } from 'unist'

const importRE = /^import ['"](.+)['"]$/
const mdxRE = /\.mdx?$/

export function remarkMdxImport({
  resolve,
  readFile,
  getCompiler
}: {
  resolve(id: string, importer?: string): Promise<string | undefined>
  readFile(filePath: string): Promise<string>
  getCompiler(filePath: string): Processor
}): () => Transformer {
  return () => async (ast, file) => {
    if (!isRootNode(ast)) return

    const imports = findMdxImports(ast)
    if (imports.length) {
      type Splice = [index: number, deleteCount: number, inserted: any[]]

      const splices = await Promise.all(
        imports.map(
          async ({ id, index }): Promise<Splice> => {
            const importedPath = await resolve(id, file.path)
            if (!importedPath) {
              // Strip unresolved imports.
              return [index, 1, []]
            }
            const importedFile = {
              path: importedPath,
              contents: await readFile(importedPath)
            }
            const compiler = getCompiler(importedPath)
            const ast = await compiler.run(
              compiler.parse(importedFile),
              importedFile
            )
            // Inject the AST of the imported markdown.
            return [index, 1, (ast as import('mdast').Root).children]
          }
        )
      )

      // Apply splices in reverse to ensure preceding indices are stable.
      let { children } = ast
      for (const [index, deleteCount, inserted] of splices.reverse())
        children = children
          .slice(0, index)
          .concat(inserted, children.slice(index + deleteCount))

      ast.children = children
    }
  }
}

interface ParsedImport {
  id: string
  node: Node
  index: number
}

function findMdxImports(ast: import('mdast').Root) {
  const imports: ParsedImport[] = []
  ast.children.forEach((node: Node, index) => {
    // "import" type is used by @mdx-js/mdx@2.0.0-next.8 and under
    if (node.type === 'mdxjsEsm' || node.type === 'import') {
      const id = importRE.exec(node.value as string)?.[1]
      if (id && mdxRE.test(id)) {
        imports.push({ id, node, index })
      }
    }
  })
  return imports
}

function isRootNode(node: Node): node is import('mdast').Root {
  return node.type === 'root'
}
