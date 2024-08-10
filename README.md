[TOC]

# 멀티 스레드 부하분산 노드 런처

## 1. 개요

nodejs 프로젝트를 운영에 적용시 multi-thread 로 실행 되도록 [pm2](https://pm2.keymetrics.io/) 설정과 간단한 `load-balancer` 를 포함한 실행기(런처) 작성

## 2. 준비 및 설정

- 프로젝트를 내려받은 후 `npm install` 을 실행한다

<!--[-------------------------------------------------------------------------->
```bash
$ git clone https://gitlab.ntiple.com/developers/loadbalance-node-launcher.git

Cloning into 'loadbalance-node-launcher'...
remote: Enumerating objects: 3, done.
remote: Counting objects: 100% (3/3), done.
remote: Compressing objects: 100% (2/2), done.
remote: Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (3/3), done.

$ cd loadbalance-node-launcher
$ npm install

added 142 packages, and audited 143 packages in 1s
14 packages are looking for funding
  run `npm fund` for details
found 0 vulnerabilities
```
<!--]-------------------------------------------------------------------------->

- `.env` 파일을 작성한다

<!--[-------------------------------------------------------------------------->
```bash
### 예제 파일. 프로젝트에 맞게 수정한다
PORT = 3000
PING_URI = /ping.html
PROFILE = local
INSTANCE_NAME = 'my-next-app'
INSTANCE_PATH = '/home/coder/documents/my-first-app/my-next-app'
INSTANCES = 3
```
<!--]-------------------------------------------------------------------------->


## 3. 구동 및 사용방법

- 이후 `npx pm2 start` 로 구동 가능하다 (`my-next-app` 이 여러개 스레드로 구동된 것을 확인 가능)

<!--[-------------------------------------------------------------------------->
```bash
$ npx pm2 start

[PM2] Spawning PM2 daemon with pm2_home=/home/coder/.pm2
[PM2] PM2 Successfully daemonized
[PM2][WARN] Applications ##load-balancer##, my-next-app, my-next-app, my-next-app not running, starting...
[PM2] App [##load-balancer##] launched (1 instances)
[PM2] App [my-next-app] launched (1 instances)
[PM2] App [my-next-app] launched (1 instances)
[PM2] App [my-next-app] launched (1 instances)
┌────┬──────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name                 │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼──────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0  │ ##load-balancer##    │ default     │ N/A     │ cluster │ 3175440  │ 0s     │ 0    │ online    │ 0%       │ 54.9mb   │ coder    │ disabled │
│ 1  │ my-next-app          │ default     │ N/A     │ cluster │ 3175441  │ 0s     │ 0    │ online    │ 0%       │ 54.0mb   │ coder    │ disabled │
│ 2  │ my-next-app          │ default     │ N/A     │ cluster │ 3175454  │ 0s     │ 0    │ online    │ 0%       │ 49.9mb   │ coder    │ disabled │
│ 3  │ my-next-app          │ default     │ N/A     │ cluster │ 3175460  │ 0s     │ 0    │ online    │ 0%       │ 47.0mb   │ coder    │ disabled │
└────┴──────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```
<!--]-------------------------------------------------------------------------->

- 구동 중단은 `npx pm2 kill` 명령으로 가능하다

<!--[-------------------------------------------------------------------------->
```bash
$ npx pm2 kill

[PM2] Applying action deleteProcessId on app [all](ids: [ 0, 1, 2, 3 ])
[PM2] [##load-balancer##](0) ✓
[PM2] [my-next-app](1) ✓
[PM2] [my-next-app](3) ✓
[PM2] [my-next-app](2) ✓
[PM2] [v] All Applications Stopped
[PM2] [v] PM2 Daemon Stopped
```
<!--]-------------------------------------------------------------------------->

- 로그 확인은 `npx pm2 log` 명령으로 가능하다

<!--[-------------------------------------------------------------------------->
```bash
$ npx pm2 log

[TAILING] Tailing last 15 lines for [all] processes (change the value with --lines option)
/home/coder/.pm2/pm2.log last 15 lines:
PM2        |   - Local:        http://localhost:3003
PM2        | 
PM2        |  ✓ Starting...

... 중략 ...

0|##load-b | CREATE-PROXY: 1 my-next-app http://localhost:3001
0|##load-b | CREATE-PROXY: 2 my-next-app http://localhost:3002
0|##load-b | CREATE-PROXY: 3 my-next-app http://localhost:3003
```
<!--]-------------------------------------------------------------------------->

- 구동후 `curl` 로 정상 작동 확인해 본다

<!--[-------------------------------------------------------------------------->
```bash
$curl --get 'http://localhost:3000'

<!DOCTYPE html><html class="light-mode"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width"/><meta name="next-head-count" content="2"/><meta http-equiv="cache-control" content="max-age=0"/><meta http-equiv="cache-control" content="no-cache"/><meta http-equiv="expires" content="0"/><meta http-equiv="expires" content="Tue, 01 Jan 1980 1:00:00 GMT"/><meta http-equiv="pragma" content="no-cache"/><script>window.globalThis = window;</script><link rel="preload" type="font/woff2" href="/assets/fonts/jal-onuel.woff" as="font"/><link rel="stylesheet" type="text/css" href="/assets/fonts/jal-onuel.css"/><meta name="revised" content="2024-08-11T02:04:30.196+09:00"/><style>
          body { transition: opacity 0.5s 0.2s ease }
          .hide-preload { opacity: 0; }
... 중략 ...
```
<!--]-------------------------------------------------------------------------->
