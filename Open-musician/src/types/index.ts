export type PluginFormat = 'jsfx' | 'wasm' | 'native'

export type BrowserItem = {
  id: string
  name: string
  category: 'sample' | 'preset' | 'midi'
  tags: string[]
}
