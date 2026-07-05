import * as path from 'node:path'
import { CallExpression, Project, StringLiteral, SyntaxKind } from 'npm:ts-morph'

export function getUsages(targetMethodNames: string[], projectDirectory: string, fileWhitelist?: string[]) {
  const project = new Project({
    tsConfigFilePath: path.join(projectDirectory, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false // Important: ensure all files are added based on tsconfig
  })

  const usages: {
    firstStringArgument: string
    targetMethodName: string
    methodIdentifier?: string
  }[] = []

  // Iterate over all source files in the project
  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes('node_modules')) continue

    if (fileWhitelist && !fileWhitelist.some(file => sourceFile.getFilePath().endsWith(file))) continue

    for (const targetMethodName of targetMethodNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sourceFile.forEachDescendant((node: any) => {
        // We are looking for CallExpressions (i.e., function/method calls)
        if (node.isKind(SyntaxKind.CallExpression)) {
          const callExpression = node as CallExpression
          const expression = callExpression.getExpression()

          let methodIdentifier: string | undefined

          if (expression.isKind(SyntaxKind.Identifier)) {
            const identifier = expression
            if (identifier.getText() === targetMethodName) {
              methodIdentifier = identifier.getText()
            }
          }

          if (methodIdentifier) {
            const args = callExpression.getArguments()
            if (args.length > 0) {
              const firstArg = args[0]
              if (firstArg.isKind(SyntaxKind.StringLiteral)) {
                const stringLiteral = firstArg as StringLiteral
                usages.push({
                  firstStringArgument: stringLiteral.getLiteralText(),
                  methodIdentifier: stringLiteral?.getParent()?.getParent()?.getChildren()[0].getText(),
                  targetMethodName
                })
              }
            }
          }
        }
      })
    }
  }
  return usages
}
