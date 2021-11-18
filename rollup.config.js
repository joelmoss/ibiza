import path from 'path'
import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import size from 'rollup-plugin-size'

const root = process.platform === 'win32' ? path.resolve('/') : '/'
const external = id => !id.startsWith('.') && !id.startsWith(root)
const extensions = ['.js', '.jsx']

const getBabelOptions = ({ useESModules }) => ({
  babelrc: false,
  extensions,
  exclude: '**/node_modules/**',
  babelHelpers: 'runtime',
  presets: [
    [
      '@babel/preset-env',
      {
        bugfixes: true,
        modules: false,
        targets: '> 1%, not dead, not ie 11, not op_mini all'
      }
    ],
    '@babel/preset-react'
  ],
  plugins: ['lodash', ['@babel/transform-runtime', { regenerator: false, useESModules }]]
})

export default [
  {
    input: `./index.js`,
    output: { file: `dist/index.js`, format: 'esm', sourcemap: 'external' },
    external,
    plugins: [
      babel(getBabelOptions({ useESModules: true })),
      resolve({ extensions }),
      terser({
        mangle: true,
        compress: true
      }),
      size()
    ]
  },
  {
    input: `./index.js`,
    output: { file: `dist/index.cjs`, format: 'cjs', sourcemap: 'external' },
    external,
    plugins: [
      babel(getBabelOptions({ useESModules: false })),
      resolve({ extensions }),
      terser({
        mangle: true,
        compress: true
      }),
      size()
    ]
  }
]
