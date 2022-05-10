/*
* import : built-ins
* */
const http = require('http');
const cluster = require('cluster');
const os = require('os');

/*
* 현재 서버의 CPU 갯수를 파악합니다.
* */
const numCPUs = os.cpus().length;

/*
* 현재 프로세스가 부모 프로세스인지, 자식 프로세스인지
* 여부에 따라 다른 동작을 수행하도록 분기처리 합니다.
* */
if (cluster.isMaster) {
  /*
  * 부모 프로세스일 경우에 실행할 코드 블록입니다.
  * */
  console.log('[master] started!');

  /*
  * 서버 CPU 코어 갯수만큼 자식 프로세스를 생성합니다.
  * */
  for (let i = 0 ; i < numCPUs ; i++) {
    cluster.fork();
  }

  /*
  * exit 이벤트 : 자식 프로세스의 종료 이벤트
  * 가 발생했을 때 실행할 동작을 정의합니다.
  * */
  cluster.on('exit',
    /**
     * 자식 프로세스의 종료 이벤트가 발생했을 때 실행할 콜백 함수입니다.
     * @param worker
     * @param code
     * @param signal
     */
    (worker, code, signal) => {
      console.log(`[exit] worker '${worker.process.pid}'`);
    }
  );

} else {
  /*
  * 자식 프로세스일 경우에 실행할 코드 블록입니다.
  * HTTP 서버를 생상하여 실행합니다.
  * 이 서버는 모든 요청에 대해 자신의 pid 문자열을 응답합니다.
  * */
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`from '${process.pid}'`);
  }).listen(8000);

  /*
  * 콘솔에 서버가 정상적으로 구동되었음을 알립니다.
  * */
  console.log(`[worker] ${process.pid} started!`);
}
