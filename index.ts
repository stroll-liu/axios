const Axios = require('axios')
/**
   * 
   * @param { baseURL: 'https://api.***.com' } String 域名 必传参数
   * @param { url: '/getUserInfo' } String 请求路径 必传参数
   * @param { withCredentials: true | false } Boolean 是否允许携带凭证 可选参数 默认true
   * @param { method: 'get' | 'post' | 'put' | 'delete' | ... } String 请求方式 可选参数 默认get
   * @param { timeout: 3000 } Number 请求超时 单位毫秒 可选参数 默认3秒
   * @param { headers: {} } Json header体 可选参数 默认为空
   * @param { data: {} } Json|Number|String|Array body体 可选参数 默认为空
   * @param { params: {} } Json URL参数 可选参数 默认为空
   * @param { reqFn: (config) => {} } 函数 请求前拦截 参数config
   * @param { resFn: (response) => {} } 函数 响应后拦截 参数response
   * @param { res: (res) => {} } 函数 请求成功处理 回传参数res
   * @param { rej: (err) => {} } 函数 请求失败处理 回传参数err
   * @param { await: [{ method: 请求方式, url: 请求路径 }] } Array 需要同步的接口 方式为可选参数，路径为必传参数
  **/
export default class NewAxios {
  config: any
  lineUp: any
  errTimeout: any
  instance: any
  errorArr: Object[]
  antiShake: any[]
  constructor(config: any) {
    this.config = {
      method: 'get', // 请求方式
      timeout: 3000, // 请求时长
      antiShakeTime: null, // 防抖时间
      isAntiShake: true, // 是否防抖
      url:'', // 接口路由
      baseURL: '', // 基础请求地址
      prompt: true, // 是否打开报错提示（需要与message配合）
      withCredentials: false, // 是否允许携带凭证
      headers: {}, // header参数
      data: {}, // body体参数
      params: {}, // url参数
      message: null, // 错误处理（需打开prompt）
      reqFn: null, // 请求前拦截
      resFn:null, // 请求后拦截
      await: null, // 需等待的接口
    }
    this.lineUp = { switch: false, timeout: null, await: [], first: [], after: [] }
    this.errTimeout = null
    this.errorArr = []
    this.antiShake = []
    Object.assign(this.config, config)
    if (this.config.await && this.config.await.length) {
      this.config.switch = true
      this.config.await.forEach((item: any) => {
        const val = JSON.stringify(item)
        this.lineUp.await.push(val)
      })
    }

    this.interceptors()
  }

  async reset (options: any) {
    options && Object.assign(this.config, options)
  }

  async interceptors () { // 请求拦截
    return new Promise(res => {
      this.instance = Axios.create({})
      this.instance.interceptors.request.use(async (config: any) => {
        this.config.reqFn && await this.config.reqFn(config)
        return config
      }, (err: any) => Promise.reject(err))

      this.instance.interceptors.response.use(async (response: any) => {
        this.config.resFn && await this.config.resFn(response)
        return response
      }, (err: any) => {
        if (
          err.message.includes("timeout") ||
          err.message.includes("Network Error")
        ) {
          console.error(`网络异常，请重新尝试`)
          this.config.message && this.config.message({
            showClose: true,
            message: `网络异常，请重新尝试`,
            type: 'error'
          })
        }
        return Promise.reject(err)
      })
      res(true)
    }).catch(err => {
      console.log(err)
      return err
    })
  }

  errorHandling () {
    clearTimeout(this.errTimeout);
    this.errTimeout = setTimeout(() => {
      this.errorArr.forEach((item: any) => {
        if (item.type) {
          item.type = 0;
          this.config.message && this.config.message({
            showClose: true,
            message: item.val,
            type: 'error'
          })
        }
      });
      this.errorArr.length = 0
    }, 500)
  }

  getError (data: any, prompt: boolean | string) {
    if (data.code && prompt) {
      if (this.errorArr.length) {
        const isExists = this.errorArr.every(
          (item: any) => (item.val === data.message)
        )
        !isExists && this.errorArr.push({
          type: 1,
          val: data.message
        })
      } else {
        this.errorArr.push({
          type: 1,
          val: data.message
        })
      }
    }
  }

  clearAntiShake (tag: any) {
    this.config.isAntiShake && setTimeout(() => {
      delete this.antiShake[tag]
    }, this.config.antiShakeTime || this.config.timeout)
  }

  parade (obj: any) {
    const { method, url } = obj
    const tag = JSON.stringify({ method, url })
    if (this.lineUp.await.includes(url) || this.lineUp.await.includes(tag)) {
      this.lineUp.first.push(this.Request(obj))
    } else {
      this.lineUp.after.push(obj)
    }
    clearTimeout(this.lineUp.timeout)
    this.lineUp.timeout = setTimeout(() => {
      Promise.all(this.lineUp.first).then(() => {
        this.lineUp.after.forEach((params: any) => {
          this.Request(params)
        })
        this.lineUp.first.length = 0
        this.lineUp.after.length = 0
      }).catch(err => {
        console.log(err, {...err})
        this.lineUp.first.length = 0
        this.lineUp.after.length = 0
      })
      this.config.switch = false
    }, 500)
  }

  Request (obj: any) {
    obj = obj || {}
    const {
      url = this.config.url,
      method = this.config.method,
      timeout = this.config.timeout,
      baseURL = this.config.baseURL,
      prompt = this.config.prompt,
      withCredentials = this.config.withCredentials,
      headers = this.config.headers,
      data = this.config.data,
      params = this.config.params
    } = obj
    // if (this.lineUp.await.length && this.config.switch) {
    //   this.parade(obj)
    //   return
    // }
    const tag: any = JSON.stringify(obj)
    if (this.config.isAntiShake) {
      if (this.antiShake[tag]) {
        return Promise.reject({
          showClose: true,
          code: 3003,
          message: `重复请求: ${method} ${url}`,
          params: obj,
          type: 'error'
        })
      }
      this.antiShake[tag] = true
    }
    this.errorHandling()
    return new Promise((resolve, reject) => {
      this.instance({
        baseURL: baseURL,
        withCredentials: withCredentials,
        method: method,
        url: url,
        timeout: timeout,
        headers: headers, // header体
        data: data, // body参数
        params: params //  URL参数
      }).then((resData: any) => {
        this.getError(resData.data, prompt)
        this.clearAntiShake(tag)
        resolve(resData.data)
      }).catch((err: any) => {
        this.clearAntiShake(tag)
        reject(err)
        return err
      })
    })
  }

  GetByUrl(url: string, params: Object, prompt: boolean | string, timeout: number) {
    return this.Request({
      method: "get", // 请求方式
      url, // 请求路径
      timeout, // 请求超时
      prompt,
      params //  URL参数
    })
  }

  PostByUrl(url: string, params: Object, prompt: boolean | string, timeout: number) {
    return this.Request({
      method: "post", // 请求方式
      url, // 请求路径
      timeout, // 请求超时
      prompt,
      params //  URL参数
    })
  }
  
  GetByBody(url: string, data: Object, prompt: boolean | string, timeout: number) {
    return this.Request({
      method: "get", // 请求方式
      url, // 请求路径
      timeout, // 请求超时
      prompt,
      headers: {
        "content-type": "application/json"
      }, // header体
      data // body参数
    })
  }

  PostByBody(url: string, data: Object, prompt: boolean | string, timeout: number) {
    return this.Request({
      method: "post", // 请求方式
      url, // 请求路径
      timeout, // 请求超时
      prompt,
      headers: {
        "content-type": "application/json"
      }, // header体
      data // body参数
    })
  }
}
