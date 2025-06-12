import type {MsfwConfig, MsfwContext} from '@msfw/cli/dist/types'
import path from 'path'

export default (context: MsfwContext): MsfwConfig => {
  return {
    devServer: {
      port: 3001,
    },
    webpack: {
      alias: {
        '@msfw/utils': path.resolve(__dirname, '../../packages/msfw-utils/src'),
        '@msfw/utils/*': path.resolve(__dirname, '../../packages/msfw-utils/src/*'),
        '@msfw/framework': path.resolve(__dirname, '../../packages/msfw-framework/src'),
        '@msfw/framework/*': path.resolve(__dirname, '../../packages/msfw-framework/src/*'),
      },
    },
  }
}
