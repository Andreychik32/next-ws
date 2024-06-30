import parser from '@babel/parser';
import type { ClassDeclaration, ClassMethod } from '@babel/types';
import generate from '@babel/generator';
import fs from 'node:fs';
import path from 'node:path';
import logger from '~/helpers/logger';
import { findWorkspaceRoot } from '~/helpers/workspace';
import template from '@babel/template';

const NextServerFilePath = path.join(
  findWorkspaceRoot(),
  'node_modules/next/dist/server/next-server.js',
);
const NextTypesFilePath = path.join(
  findWorkspaceRoot(),
  'node_modules/next/dist/build/webpack/plugins/next-types-plugin.js',
);

// Add `require('next-ws/server').setupWebSocketServer(this)` to the
// constructor of `NextNodeServer` in `next/dist/server/next-server.js`
export function patchNextNodeServer() {
  logger.info(
    'Adding WebSocket server setup script to NextNodeServer constructor...',
  );

  const content = fs.readFileSync(NextServerFilePath, 'utf8');
  if (content.includes('require("next-ws/server")')) return;

  const tree = parser.parse(content);

  const classDeclaration = tree.program.body.find(
    (n): n is ClassDeclaration =>
      n.type === 'ClassDeclaration' && n.id?.name === 'NextNodeServer',
  );
  if (!classDeclaration) return;

  const constructorMethod = classDeclaration.body.body.find(
    (n): n is ClassMethod =>
      n.type === 'ClassMethod' && n.kind === 'constructor',
  );
  if (!constructorMethod) return;

  const statement = template.statement
    .ast`require("next-ws/server").setupWebSocketServer(this)`;
  constructorMethod.body.body.push(statement);

  fs.writeFileSync(NextServerFilePath, generate(tree).code);
}

// Add `SOCKET?: Function` to the page module interface check field thing in
// `next/dist/build/webpack/plugins/next-types-plugin.js`
export function patchNextTypesPlugin() {
  logger.info("Adding 'SOCKET' to the page module interface type...");

  let content = fs.readFileSync(NextTypesFilePath, 'utf8');
  if (content.includes('SOCKET?: Function')) return;

  const toFind = '.map((method)=>`${method}?: Function`).join("\\n  ")';
  const replaceWith = `${toFind} + "; SOCKET?: Function"`;
  content = content.replace(toFind, replaceWith);

  fs.writeFileSync(NextTypesFilePath, content);
}

export default Object.assign(
  () => {
    patchNextNodeServer();
    patchNextTypesPlugin();
  },
  {
    date: '2023-06-16' as const,
    supported: '>=13.1.1 <=13.4.8' as const,
  },
);
