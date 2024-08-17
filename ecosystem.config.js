/**
 * @File        : ecosystem.config.js
 * @Version     : $Rev$
 * @Author      : 정재백
 * @History     : 2024-08-11 최초 작성
 * @Description : PM2 실행 설정 (다중 인스턴스 런처)
 **/
const dotenv = require('dotenv')
const { cpus } = require('os')
const apps = [ ]
dotenv.config({ path: `${__dirname}/env.properties` })
/** 다중 인스턴스로 실행시킬 node 서버 경로 (npm run build 가 수행된 경로) */
const path = process.env.INSTANCE_PATH || __dirname
/** 인스턴스 갯수 */
const instances = Number(process.env.INSTANCES || 3)
/** 인스턴스명 (노드 프로젝트명) */
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'node'
/** 실행시킬 프로파일 */
const PROFILE = process.env.PROFILE || 'local'
/** 실행시킬 포트번호 */
const PORT = Number(process.env.PORT || 3000)
/** PING 체크용 컨텐츠 URI */
const PING_URI = process.env.PING_URI || '/ping.html'
/** 리스너 갯수 */
const LISTENERS = process.env.LISTENERS || Math.ceil(cpus().length / 4.0) || 1

/**
 * 다음과 같이 '.env' 파일을 작성할 수 있다
 * PORT = 3000
 * PING_URI = /ping.html
 * PROFILE = local
 * INSTANCE_NAME = 'nextjs-app'
 * INSTANCE_PATH = '/project/nextapp'
 * INSTANCES = 3
 * LISTENERS = 2
 **/

/** 0번 인스턴스는 로드밸런서 */
apps.push({
  name: '##load-balancer##',
  cwd: __dirname,
  script: 'loadbalancer.js',
  instances: LISTENERS,
  increment_var : 'LBNO',
  args: '--max-old-space-size=8192',
  exec_mode: 'cluster',
  env: {
    PROFILE,
    INSTANCE_NAME,
    PING_URI,
    PORT,
    LBNO: 0
  }
})

for (let inx = 0; inx < instances; inx++) {
  apps.push({
    name: INSTANCE_NAME,
    cwd: path,
    script: 'npm',
    args: 'start',
    exec_mode: 'fork',
    env: {
      PROFILE,
      PORT: (PORT + 1 + inx),
      NODE_ENV: 'production',
    }
  })
}

module.exports = { apps }
