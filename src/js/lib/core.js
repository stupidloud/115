import Store from './store'

class Core {
  constructor() {
    this.cookies = {}
  }

  httpSend({ url, options }, resolve, reject) {
    fetch(url, options).then((response) => {
      if (response.ok) {
        response.json().then((data) => {
          resolve(data)
        })
      } else {
        reject(response)
      }
    }).catch((err) => {
      reject(err)
    })
  }

  getConfigData(key = null) {
    return Store.getConfigData(key)
  }

  objectToQueryString(obj) {
    return Object.keys(obj).map((key) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`
    }).join('&')
  }

  sendToBackground(method, data, callback) {
    chrome.runtime.sendMessage({
      method,
      data
    }, callback)
  }

  showToast(message, type) {
    window.postMessage({ type: 'showToast', data: { message, type } }, location.origin)
  }

  getHashParameter(name) {
    const hash = window.location.hash
    const paramsString = hash.substr(1)
    const searchParams = new URLSearchParams(paramsString)
    return searchParams.get(name)
  }

  formatCookies() {
    const cookies = []
    for (const key in this.cookies) {
      cookies.push(`${key}=${this.cookies[key]}`)
    }
    return cookies.join('; ')
  }

  getHeader(type = 'RPC') {
    const headerOption = []
    const useBrowserUA = this.getConfigData('browserUserAgent')
    let userAgent = this.getConfigData('userAgent')
    if (useBrowserUA) {
      const browserUA = navigator.userAgent
      if (browserUA && browserUA.length) {
        userAgent = browserUA
      }
    }
    headerOption.push(`User-Agent: ${userAgent}`)
    headerOption.push(`Referer: ${this.getConfigData('referer')}`)
    headerOption.push(`Cookie: ${this.formatCookies()}`)
    const headers = this.getConfigData('headers')
    if (headers) {
      headers.split('\n').forEach((item) => {
        headerOption.push(item)
      })
    }
    if (type === 'RPC') {
      return headerOption
    } else if (type === 'aria2Cmd') {
      return headerOption.map(item => `--header ${JSON.stringify(item)}`).join(' ')
    } else if (type === 'aria2c') {
      return headerOption.map(item => ` header=${item}`).join('\n')
    } else if (type === 'idm') {
      return headerOption.map((item) => {
        const headers = item.split(': ')
        return `${headers[0]}: ${headers[1]}`
      }).join('\r\n')
    }
  }

  // 解析 RPC地址 返回验证数据 和地址
  parseURL(url) {
    const parseURL = new URL(url)
    let authStr = parseURL.username ? `${parseURL.username}:${decodeURI(parseURL.password)}` : null
    if (authStr) {
      if (!authStr.includes('token:')) {
        authStr = `Basic ${btoa(authStr)}`
      }
    }
    const paramsString = parseURL.hash.substr(1)
    const options = {}
    const searchParams = new URLSearchParams(paramsString)
    for (const searchParam of searchParams) {
      const [option, value] = searchParam
      options[option] = value.length ? value : 'enabled'
    }
    const path = parseURL.origin + parseURL.pathname
    return { authStr, path, options }
  }

  generateParameter(authStr, path, data) {
    if (authStr && authStr.startsWith('token')) {
      data.params.unshift(authStr)
    }
    const parameter = {
      url: path,
      options: {
        method: 'POST',
        headers: {},
        body: JSON.stringify(data)
      }
    }
    if (authStr && authStr.startsWith('Basic')) {
      parameter.options.headers.Authorization = authStr
    }
    return parameter
  }

  // get aria2 version
  getVersion(rpcPath, element) {
    const data = {
      jsonrpc: '2.0',
      method: 'aria2.getVersion',
      id: 1,
      params: []
    }
    const { authStr, path } = this.parseURL(rpcPath)
    this.sendToBackground('rpcVersion', this.generateParameter(authStr, path, data), (version) => {
      if (version) {
        element.innerText = `Aria2版本为: ${version}`
      } else {
        element.innerText = '错误,请查看是否开启Aria2'
      }
    })
  }

  copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('拷贝成功~', 'inf')
      }).catch(() => {
        this.showToast('拷贝失败 QAQ', 'err')
      })
    } else {
      this.showToast('拷贝失败 QAQ', 'err')
    }
  }

  // cookies format  [{"url": "http://pan.baidu.com/", "name": "BDUSS"},{"url": "http://pcs.baidu.com/", "name": "pcsett"}]
  requestCookies(cookies) {
    return new Promise((resolve) => {
      this.sendToBackground('getCookies', cookies, (value) => {
        resolve(value)
      })
    })
  }

  // 过滤BT资源中的推广文件
  filterPromotionFiles(fileDownloadInfo) {
    // 先过滤掉非视频格式的文件（直接生效）

    // 常见的推广文件扩展名
    const promotionExtensions = [
      '.url',      // URL快捷方式
      '.txt',      // 文本文件（通常是推广信息）
      '.html',     // 网页文件
      '.htm',      // 网页文件
      '.nfo',      // NFO信息文件
      '.diz',      // DIZ描述文件
      '.md',       // Markdown文件（可能是说明）
      '.lnk'       // Windows快捷方式
    ]

    // 常见的推广图片（通常很小）
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const maxImageSize = 100 * 1024 // 100KB以下的图片通常是推广图

    // 常见的推广文件名关键词（不区分大小写），使用简单 substring 匹配
    const promotionKeywords = [
      '推广', '广告', 'promo', 'promotion',
      '网址', 'url', 'website', 'site',
      '更多', 'more', '最新', 'latest',
      '下载', 'download', 'torrent',
      '点击', 'click', '访问', 'visit',
      '地址', 'address', 'link',
      '必看', 'readme', 'read me',
      '说明', 'info', 'information',
      '福利', '资源', '分享'
    ]
    // 简单子串匹配，关键词列表中已移除短词（如 ad, hd, free）以减少误判

    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.webm', '.rmvb', '.ts', '.m2ts', '.mpg', '.mpeg', '.3gp', '.divx', '.xvid', '.m4v', '.vob', '.asf']

    return fileDownloadInfo.filter((file) => {
      const fileName = (file.name || '').toLowerCase()
      const fileSize = Number(file.size || 0)

      // 0. 非视频扩展先过滤掉
      const matchesExt = fileName.match(/(\.[^.]+)$/)
      const ext = matchesExt ? matchesExt[1] : ''
      if (!videoExtensions.includes(ext)) {
        console.log(`[过滤] 非视频格式文件: ${file.name}`)
        return false
      }

      // 1. 过滤推广文件扩展名
      if (promotionExtensions.some(ext => fileName.endsWith(ext))) {
        console.log(`[过滤] 推广文件: ${file.name}`)
        return false
      }

      // 2. 过滤小图片文件（通常是推广图）
      if (imageExtensions.some(ext => fileName.endsWith(ext)) && fileSize < maxImageSize) {
        console.log(`[过滤] 推广图片: ${file.name} (${fileSize} bytes)`)
        return false
      }

      // 3. 过滤包含推广关键词的文件（简单 substring 检查）
      if (promotionKeywords.some(keyword => fileName.includes(keyword))) {
        console.log(`[过滤] 推广关键词: ${file.name}`)
        return false
      }

      // 保留其他文件
      return true
    })
  }

  aria2RPCMode(rpcPath, fileDownloadInfo) {
    const { authStr, path, options } = this.parseURL(rpcPath)
    const small = this.getConfigData('small')

    if (small) {
      fileDownloadInfo.sort((a, b) => a.size - b.size)
    }

    // 过滤BT资源中的推广文件
    const originalCount = fileDownloadInfo.length
    fileDownloadInfo = this.filterPromotionFiles(fileDownloadInfo)
    const filteredCount = originalCount - fileDownloadInfo.length

    if (filteredCount > 0) {
      this.showToast(`已过滤 ${filteredCount} 个推广文件，准备下载 ${fileDownloadInfo.length} 个文件`, 'inf')
    }

    fileDownloadInfo.forEach((file) => {
      this.cookies = file.cookies
      const rpcData = {
        jsonrpc: '2.0',
        method: 'aria2.addUri',
        id: new Date().getTime(),
        params: [
          [file.link], {
            out: file.name,
            header: this.getHeader()
          }
        ]
      }
      const sha1Check = this.getConfigData('sha1Check')
      const rpcOption = rpcData.params[1]
      const dir = this.getConfigData('downloadPath')
      if (dir) {
        rpcOption.dir = dir
      }
      if (sha1Check) {
        rpcOption.checksum = `sha-1=${file.sha1}`
      }
      if (options) {
        for (const key in options) {
          rpcOption[key] = options[key]
        }
      }
      this.sendToBackground('rpcData', this.generateParameter(authStr, path, rpcData), (success) => {
        if (success) {
          this.showToast('下载成功!赶紧去看看吧~', 'inf')
        } else {
          this.showToast('下载失败!是不是没有开启Aria2?', 'err')
        }
      })
    })
  }

  aria2TXTMode(fileDownloadInfo) {
    const aria2CmdTxt = []
    const aria2Txt = []
    const idmTxt = []
    const downloadLinkTxt = []
    const prefixTxt = 'data:text/plain;charset=utf-8,'

    // 过滤BT资源中的推广文件
    const originalCount = fileDownloadInfo.length
    fileDownloadInfo = this.filterPromotionFiles(fileDownloadInfo)
    const filteredCount = originalCount - fileDownloadInfo.length

    if (filteredCount > 0) {
      this.showToast(`已过滤 ${filteredCount} 个推广文件，准备导出 ${fileDownloadInfo.length} 个文件`, 'inf')
    }

    fileDownloadInfo.forEach((file) => {
      this.cookies = file.cookies
      let aria2CmdLine = `aria2c -c -s10 -k1M -x16 --enable-rpc=false -o ${JSON.stringify(file.name)} ${this.getHeader('aria2Cmd')} ${JSON.stringify(file.link)}`
      let aria2Line = [file.link, this.getHeader('aria2c'), ` out=${file.name}`].join('\n')
      const sha1Check = this.getConfigData('sha1Check')
      if (sha1Check) {
        aria2CmdLine += ` --checksum=sha-1=${file.sha1}`
        aria2Line += `\n checksum=sha-1=${file.sha1}`
      }
      aria2CmdTxt.push(aria2CmdLine)
      aria2Txt.push(aria2Line)
      const idmLine = ['<', file.link, this.getHeader('idm'), '>'].join('\r\n')
      idmTxt.push(idmLine)
      downloadLinkTxt.push(file.link)
    })
    document.querySelector('#aria2CmdTxt').value = `${aria2CmdTxt.join('\n')}`
    document.querySelector('#aria2Txt').href = `${prefixTxt}${encodeURIComponent(aria2Txt.join('\n'))}`
    document.querySelector('#idmTxt').href = `${prefixTxt}${encodeURIComponent(idmTxt.join('\r\n') + '\r\n')}`
    document.querySelector('#downloadLinkTxt').href = `${prefixTxt}${encodeURIComponent(downloadLinkTxt.join('\n'))}`
    document.querySelector('#copyDownloadLinkTxt').dataset.link = downloadLinkTxt.join('\n')
  }
}

export default new Core()
