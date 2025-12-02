import EventEmitter from './EventEmitter'

class Store extends EventEmitter {
  constructor () {
    super()
    this.defaultRPC = [{ name: 'ARIA2 RPC', url: 'http://localhost:6800/jsonrpc' }]
    this.defaultUserAgent = 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36 115Browser/5.1.3'
    this.defaultReferer = 'https://115.com/'
    this.defaultConfigData = {
      rpcList: this.defaultRPC,
      configSync: false,
      sha1Check: false,
      vip: true,
      small: false,
      interval: 300,
      downloadPath: '',
      userAgent: this.defaultUserAgent,
      browserUserAgent: true,
      referer: this.defaultReferer,
      headers: ''
      ,
      // 默认过滤关键词，换行分隔
      filterKeywords: '推广\n广告\npromo\npromotion\n网址\nurl\nwebsite\nsite\n更多\nmore\n最新\nlatest\n下载\ndownload\ntorrent\n点击\nclick\n访问\nvisit\n地址\naddress\nlink\n必看\nreadme\n说明\ninfo\ninformation\n福利\n资源\n分享\n赌场\n娱乐城\n澳门\n银河\n注册免费\n免费送\n可提款\n提款\n聊天室\n裸聊\n直播\n美女荷官'
    }
    this.configData = {}
    this.on('initConfigData', this.init.bind(this))
    this.on('setConfigData', this.set.bind(this))
    this.on('clearConfigData', this.clear.bind(this))
  }

  init () {
    chrome.storage.sync.get(null, (items) => {
      for (const key in items) {
        chrome.storage.local.set({ key: items[key] }, () => {
          console.log('chrome first local set: %s, %s', key, items[key])
        })
      }
    })
    chrome.storage.local.get(null, (items) => {
      this.configData = Object.assign({}, this.defaultConfigData, items)
      this.trigger('updateView', this.configData)
    })
  }

  getConfigData (key = null) {
    if (key) {
      return this.configData[key]
    } else {
      return this.configData
    }
  }

  set (configData) {
    this.configData = configData
    this.save(configData)
    this.trigger('updateView', configData)
  }

  save (configData) {
    for (const key in configData) {
      chrome.storage.local.set({ [key]: configData[key] }, () => {
        console.log('chrome local set: %s, %s', key, configData[key])
      })
      if (configData.configSync === true) {
        chrome.storage.sync.set({ [key]: configData[key] }, () => {
          console.log('chrome sync set: %s, %s', key, configData[key])
        })
      }
    }
  }

  clear () {
    chrome.storage.sync.clear()
    chrome.storage.local.clear()
    this.configData = this.defaultConfigData
    this.trigger('updateView', this.configData)
  }
}

export default new Store()
