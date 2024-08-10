/**
 * @File        : loadbalancer.js
 * @Version     : $Rev$
 * @Author      : 정재백
 * @History     : 2024-08-11 최초 작성
 * @Description : L7 웹부하분산서버
 **/
const http = require('http')
const { createProxyServer } = require('http-proxy')
const pm2apps = require('./ecosystem.config')

/** PING 체크 제한시간 */
const PING_TIME = 50
/** 비정상인경우 다음 PING 체크 시간 (30초) */
const NEXT_PING_INVALID = 1000 * 30
/** 정상인경우 다음 PING 체크 시간 (2초) */
const NEXT_PING_VALID = 1000 * 2
/** 정상여부 체크 시간간격 (5초) */
const HEARTBEAT_INTERVAL = 1000 * 5
/** http 요청 제한시간 */
const REQUEST_TIMEOUT = 3000
/** PING 체크용 컨텐츠 URI */
const PING_URI = pm2apps.apps[0].env.PING_URI
/** 인스턴스명 (노드 프로젝트명) */
const INSTANCE_NAME = pm2apps.apps[0].env.INSTANCE_NAME

/** 서버 포인터 (Round-Robin 형태) */
let svrinx = 0
/** 정상체크용 핸들러 */
let hndHeartbeat = null 

const proxy = createProxyServer({ })

/** 편집기에서 자동완성 사용을 위해 공스키마 작성후 삭제 */
const servers = [{
    target: '',
    alive: true,
    nextping: 0,
    proxy: proxy
}]
servers.splice(0, 1)

/** pm2 설정에 있는 서버 인스턴스대로 프록시 설정 작성 */
for (const itm of pm2apps.apps) {
  if (itm.name !== INSTANCE_NAME) { continue }
  const target = `http://localhost:${itm.env.PORT}`
  servers.push({
    target: target,
    alive: true,
    nextping: 0,
    proxy: proxy })
  console.log('CREATE-PROXY:', servers.length, itm.name, target)
  /** 서버 활성화를 위해 약 구동1초 정도 지난후 PING 수행 */
  setTimeout(() => ping(target, { timeout: 5000 }), 1000)
}

/** PING체크, HEAD 메소드로 접근하여 부담을 최소화 시킨다 */
function ping(target, opt) {
  return fetch (`${target}${PING_URI}`, {
    method: 'HEAD',
    keepalive: true,
    signal: AbortSignal.timeout(opt?.timeout || PING_TIME)
  })
}

/** 모든 서버의 주기걱 구동 정상 여부 모니터링 (백그라운드에서 에이전트로 실행됨) */
async function checkAlive() {
  if (hndHeartbeat) { clearTimeout(hndHeartbeat) }
  for (let svrinx = 0; svrinx < servers.length; svrinx++) {
    const curtime = new Date().getTime()
    const server = servers[svrinx]
    try {
      const res = await ping(server.target, { timeout: 1000 })
      if (res.status === 200) {
        serverValid(server, curtime)
      } else {
        serverInvalid(server, curtime)
      }
    } catch (e) {
      console.log('E:', svrinx)
      serverInvalid(server, curtime)
    }
  }
  console.log('CHECK-ALIVE..', servers.map((v, i) => v.alive))
  hndHeartbeat = setTimeout(checkAlive, HEARTBEAT_INTERVAL)
}
setTimeout(checkAlive, 2000)

/** 서버가 정상인 경우 셋팅 */
function serverValid(server, curtime) {
  server.alive = true
  server.nextping = curtime + NEXT_PING_VALID
  if (!server.proxy) { server.proxy = createProxyServer({}) }
}

/** 서버가 비정상인 경우 셋팅 */
function serverInvalid(server, curtime) {
  server.alive = false
  server.nextping = curtime + NEXT_PING_INVALID
  /** 프록시를 삭제하지 않으면 기존 프록시로 리퀘스트를 수행하여 HANG 에 걸린다 */
  server.proxy = undefined
}

/** 로드밸런싱 */
const loadbalancer = http.createServer(async (req, res) => {
  /** 서버 갯수만큼 retry 한다 */
  RETRY_LOOP: for (let retry = 0; retry < servers.length + 1; retry++) {
    const curtime = new Date().getTime()
    const server = servers[(svrinx = (svrinx + 1) % servers.length)]
    if (server.nextping == 0) { server.nextping = curtime }
    if (retry > 0) { console.log('SERVER:', svrinx, retry) }
    /** 서버가 죽어있고 ping 체크시간이 도래하지 않은경우 다음서버로 */
    if (!server.alive && server.nextping > curtime) { continue RETRY_LOOP }
    /** ping 체크시간이 지난경우 ping 수행 */
    if (server.nextping <= curtime) {
      try {
        const res = await ping(server.target)
        // console.log('PING:', svrinx, res.status, server.nextping, curtime)
        /** ping 체크 후 정상이 아닌경우 건너뜀 */
        if (res.status !== 200) {
          serverInvalid(server, curtime)
          continue RETRY_LOOP
        }
        serverValid(server, curtime)
      } catch (e) {
        console.log('E:', svrinx, retry)
        serverInvalid(server, curtime)
        continue RETRY_LOOP
      }
    }
    /** 서버 정상판단여부가 끝나면 Proxy 를 통해 본 Request 수행 */
    if (server.alive && server.proxy?.web) {
      req.rawHeaders['x-svrinx'] = svrinx
      server.proxy.web(req, res, { target: server.target, proxyTimeout: REQUEST_TIMEOUT, timeout: REQUEST_TIMEOUT })
      break RETRY_LOOP
    }
  }
})
/** 로드밸런싱 서버 설정 */
Object.assign(loadbalancer, {
  timeout: REQUEST_TIMEOUT,
  maxRequestsPerSocket: 1000,
  maxConnections: 1000,
  keepAliveTimeout: 1000 * 10,
  listenerCount: 1000
})

process.on('uncoughtException', (err) => {
  console.error('Uncought exception:', err)
})

/** 각 서버 인스턴스에서 Request 처리중 오류가 발생한 경우 */
proxy.on('error', (err, req, res) => {
  const curtime = new Date().getTime()
  const svrinx = req.rawHeaders['x-svrinx']
  serverInvalid(servers[svrinx], curtime)
  console.log('ERROR:', svrinx, err)
  res.writeHead(500, { 'Content-Type': 'application/json' })
  res.end('Internal Server Error')
})

const PORT = pm2apps.apps[0].env.PORT
loadbalancer.listen(PORT, () => { console.log(`Load Balancer running on port ${PORT}`) })